import type { HourlyValue } from "./types";

/**
 * Burn time by Fitzpatrick skin type.
 *
 * Physics: 1 UV index unit = 25 mW/m² of erythemally weighted irradiance.
 * Dose accumulates as UVI × 0.025 W/m² × seconds (J/m²). Sunburn starts
 * around 1 MED (minimal erythema dose). We integrate the *forecast curve*
 * minute by minute rather than assuming UV stays constant, which is what
 * most burn-time tables get wrong around midday.
 *
 * MEDs below are the conservative (lower) end of commonly cited ranges,
 * in J/m² effective (1 SED = 100 J/m²). Individual MED varies widely,
 * so results are labelled as estimates.
 */
export const SKIN_TYPES = [
  { id: 1, roman: "I", med: 200, tone: "#F6E2D3", describe: "Always burns, never tans" },
  { id: 2, roman: "II", med: 250, tone: "#EBCBAE", describe: "Usually burns, tans a little" },
  { id: 3, roman: "III", med: 350, tone: "#D6A982", describe: "Sometimes burns, tans evenly" },
  { id: 4, roman: "IV", med: 450, tone: "#B07D55", describe: "Rarely burns, tans easily" },
  { id: 5, roman: "V", med: 600, tone: "#7D5236", describe: "Very rarely burns" },
  { id: 6, roman: "VI", med: 1000, tone: "#4A3022", describe: "Almost never burns" },
] as const;

export type SkinTypeId = (typeof SKIN_TYPES)[number]["id"];

/**
 * Effective SPF. Labels assume 2 mg/cm²; studies find people apply far less,
 * and protection falls roughly exponentially with thickness:
 *   effective = SPF ^ (applied / 2)
 * "real-life" uses 1 mg/cm² (typical measured application).
 */
export function effectiveSpf(spf: number, application: "label" | "real-life"): number {
  if (spf <= 1) return 1;
  return application === "label" ? spf : Math.pow(spf, 1 / 2);
}

/**
 * A UV curve of instants: each point is the UV at that moment.
 * Hourly forecasts are converted by placing each value at the middle of its hour.
 */
export type UvCurve = { time: string; uvi: number }[];

export function fromHourly(hourly: HourlyValue[]): UvCurve {
  return hourly.map((h) => ({ time: new Date(Date.parse(h.time) + 30 * 60_000).toISOString(), uvi: h.uvi }));
}

/**
 * Measured beats modelled: use observed points up to the latest observation,
 * then the forecast. Observed series are quarter-hourly KNMI values.
 */
export function mergeObserved(forecast: UvCurve, observed: { time: string; uvi: number | null }[]): UvCurve {
  const obs = observed.filter((p): p is { time: string; uvi: number } => p.uvi !== null && Date.parse(p.time) <= Date.now());
  if (!obs.length) return forecast;
  const cut = Date.parse(obs[obs.length - 1].time);
  return [...obs, ...forecast.filter((f) => Date.parse(f.time) > cut)].sort((a, b) => a.time.localeCompare(b.time));
}

export function uviAt(curve: UvCurve, t: number): number {
  if (curve.length === 0) return 0;
  const first = Date.parse(curve[0].time);
  const last = Date.parse(curve[curve.length - 1].time);
  if (t < first) return t < first - 3600_000 ? 0 : curve[0].uvi;
  if (t > last) return t > last + 3600_000 ? 0 : curve[curve.length - 1].uvi;
  for (let i = 1; i < curve.length; i++) {
    const t1 = Date.parse(curve[i].time);
    if (t <= t1) {
      const t0 = Date.parse(curve[i - 1].time);
      const f = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return curve[i - 1].uvi + f * (curve[i].uvi - curve[i - 1].uvi);
    }
  }
  return curve[curve.length - 1].uvi;
}

/** Erythemal dose in J/m² between two instants (1 UVI = 0.025 W/m²), divided by SPF. */
export function doseBetween(curve: UvCurve, start: number, end: number, spf = 1): number {
  let dose = 0;
  for (let t = start; t < end; t += 60_000) {
    const step = Math.min(60_000, end - t);
    dose += (uviAt(curve, t + step / 2) * 0.025 * (step / 1000)) / spf;
  }
  return dose;
}

export function medFor(skin: SkinTypeId): number {
  return SKIN_TYPES.find((s) => s.id === skin)!.med;
}

/**
 * Minutes until 1 MED, starting at `start`. Returns null if the dose is not
 * reached within `horizonHours` (i.e. "unlikely to burn today").
 */
export function burnMinutes(
  curve: UvCurve,
  start: Date,
  skin: SkinTypeId,
  spf = 1,
  horizonHours = 10,
  alreadyReceived = 0,
): number | null {
  const med = medFor(skin);
  let dose = alreadyReceived;
  const t0 = start.getTime();
  for (let m = 1; m <= horizonHours * 60; m++) {
    dose += (uviAt(curve, t0 + (m - 0.5) * 60_000) * 0.025 * 60) / spf;
    if (dose >= med) return m;
  }
  return null;
}

/** Start time of the hour with the highest UV (for "burn time at peak"). */
export function peakStart(curve: UvCurve, from: Date, to: Date): Date | null {
  const window = curve.filter((h) => {
    const t = Date.parse(h.time);
    return t >= from.getTime() && t < to.getTime();
  });
  if (!window.length) return null;
  const top = window.reduce((a, b) => (b.uvi > a.uvi ? b : a));
  // Centre a one-hour exposure on the peak.
  return new Date(Date.parse(top.time) - 30 * 60_000);
}
