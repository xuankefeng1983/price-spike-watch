"""'Explain this view': a plain-English read of the page for non-specialists, via Unity Gateway."""

from __future__ import annotations

import json

from databricks.sdk import WorkspaceClient
from fastapi import HTTPException

from .core._config import logger
from .db import query
from .models import EventDetailOut, ExplainOut, SpikeEvent, SummaryOut

MODEL = "system.ai.claude-sonnet-5-5"
REGION_NAMES = {"NSW1": "New South Wales", "QLD1": "Queensland", "SA1": "South Australia", "TAS1": "Tasmania", "VIC1": "Victoria"}

SYSTEM = """You explain an electricity price dashboard to an executive or non-specialist reader.

Domain context you may rely on:
- The NEM is Australia's National Electricity Market (eastern and southern states). Regions: NSW1, QLD1, SA1, TAS1, VIC1.
- The spot price (RRP) is the wholesale price per megawatt-hour, set every 5 minutes. A typical price is roughly $50-150/MWh.
- This dashboard counts a "spike" as consecutive 5-minute intervals at or above $300/MWh. That threshold is a dashboard choice, not an AEMO rule.
- The market price cap (the legal maximum) was $17,500/MWh in FY25 and $20,300/MWh in FY26, so a peak at those values means the market hit its ceiling.
- "Severity" is a ranking proxy: dollars above $300 multiplied by demand. It is not what anyone actually paid.
- Generation by fuel is only available for Queensland. Times are NEM time (AEST).
- The data is real public AEMO data, 1 Jul 2024 to 30 Jun 2026.

Rules:
- Use ONLY the numbers in the VIEW DATA. Never invent figures, dates, causes or events. If you infer a likely cause, say "likely" or "suggests".
- Plain English, short sentences, no jargon without a 3-6 word explanation. Australian spelling.
- Keep it tight: about 180 words in total.
- Reply with JSON only, no markdown fences, matching:
  {"headline": "<= 12 words", "summary": "2-3 sentences", "key_points": ["3 bullets, each one sentence with a number"],
   "how_to_read": ["3-4 bullets explaining how to read what is on this screen"], "caveat": "one sentence on what this view cannot tell you"}"""


def _view_data(s: SummaryOut, region: str | None, top: list[SpikeEvent], detail: EventDetailOut | None) -> dict:
    data: dict = {
        "period": f"{s.start} to {s.end}",
        "region_filter": REGION_NAMES.get(region or "", "All five regions"),
        "totals": {
            "spike_events": s.events,
            "hours_at_or_above_300": s.hours_spiked,
            "peak_price_aud_mwh": s.peak_price,
            "severity_aud_m": s.severity_m_aud,
        },
        "by_region": [r.model_dump() for r in s.by_region],
        "top_spikes_by_severity": [e.model_dump() for e in top],
    }
    if detail:
        sel = detail.event.model_dump()
        prices = [p.price for p in detail.trace if p.t < detail.event.event_start]
        sel["avg_price_in_3h_before"] = round(sum(prices) / len(prices), 0) if prices else None
        sel["fuel_mix_available"] = detail.fuel_mix_available
        sel["qld_fuel_shift_vs_3h_before_mw"] = detail.fuel_shift.model_dump() if detail.fuel_shift else None
        data["selected_spike"] = sel
    return data


def _parse(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`").split("\n", 1)[1] if "\n" in t else t
    start, end = t.find("{"), t.rfind("}")
    return json.loads(t[start : end + 1])


def _complete(ws: WorkspaceClient, data: dict):
    return ws.api_client.do(
        "POST",
        "/ai-gateway/mlflow/v1/chat/completions",
        body={
            "model": MODEL,
            "max_tokens": 2000,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": "VIEW DATA:\n" + json.dumps(data, default=str)},
            ],
        },
    )


def _complete_sql(ws: WorkspaceClient, data: dict) -> str:
    """Same system.ai model via SQL ai_query: needs only the `sql` scope the user token already has."""
    prompt = SYSTEM + "\n\nVIEW DATA:\n" + json.dumps(data, default=str)
    rows = query(
        ws,
        f"SELECT ai_query('{MODEL}', :prompt, modelParameters => named_struct('max_tokens', 2000)) AS out",
        prompt=prompt,
    )
    return str(rows[0]["out"]) if rows else ""


def _complete_gateway(ws: WorkspaceClient, data: dict) -> str:
    resp = _complete(ws, data)
    if not isinstance(resp, dict):
        raise ValueError("unexpected response shape")
    content = resp["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = "".join(c.get("text", "") for c in content if isinstance(c, dict))
    return str(content)


def explain(
    user_ws: WorkspaceClient,
    app_ws: WorkspaceClient,
    s: SummaryOut,
    region: str | None,
    top: list[SpikeEvent],
    detail: EventDetailOut | None,
) -> ExplainOut:
    """Call the model as the signed-in user (their model access); fall back to the app's identity."""
    data = _view_data(s, region, top, detail)
    try:
        content = ""
        attempts = [("sql-as-user", _complete_sql, user_ws), ("gateway-as-user", _complete_gateway, user_ws)]
        if user_ws is not app_ws:
            attempts.append(("gateway-as-app", _complete_gateway, app_ws))
        for i, (name, fn, client) in enumerate(attempts):
            try:
                content = fn(client, data)
                break
            except Exception as e:
                if i == len(attempts) - 1:
                    raise
                logger.warning("explain: %s failed (%r), trying next route", name, e)
        try:
            out = _parse(str(content))
        except ValueError:
            logger.error("explain: unparseable reply: %r", str(content)[:600])
            raise
    except Exception as e:  # surface a readable error, never a fake summary
        logger.error("explain: model call failed: %r", e)
        raise HTTPException(502, f"The summary model didn't answer: {str(e)[:200]}") from e
    label = f"{data['region_filter']}, {data['period']}"
    if detail:
        label += f", selected spike {detail.event.event_id}"
    return ExplainOut(
        headline=str(out.get("headline", "")),
        summary=str(out.get("summary", "")),
        key_points=[str(x) for x in out.get("key_points", [])][:5],
        how_to_read=[str(x) for x in out.get("how_to_read", [])][:5],
        caveat=str(out.get("caveat", "")),
        model=MODEL,
        view_label=label,
    )
