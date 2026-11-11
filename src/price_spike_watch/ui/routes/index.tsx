import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData } from "@tanstack/react-query";
import { AlertTriangle, Sparkles, Zap } from "lucide-react";
import { ModeToggle } from "@/components/apx/mode-toggle";
import { useDataRange, useGetEvent, useListEvents, useSummary, type EventDetailOut, type SpikeEvent, type SummaryOut } from "@/lib/api";
import selector from "@/lib/selector";
import { cn } from "@/lib/utils";
import { FuelChart, PriceChart } from "@/components/spikes/charts";
import { ExplainPanel } from "@/components/spikes/explain-panel";
import {
  REGIONS,
  REGION_NAMES,
  fmtDate,
  fmtDuration,
  fmtNum,
  fmtNum1,
  fmtPrice,
  fmtSeverity,
  fmtTime,
  heat,
  isoDate,
} from "@/components/spikes/format";

export const Route = createFileRoute("/")({
  component: () => <SpikeWatch />,
});

type Preset = "last90" | "fy26" | "fy25" | "all";
const SORTS = [
  { id: "severity", label: "Severity" },
  { id: "peak", label: "Peak price" },
  { id: "duration", label: "Duration" },
  { id: "recent", label: "Most recent" },
] as const;

function windowFor(preset: Preset, first: string, last: string) {
  const lastD = new Date(`${last}T00:00:00`);
  switch (preset) {
    case "last90":
      return { start: isoDate(new Date(lastD.getTime() - 89 * 864e5)), end: last, label: "last 90 days of data" };
    case "fy26":
      return { start: "2025-07-01", end: "2026-06-30", label: "FY26 (Jul 2025 – Jun 2026)" };
    case "fy25":
      return { start: "2024-07-01", end: "2025-06-30", label: "FY25 (Jul 2024 – Jun 2025)" };
    default:
      return { start: first, end: last, label: "both financial years" };
  }
}

function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 rounded-md border px-3 text-sm transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/50",
      )}
    >
      {children}
    </button>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

function ErrorNote({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-heat-3/50 p-3 text-sm">
      <AlertTriangle className="h-4 w-4 text-heat-3" aria-hidden />
      Couldn't load {what}.
      <button type="button" onClick={onRetry} className="ml-auto underline underline-offset-2">Try again</button>
    </div>
  );
}

function SpikeWatch() {
  const range = useDataRange(selector());
  const [preset, setPreset] = useState<Preset>("last90");
  const [region, setRegion] = useState<string | null>(null);
  const [sort, setSort] = useState<string>("severity");
  const [selected, setSelected] = useState<string | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);

  const win = range.data ? windowFor(preset, range.data.first_date, range.data.last_date) : null;
  const params = { start: win?.start ?? "", end: win?.end ?? "" };

  const summary = useSummary({ params, query: { ...selector<SummaryOut>().query, enabled: !!win, placeholderData: keepPreviousData } });
  const events = useListEvents({
    params: { ...params, region, sort, limit: 200 },
    query: { ...selector<SpikeEvent[]>().query, enabled: !!win, placeholderData: keepPreviousData },
  });

  // Keep a valid selection: first row of the current list unless the user picked one still in view.
  useEffect(() => {
    const list = events.data;
    if (!list) return;
    if (!selected || !list.some((e) => e.event_id === selected)) setSelected(list[0]?.event_id ?? null);
  }, [events.data, selected]);

  const s = summary.data;
  const regionStat = region ? s?.by_region.find((r) => r.region_id === region) : null;
  const k = regionStat
    ? { events: regionStat.events, hours: regionStat.hours_spiked, peak: regionStat.peak_price, sev: regionStat.severity_m_aud }
    : s
      ? { events: s.events, hours: s.hours_spiked, peak: s.peak_price, sev: s.severity_m_aud }
      : null;
  const maxSev = Math.max(1e-9, ...(s?.by_region.map((r) => r.severity_m_aud) ?? [0]));

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-6">
          <Zap className="h-5 w-5 text-heat-2" aria-hidden />
          <h1 className="font-semibold">Price Spike Watch</h1>
          <span className="hidden text-sm text-muted-foreground md:inline">
            NEM 5-minute spot price at or above $300/MWh, grouped into events
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setExplainOpen(true)}
            disabled={!win}
            className="flex h-9 items-center gap-2 rounded-md bg-heat-1 px-3 text-sm font-medium text-black hover:bg-heat-1/90 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Explain this view
          </button>
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        {range.isError && <ErrorNote what="the data range" onRetry={() => range.refetch()} />}

        <section className="flex flex-wrap items-center gap-x-6 gap-y-3" aria-label="Filters">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Region">
            <Chip active={region === null} onClick={() => setRegion(null)}>All NEM</Chip>
            {REGIONS.map((r) => (
              <Chip key={r} active={region === r} onClick={() => setRegion(r)} title={REGION_NAMES[r]}>{r.replace("1", "")}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Period">
            <Chip active={preset === "last90"} onClick={() => setPreset("last90")}>Last 90 days</Chip>
            <Chip active={preset === "fy26"} onClick={() => setPreset("fy26")}>FY26</Chip>
            <Chip active={preset === "fy25"} onClick={() => setPreset("fy25")}>FY25</Chip>
            <Chip active={preset === "all"} onClick={() => setPreset("all")}>Both years</Chip>
          </div>
          {range.data && (
            <p className="text-xs text-muted-foreground">
              Data runs {fmtDate(range.data.first_date)} – {fmtDate(range.data.last_date)}. "Last 90 days" ends at the latest data, not today.
            </p>
          )}
        </section>

        <section className="grid gap-6 rounded-lg border bg-card p-5 lg:grid-cols-[1fr_1.1fr]" aria-label="Summary">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Spike events" value={k ? fmtNum(k.events) : "…"} note={region ? REGION_NAMES[region] : "All five regions"} />
            <Kpi label="Hours ≥ $300" value={k ? fmtNum1(k.hours) : "…"} note={win?.label} />
            <Kpi label="Peak price" value={k ? `${fmtPrice(k.peak)}` : "…"} note="per MWh" />
            <Kpi label="Severity" value={k ? fmtSeverity(k.sev) : "…"} note="$ above $300 × demand" />
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Severity by region · click to filter</div>
            {summary.isError && <ErrorNote what="the summary" onRetry={() => summary.refetch()} />}
            {REGIONS.map((r) => {
              const st = s?.by_region.find((x) => x.region_id === r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(region === r ? null : r)}
                  className={cn("grid w-full grid-cols-[3rem_1fr_9rem] items-center gap-3 rounded px-1 py-0.5 text-left text-sm hover:bg-muted", region === r && "bg-muted")}
                >
                  <span className="font-medium">{r.replace("1", "")}</span>
                  <span className="h-2 rounded-full bg-muted">
                    <span className="block h-2 rounded-full bg-heat-2" style={{ width: `${((st?.severity_m_aud ?? 0) / maxSev) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {st ? `${fmtSeverity(st.severity_m_aud)} · ${st.events} ev` : "0 events"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground lg:col-span-2">
            Source: AEMO 5-minute dispatch price and demand (real public data), <code>workshop_demo.energy_utilities.aemo_price_demand_5min</code>, grouped into
            <code> mellabs_006.default.price_spike_events</code>. Severity is an exposure proxy, not a settlement cost.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                {events.data ? `${events.data.length === 200 ? "Top 200" : events.data.length} spikes` : "Spikes"}
              </h2>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-7 rounded border bg-background px-2 text-sm text-foreground">
                  {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            </div>
            {events.isError && <div className="p-4"><ErrorNote what="spike events" onRetry={() => events.refetch()} /></div>}
            {events.isPending && !events.isError && <ListSkeleton />}
            {events.data && events.data.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">
                No spikes at or above $300/MWh {region ? `in ${REGION_NAMES[region]}` : ""} for {win?.label}. Try "Both years" or All NEM.
              </p>
            )}
            <ol className={cn("max-h-[44rem] overflow-y-auto", events.isFetching && "opacity-60")}>
              {events.data?.map((e) => {
                const h = heat(e.peak_price);
                const on = e.event_id === selected;
                return (
                  <li key={e.event_id}>
                    <button
                      type="button"
                      onClick={() => setSelected(e.event_id)}
                      aria-current={on}
                      className={cn("grid w-full grid-cols-[3px_1fr_auto] gap-3 border-b px-4 py-2.5 text-left hover:bg-muted", on && "bg-muted")}
                    >
                      <span className={cn("rounded-full", h.bar)} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {e.region_id.replace("1", "")} · {fmtDate(e.event_start)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {fmtTime(e.event_start)} – {fmtTime(e.event_end)} · {fmtDuration(e.duration_min)}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className={cn("block text-sm font-semibold tabular-nums", h.cls)}>{fmtPrice(e.peak_price)}</span>
                        <span className="block text-xs text-muted-foreground">{h.label} · {fmtSeverity(e.severity_m_aud)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {selected ? <EventDetail id={selected} /> : <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Pick a spike to see its anatomy.</div>}
        </section>
      </main>
      <ExplainPanel
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        view={win ? { start: win.start, end: win.end, region, event_id: selected } : null}
      />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-px" aria-label="Loading spikes">
      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 animate-pulse border-b bg-muted/40" />)}
    </div>
  );
}

function EventDetail({ id }: { id: string }) {
  const q = useGetEvent({ params: { event_id: id }, query: { ...selector<EventDetailOut>().query, placeholderData: keepPreviousData } });
  const d = q.data;

  const insight = d?.fuel_shift ?? null;

  if (q.isError) return <ErrorNote what="this spike" onRetry={() => q.refetch()} />;
  if (!d) return <div className="h-[36rem] animate-pulse rounded-lg border bg-card" aria-label="Loading spike" />;
  const e = d.event;
  const h = heat(e.peak_price);

  return (
    <article className={cn("space-y-6 rounded-lg border bg-card p-5", q.isFetching && "opacity-70")}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{REGION_NAMES[e.region_id]}</div>
          <h2 className="text-xl font-semibold">
            {fmtDate(e.event_start)}, {fmtTime(e.event_start)} – {fmtTime(e.event_end)}
          </h2>
        </div>
        <span className={cn("rounded-md border px-2 py-1 text-xs font-medium", h.cls)}>{h.label}</span>
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          ["Peak", `${fmtPrice(e.peak_price)}/MWh`],
          ["Average", `${fmtPrice(e.avg_price)}/MWh`],
          ["Duration", fmtDuration(e.duration_min)],
          ["Peak demand", `${fmtNum(e.peak_demand_mw)} MW`],
          ["Severity", fmtSeverity(e.severity_m_aud)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Price and demand, 3 hours either side</h3>
        <PriceChart trace={d.trace} eventStart={e.event_start} eventEnd={e.event_end} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">What was running: Queensland generation by fuel</h3>
        {d.fuel_mix_available ? (
          <>
            {insight && (
              <p className="text-sm text-muted-foreground">
                Versus the hours before: solar {insight.solar_drop_mw >= 0 ? "fell" : "rose"} by <strong className="text-foreground">{fmtNum(Math.abs(insight.solar_drop_mw))} MW</strong>,
                gas {insight.gas_rise_mw >= 0 ? "rose" : "fell"} by <strong className="text-foreground">{fmtNum(Math.abs(insight.gas_rise_mw))} MW</strong>,
                batteries {insight.battery_rise_mw >= 0 ? "added" : "dropped"} <strong className="text-foreground">{fmtNum(Math.abs(insight.battery_rise_mw))} MW</strong>. These are averages, not a cause on their own.
              </p>
            )}
            <FuelChart mix={d.fuel_mix} eventStart={e.event_start} eventEnd={e.event_end} />
          </>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Unit-level generation is only in the dataset for Queensland, so there's no fuel mix for {REGION_NAMES[e.region_id]}. Price and demand above are complete.
          </p>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        Times are NEM time (AEST). Sources: <code>aemo_price_demand_5min</code>, <code>aemo_generation_30min</code> + <code>aemo_generators</code>.
      </p>
    </article>
  );
}
