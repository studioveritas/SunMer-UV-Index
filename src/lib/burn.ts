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

function uviAt(curve: HourlyValue[], t: number): number {
  // Hourly values are treated as the hour's centre; linear interpolation between them.
  if (curve.length === 0) return 0;
  const pts = curve.map((h) => ({ t: Date.parse(h.time) + 30 * 60_000, v: h.uvi }));
  if (t <= pts[0].t) return t < pts[0].t - 3600_000 ? 0 : pts[0].v;
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) {
      const f = (t - pts[i - 1].t) / (pts[i].t - pts[i - 1].t);
      return pts[i - 1].v + f * (pts[i].v - pts[i - 1].v);
    }
  }
  return t > pts[pts.length - 1].t + 3600_000 ? 0 : pts[pts.length - 1].v;
}

/**
 * Minutes until 1 MED, starting at `start`. Returns null if the dose is not
 * reached within `horizonHours` (i.e. "unlikely to burn today").
 */
export function burnMinutes(
  curve: HourlyValue[],
  start: Date,
  skin: SkinTypeId,
  spf = 1,
  horizonHours = 10,
): number | null {
  const med = SKIN_TYPES.find((s) => s.id === skin)!.med;
  let dose = 0;
  const t0 = start.getTime();
  for (let m = 1; m <= horizonHours * 60; m++) {
    dose += (uviAt(curve, t0 + (m - 0.5) * 60_000) * 0.025 * 60) / spf;
    if (dose >= med) return m;
  }
  return null;
}

/** Start time of the hour with the highest UV (for "burn time at peak"). */
export function peakStart(curve: HourlyValue[], from: Date, to: Date): Date | null {
  const window = curve.filter((h) => {
    const t = Date.parse(h.time);
    return t >= from.getTime() && t < to.getTime();
  });
  if (!window.length) return null;
  const top = window.reduce((a, b) => (b.uvi > a.uvi ? b : a));
  // Centre the exposure on the peak: start 30 min before the peak hour's midpoint.
  return new Date(Date.parse(top.time));
}
