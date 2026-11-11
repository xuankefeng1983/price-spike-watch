export const REGIONS = ["NSW1", "QLD1", "SA1", "TAS1", "VIC1"] as const;
export const REGION_NAMES: Record<string, string> = {
  NSW1: "New South Wales",
  QLD1: "Queensland",
  SA1: "South Australia",
  TAS1: "Tasmania",
  VIC1: "Victoria",
};

const aud0 = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const num0 = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });

export const fmtPrice = (v: number | null | undefined) => (v == null ? "—" : aud0.format(v));
export const fmtNum = (v: number) => num0.format(v);
export const fmtNum1 = (v: number) => num1.format(v);
export const fmtSeverity = (m: number) =>
  m >= 1000 ? `$${num1.format(m / 1000)}bn` : m >= 1 ? `$${num1.format(m)}m` : `$${num0.format(m * 1000)}k`;
export const fmtDuration = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;

// Timestamps are NEM time (AEST) without zone: parse as wall-clock, never shift.
export const parseNem = (s: string) => {
  const [d, t = "00:00"] = s.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  return new Date(y, mo - 1, da, h, mi);
};
const dateFmt = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
export const fmtDate = (s: string) => dateFmt.format(parseNem(s));
export const fmtTime = (s: string) => timeFmt.format(parseNem(s)).replace(" ", "").toLowerCase();

/** Heat band for a peak price: text label + token, so colour is never the only cue. */
export function heat(price: number): { label: string; cls: string; bar: string } {
  if (price >= 5000) return { label: "Extreme", cls: "text-heat-3", bar: "bg-heat-3" };
  if (price >= 1000) return { label: "High", cls: "text-heat-2", bar: "bg-heat-2" };
  return { label: "Elevated", cls: "text-heat-1", bar: "bg-heat-1" };
}

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
