from pydantic import BaseModel
from .. import __version__


class VersionOut(BaseModel):
    version: str

    @classmethod
    def from_metadata(cls):
        return cls(version=__version__)


class DataRangeOut(BaseModel):
    first_date: str
    last_date: str


class RegionStat(BaseModel):
    region_id: str
    events: int
    hours_spiked: float
    peak_price: float
    severity_m_aud: float


class SummaryOut(BaseModel):
    start: str
    end: str
    events: int
    hours_spiked: float
    peak_price: float | None
    severity_m_aud: float
    by_region: list[RegionStat]


class SpikeEvent(BaseModel):
    event_id: str
    region_id: str
    event_start: str
    event_end: str
    duration_min: int
    peak_price: float
    avg_price: float
    peak_demand_mw: float
    severity_m_aud: float


class TracePoint(BaseModel):
    t: str
    price: float
    demand_mw: float


class FuelPoint(BaseModel):
    t: str
    fuel: str
    mw: float


class EventDetailOut(BaseModel):
    event: SpikeEvent
    trace: list[TracePoint]
    fuel_mix: list[FuelPoint]
    fuel_mix_available: bool
    fuel_shift: "FuelShift | None" = None


class FuelShift(BaseModel):
    """Average MW change from the 3 h before the spike to during it (QLD only)."""

    solar_drop_mw: float
    gas_rise_mw: float
    battery_rise_mw: float
    coal_rise_mw: float


class ExplainIn(BaseModel):
    start: str
    end: str
    region: str | None = None
    event_id: str | None = None


class ExplainOut(BaseModel):
    headline: str
    summary: str
    key_points: list[str]
    how_to_read: list[str]
    caveat: str
    model: str
    view_label: str
