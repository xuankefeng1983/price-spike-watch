import { useMemo, useState } from "react";
import type { FuelPoint, TracePoint } from "@/lib/api";
import { fmtNum, fmtPrice, fmtTime, parseNem } from "./format";

const W = 720;
const PAD = { l: 64, r: 64, t: 16, b: 28 };

function ticks(min: number, max: number, n = 4) {
  const span = max - min || 1;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

function timeTicks(t0: number, t1: number) {
  const out: number[] = [];
  const d = new Date(t0);
  d.setMinutes(0, 0, 0);
  const stepH = t1 - t0 > 10 * 3600e3 ? 2 : 1;
  while (d.getTime() <= t1) {
    if (d.getTime() >= t0 && d.getHours() % stepH === 0) out.push(d.getTime());
    d.setHours(d.getHours() + 1);
  }
  return out;
}
const hourLabel = (ms: number) => {
  const h = new Date(ms).getHours();
  return h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`;
};

export function PriceChart({
  trace,
  eventStart,
  eventEnd,
  threshold = 300,
}: {
  trace: TracePoint[];
  eventStart: string;
  eventEnd: string;
  threshold?: number;
}) {
  const H = 260;
  const [hover, setHover] = useState<number | null>(null);
  const pts = useMemo(() => trace.map((p) => ({ ...p, ms: parseNem(p.t).getTime() })), [trace]);
  if (pts.length < 2) return <p className="text-sm text-muted-foreground">Not enough intervals to draw this window.</p>;

  const t0 = pts[0].ms;
  const t1 = pts[pts.length - 1].ms;
  const pMin = Math.min(0, ...pts.map((p) => p.price));
  const pMax = Math.max(threshold * 1.2, ...pts.map((p) => p.price));
  const dMin = Math.min(...pts.map((p) => p.demand_mw)) * 0.95;
  const dMax = Math.max(...pts.map((p) => p.demand_mw)) * 1.02;
  const x = (ms: number) => PAD.l + ((ms - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const yP = (v: number) => PAD.t + (1 - (v - pMin) / (pMax - pMin)) * (H - PAD.t - PAD.b);
  const yD = (v: number) => PAD.t + (1 - (v - dMin) / (dMax - dMin)) * (H - PAD.t - PAD.b);
  const priceLine = pts.map((p, i) => `${i ? "L" : "M"}${x(p.ms).toFixed(1)},${yP(p.price).toFixed(1)}`).join("");
  const demandLine = pts.map((p, i) => `${i ? "L" : "M"}${x(p.ms).toFixed(1)},${yD(p.demand_mw).toFixed(1)}`).join("");
  const es = x(parseNem(eventStart).getTime() - 5 * 60e3);
  const ee = x(parseNem(eventEnd).getTime());
  const hp = hover != null ? pts[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    const ms = t0 + ((mx - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].ms - ms) < Math.abs(pts[best].ms - ms)) best = i;
    setHover(best);
  };

  return (
    <figure className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-heat-3" />Spot price ($/MWh, left)</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-foreground/60" />Demand (MW, right)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm bg-heat-3/15" />Spike window</span>
        <span className="ml-auto tabular-nums">
          {hp ? `${fmtTime(hp.t)} · ${fmtPrice(hp.price)}/MWh · ${fmtNum(hp.demand_mw)} MW` : "Hover for 5-min values"}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label="Spot price and demand around the spike, 5-minute intervals"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <rect x={es} y={PAD.t} width={Math.max(2, ee - es)} height={H - PAD.t - PAD.b} className="fill-heat-3/15" />
        {ticks(pMin, pMax).map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yP(v)} y2={yP(v)} className="stroke-border" strokeWidth={0.5} />
            <text x={PAD.l - 8} y={yP(v) + 4} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
              {v >= 1000 ? `$${v / 1000}k` : `$${v}`}
            </text>
          </g>
        ))}
        {ticks(dMin, dMax, 3).map((v) => (
          <text key={v} x={W - PAD.r + 8} y={yD(v) + 4} className="fill-muted-foreground text-[10px] tabular-nums">
            {fmtNum(v)}
          </text>
        ))}
        {timeTicks(t0, t1).map((ms) => (
          <text key={ms} x={x(ms)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {hourLabel(ms)}
          </text>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={yP(threshold)} y2={yP(threshold)} className="stroke-heat-1" strokeDasharray="2 3" />
        <text x={W - PAD.r - 4} y={yP(threshold) - 4} textAnchor="end" className="fill-heat-1 text-[10px]">
          $300 threshold
        </text>
        <path d={demandLine} fill="none" className="stroke-foreground/60" strokeWidth={1.25} strokeDasharray="4 3" />
        <path d={priceLine} fill="none" className="stroke-heat-3" strokeWidth={2} strokeLinejoin="round" />
        {hp && (
          <g>
            <line x1={x(hp.ms)} x2={x(hp.ms)} y1={PAD.t} y2={H - PAD.b} className="stroke-foreground/40" />
            <circle cx={x(hp.ms)} cy={yP(hp.price)} r={3.5} className="fill-heat-3" />
          </g>
        )}
      </svg>
    </figure>
  );
}

const FUELS = ["Coal", "Gas & liquid", "Hydro", "Wind", "Solar", "Battery", "Other"] as const;
const FUEL_CLS: Record<string, string> = {
  Coal: "fill-fuel-coal",
  "Gas & liquid": "fill-fuel-gas",
  Hydro: "fill-fuel-hydro",
  Wind: "fill-fuel-wind",
  Solar: "fill-fuel-solar",
  Battery: "fill-fuel-battery",
  Other: "fill-fuel-other",
};
const SWATCH: Record<string, string> = Object.fromEntries(
  Object.entries(FUEL_CLS).map(([k, v]) => [k, v.replace("fill-", "bg-")]),
);

export function FuelChart({ mix, eventStart, eventEnd }: { mix: FuelPoint[]; eventStart: string; eventEnd: string }) {
  const H = 220;
  const [hover, setHover] = useState<number | null>(null);
  const rows = useMemo(() => {
    const byT = new Map<string, Record<string, number>>();
    for (const p of mix) {
      const r = byT.get(p.t) ?? {};
      r[p.fuel] = (r[p.fuel] ?? 0) + p.mw;
      byT.set(p.t, r);
    }
    return [...byT.entries()]
      .map(([t, v]) => ({ t, ms: parseNem(t).getTime(), v }))
      .sort((a, b) => a.ms - b.ms);
  }, [mix]);
  if (rows.length < 2) return <p className="text-sm text-muted-foreground">No generation readings in this window.</p>;

  // Stack generation above zero; battery charging (negative) sits below the axis.
  const stacks = rows.map((r) => {
    let up = 0;
    let down = 0;
    const seg: Record<string, [number, number]> = {};
    for (const f of FUELS) {
      const v = r.v[f] ?? 0;
      if (v >= 0) { seg[f] = [up, up + v]; up += v; }
      else { seg[f] = [down + v, down]; down += v; }
    }
    return { ...r, seg, up, down };
  });
  const t0 = stacks[0].ms;
  const t1 = stacks[stacks.length - 1].ms;
  const yMax = Math.max(...stacks.map((s) => s.up)) * 1.05;
  const yMin = Math.min(0, ...stacks.map((s) => s.down)) * 1.1;
  const x = (ms: number) => PAD.l + ((ms - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const area = (f: string) => {
    const top = stacks.map((s, i) => `${i ? "L" : "M"}${x(s.ms).toFixed(1)},${y(s.seg[f][1]).toFixed(1)}`).join("");
    const bot = [...stacks].reverse().map((s) => `L${x(s.ms).toFixed(1)},${y(s.seg[f][0]).toFixed(1)}`).join("");
    return `${top}${bot}Z`;
  };
  const es = x(parseNem(eventStart).getTime() - 30 * 60e3);
  const ee = x(parseNem(eventEnd).getTime());
  const hs = hover != null ? stacks[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ms = t0 + ((((e.clientX - r.left) / r.width) * W - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < stacks.length; i++) if (Math.abs(stacks[i].ms - ms) < Math.abs(stacks[best].ms - ms)) best = i;
    setHover(best);
  };

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label="Queensland generation by fuel, 30-minute averages"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <rect x={es} y={PAD.t} width={Math.max(2, ee - es)} height={H - PAD.t - PAD.b} className="fill-heat-3/10" />
        {ticks(yMin, yMax).map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? "stroke-foreground/50" : "stroke-border"} strokeWidth={0.5} />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
              {fmtNum(v)}
            </text>
          </g>
        ))}
        {timeTicks(t0, t1).map((ms) => (
          <text key={ms} x={x(ms)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {hourLabel(ms)}
          </text>
        ))}
        {FUELS.map((f) => <path key={f} d={area(f)} className={FUEL_CLS[f]} />)}
        {hs && <line x1={x(hs.ms)} x2={x(hs.ms)} y1={PAD.t} y2={H - PAD.b} className="stroke-foreground/60" />}
      </svg>
      <figcaption className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
        {FUELS.map((f) => (
          <span key={f} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={`h-2.5 w-2.5 rounded-sm ${SWATCH[f]}`} />
            {f}
            {hs && <span className="ml-auto tabular-nums text-foreground">{fmtNum(hs.v[f] ?? 0)} MW</span>}
          </span>
        ))}
        <span className="col-span-full text-muted-foreground">
          {hs ? `${fmtTime(hs.t)} interval end` : "MW, 30-min averages. Hover for values. Battery below zero = charging."}
        </span>
      </figcaption>
    </figure>
  );
}
