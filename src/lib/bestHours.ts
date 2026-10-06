import { uviAt, type UvCurve } from "./burn";
import { sunTimes } from "./sun";

/**
 * Best hours to be outside (e.g. for a run): daylight with UV below 3.
 * Below 3 the WHO and RIVM say most people need no protection; from 3 up,
 * cover up. Times are found to the minute by interpolating the UV curve.
 */
export const LOW_UV = 3;

export type BandLevel = "dark" | "low" | "moderate" | "high";
export interface BandSegment { start: string; end: string; level: BandLevel }
export interface BestHours {
  sunrise: string | null;
  sunset: string | null;
  segments: BandSegment[];
  /** Daylight windows with UV < 3, in order. */
  lowWindows: { start: string; end: string }[];
  /** Longest low-UV daylight window still ahead (or running now). */
  next: { start: string; end: string } | null;
  /** UV ≥ 3 period, if any. */
  protectFrom: string | null;
  protectUntil: string | null;
}

// UV is reported as a whole number (WHO), so classify on the rounded value: 2.6 counts as 3,
// matching the level label shown in the headline.
const levelOf = (uvi: number): BandLevel => {
  const r = Math.round(uvi);
  return r < LOW_UV ? "low" : r < 6 ? "moderate" : "high";
};

export function bestHours(curve: UvCurve, day: Date, lat: number, lon: number, now = new Date()): BestHours {
  const sun = sunTimes(day, lat, lon);
  const rise = sun.sunrise?.getTime() ?? sun.noon.getTime() - 6 * 3600_000;
  const set = sun.sunset?.getTime() ?? sun.noon.getTime() + 6 * 3600_000;
  const dayStart = rise - 90 * 60_000;
  const dayEnd = set + 90 * 60_000;

  const segments: BandSegment[] = [];
  let cur: BandSegment | null = null;
  for (let t = dayStart; t <= dayEnd; t += 60_000) {
    const level: BandLevel = t < rise || t > set ? "dark" : levelOf(uviAt(curve, t));
    const iso = new Date(t).toISOString();
    if (!cur || cur.level !== level) {
      if (cur) cur.end = iso;
      cur = { start: iso, end: iso, level };
      segments.push(cur);
    }
  }
  if (cur) cur.end = new Date(dayEnd).toISOString();

  const lowWindows = segments.filter((s) => s.level === "low").map(({ start, end }) => ({ start, end }));
  const ahead = lowWindows
    .map((w) => ({ start: new Date(Math.max(Date.parse(w.start), now.getTime())).toISOString(), end: w.end }))
    .filter((w) => Date.parse(w.end) - Date.parse(w.start) >= 20 * 60_000);
  const next = ahead.sort((a, b) => Date.parse(b.end) - Date.parse(b.start) - (Date.parse(a.end) - Date.parse(a.start)))[0] ?? null;

  const protect = segments.filter((s) => s.level === "moderate" || s.level === "high");
  return {
    sunrise: sun.sunrise?.toISOString() ?? null,
    sunset: sun.sunset?.toISOString() ?? null,
    segments,
    lowWindows,
    next,
    protectFrom: protect[0]?.start ?? null,
    protectUntil: protect.at(-1)?.end ?? null,
  };
}
