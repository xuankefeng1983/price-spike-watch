import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from functools import cache

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.iam import User as UserOut
from fastapi import HTTPException, Request

from .core import Dependencies, create_router
from .core._config import logger
from .db import DEMO, EVENTS, query
from .explain import explain
from .models import (
    DataRangeOut,
    EventDetailOut,
    ExplainIn,
    ExplainOut,
    FuelPoint,
    FuelShift,
    RegionStat,
    SpikeEvent,
    SummaryOut,
    TracePoint,
    VersionOut,
)

router = create_router()

REGIONS = {"NSW1", "QLD1", "SA1", "TAS1", "VIC1"}
SORTS = {"severity": "severity_m_aud", "peak": "peak_price", "duration": "duration_min", "recent": "event_start"}


@cache
def _profile_client(profile: str) -> WorkspaceClient:
    return WorkspaceClient(profile=profile)


def reader(request: Request, ws: Dependencies.Client) -> WorkspaceClient:
    """Read as the signed-in user: their forwarded token when deployed, the `me` profile locally."""
    token = request.headers.get("x-forwarded-access-token")
    if token:
        return WorkspaceClient(host=ws.config.host, token=token, auth_type="pat")
    profile = os.environ.get("READ_PROFILE")
    return _profile_client(profile) if profile else ws


def region_filter(region: str | None) -> str:
    if region and region not in REGIONS:
        raise HTTPException(400, f"Unknown region {region}")
    return "AND region_id = :region" if region else ""


def to_event(r: dict) -> SpikeEvent:
    return SpikeEvent(
        event_id=r["event_id"],
        region_id=r["region_id"],
        event_start=r["event_start"],
        event_end=r["event_end"],
        duration_min=int(r["duration_min"]),
        peak_price=float(r["peak_price"]),
        avg_price=float(r["avg_price"]),
        peak_demand_mw=float(r["peak_demand_mw"]),
        severity_m_aud=float(r["severity_m_aud"]),
    )


@router.get("/version", response_model=VersionOut, operation_id="version")
async def version():
    return VersionOut.from_metadata()


@router.get("/current-user", response_model=UserOut, operation_id="currentUser")
def me(user_ws: Dependencies.UserClient):
    return user_ws.current_user.me()


@router.get("/data-range", response_model=DataRangeOut, operation_id="dataRange")
def data_range(request: Request, ws: Dependencies.Client):
    r = query(reader(request, ws), f"SELECT MIN(event_date) AS f, MAX(event_date) AS l FROM {EVENTS}")[0]
    return DataRangeOut(first_date=r["f"], last_date=r["l"])


@router.get("/summary", response_model=SummaryOut, operation_id="summary")
def summary(request: Request, ws: Dependencies.Client, start: date, end: date):
    rows = query(
        reader(request, ws),
        f"""SELECT region_id, COUNT(*) AS events, ROUND(SUM(duration_min) / 60.0, 1) AS hours,
                   MAX(peak_price) AS peak, ROUND(SUM(severity_m_aud), 2) AS sev
            FROM {EVENTS} WHERE event_date BETWEEN :start AND :end
            GROUP BY region_id ORDER BY region_id""",
        start=start,
        end=end,
    )
    stats = [
        RegionStat(
            region_id=r["region_id"],
            events=int(r["events"]),
            hours_spiked=float(r["hours"]),
            peak_price=float(r["peak"]),
            severity_m_aud=float(r["sev"]),
        )
        for r in rows
    ]
    return SummaryOut(
        start=str(start),
        end=str(end),
        events=sum(s.events for s in stats),
        hours_spiked=round(sum(s.hours_spiked for s in stats), 1),
        peak_price=max((s.peak_price for s in stats), default=None),
        severity_m_aud=round(sum(s.severity_m_aud for s in stats), 2),
        by_region=stats,
    )


@router.get("/events", response_model=list[SpikeEvent], operation_id="listEvents")
def list_events(
    request: Request,
    ws: Dependencies.Client,
    start: date,
    end: date,
    region: str | None = None,
    sort: str = "severity",
    limit: int = 100,
):
    order = SORTS.get(sort)
    if order is None:
        raise HTTPException(400, f"Unknown sort {sort}")
    params: dict = {"start": start, "end": end, "lim": max(1, min(limit, 500))}
    if region:
        params["region"] = region
    rows = query(
        reader(request, ws),
        f"""SELECT * FROM {EVENTS}
            WHERE event_date BETWEEN :start AND :end {region_filter(region)}
            ORDER BY {order} DESC LIMIT :lim""",
        **params,
    )
    return [to_event(r) for r in rows]


@router.get("/events/{event_id}", response_model=EventDetailOut, operation_id="getEvent")
def get_event(request: Request, ws: Dependencies.Client, event_id: str):
    rws = reader(request, ws)
    found = query(rws, f"SELECT * FROM {EVENTS} WHERE event_id = :id", id=event_id)
    if not found:
        raise HTTPException(404, "Event not found")
    ev = to_event(found[0])
    window = dict(region=ev.region_id, s=ev.event_start, e=ev.event_end)
    trace = query(
        rws,
        f"""SELECT interval_end AS t, rrp_aud_mwh AS price, total_demand_mw AS demand
            FROM {DEMO}.aemo_price_demand_5min
            WHERE region_id = :region
              AND interval_end BETWEEN CAST(:s AS TIMESTAMP_NTZ) - INTERVAL 3 HOURS
                                   AND CAST(:e AS TIMESTAMP_NTZ) + INTERVAL 3 HOURS
            ORDER BY t""",
        **window,
    )
    fuel: list[FuelPoint] = []
    if ev.region_id == "QLD1":
        rows = query(
            rws,
            f"""SELECT g.interval_end AS t,
                       CASE WHEN r.fuel_source_descriptor = 'Black Coal' THEN 'Coal'
                            WHEN r.fuel_source_primary = 'Battery Storage' THEN 'Battery'
                            WHEN r.fuel_source_primary = 'Fossil' THEN 'Gas & liquid'
                            WHEN r.fuel_source_primary IN ('Solar', 'Wind', 'Hydro') THEN r.fuel_source_primary
                            ELSE 'Other' END AS fuel,
                       SUM(g.avg_mw) AS mw
                FROM {DEMO}.aemo_generation_30min g
                JOIN {DEMO}.aemo_generators r USING (duid)
                WHERE g.interval_end BETWEEN CAST(:s AS TIMESTAMP_NTZ) - INTERVAL 3 HOURS
                                         AND CAST(:e AS TIMESTAMP_NTZ) + INTERVAL 3 HOURS
                GROUP BY 1, 2 ORDER BY 1, 2""",
            s=ev.event_start,
            e=ev.event_end,
        )
        fuel = [FuelPoint(t=r["t"], fuel=r["fuel"], mw=round(float(r["mw"]), 1)) for r in rows]
    return EventDetailOut(
        event=ev,
        trace=[TracePoint(t=r["t"], price=float(r["price"]), demand_mw=float(r["demand"])) for r in trace],
        fuel_mix=fuel,
        fuel_mix_available=ev.region_id == "QLD1",
        fuel_shift=fuel_shift(fuel, ev) if fuel else None,
    )


def fuel_shift(mix: list[FuelPoint], ev: SpikeEvent) -> FuelShift:
    before = [p for p in mix if p.t < ev.event_start]
    during = [p for p in mix if ev.event_start <= p.t <= ev.event_end]

    def avg(rows: list[FuelPoint], fuel: str) -> float:
        n = len({p.t for p in rows}) or 1
        return sum(p.mw for p in rows if p.fuel == fuel) / n

    def rise(fuel: str) -> float:
        return round(avg(during, fuel) - avg(before, fuel), 0)

    return FuelShift(
        solar_drop_mw=-rise("Solar"),
        gas_rise_mw=rise("Gas & liquid"),
        battery_rise_mw=rise("Battery"),
        coal_rise_mw=rise("Coal"),
    )


# Default window helper exposed for the UI's first load
@router.get("/default-window", response_model=DataRangeOut, operation_id="defaultWindow")
def default_window(request: Request, ws: Dependencies.Client):
    r = data_range(request, ws)
    last = date.fromisoformat(r.last_date)
    return DataRangeOut(first_date=str(last - timedelta(days=89)), last_date=r.last_date)


@router.post("/explain", response_model=ExplainOut, operation_id="explainView")
def explain_view(request: Request, ws: Dependencies.Client, body: ExplainIn):
    """Plain-English summary of the current view, built only from numbers recomputed here."""
    start, end = date.fromisoformat(body.start), date.fromisoformat(body.end)
    region_filter(body.region)
    logger.warning("explain: user token forwarded=%s", bool(request.headers.get("x-forwarded-access-token")))
    with ThreadPoolExecutor(max_workers=3) as pool:
        s = pool.submit(summary, request, ws, start, end)
        top = pool.submit(list_events, request, ws, start, end, region=body.region, sort="severity", limit=5)
        detail = pool.submit(get_event, request, ws, body.event_id) if body.event_id else None
        return explain(
            reader(request, ws), ws, s.result(), body.region, top.result(), detail.result() if detail else None
        )
