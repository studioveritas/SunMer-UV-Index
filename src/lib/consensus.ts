import type { Confidence, Consensus, HourlyValue, OutlookDay, UvKind, UvReading } from "./types";
import { whoCategory } from "./who";
import { round1 } from "./time";

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return round1(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
}

function spread(xs: number[]): number | null {
  return xs.length < 2 ? null : round1(Math.max(...xs) - Math.min(...xs));
}

function group(readings: UvReading[], kind: UvKind) {
  const values = readings
    .filter((r) => r.status === "ok" && r.kind === kind && r.todayMax !== null)
    .map((r) => r.todayMax as number);
  return { median: median(values), n: values.length, spread: spread(values) };
}

/**
 * Confidence reflects agreement, not just volume:
 *   high   = 3+ sources report today, and the headline group agrees within 1.5
 *   medium = 2+ sources, headline group within 3
 *   low    = only one source, or sources disagree strongly
 */
function confidenceFor(sourcesOk: number, headlineSpread: number | null): Confidence {
  if (sourcesOk === 0) return "none";
  if (sourcesOk >= 3 && (headlineSpread ?? 0) <= 1.5) return "high";
  if (sourcesOk >= 2 && (headlineSpread ?? 0) <= 3) return "medium";
  return "low";
}

export function buildConsensus(readings: UvReading[]): Consensus {
  const cloudAdjusted = group(readings, "cloud-adjusted");
  const clearSky = group(readings, "clear-sky");

  const headlineKind: UvKind | null =
    cloudAdjusted.n > 0 ? "cloud-adjusted" : clearSky.n > 0 ? "clear-sky" : null;
  const headline = headlineKind === "cloud-adjusted" ? cloudAdjusted : clearSky;

  const currents = readings
    .filter((r) => r.status === "ok" && r.kind === "cloud-adjusted" && r.current !== null)
    .map((r) => r.current as number);

  const sourcesOk = readings.filter((r) => r.status === "ok" && r.todayMax !== null).length;

  const cloudEffect =
    cloudAdjusted.median !== null && clearSky.median !== null
      ? round1(Math.max(0, clearSky.median - cloudAdjusted.median))
      : null;

  return {
    todayMax: headline.median,
    headlineKind,
    cloudAdjusted,
    clearSky,
    cloudEffect,
    current: median(currents),
    currentSource: currents.length ? "forecast" : null,
    category: whoCategory(headline.median),
    confidence: confidenceFor(sourcesOk, headline.spread),
    sourcesOk,
  };
}

/* ------------------------------------------------------------------ */
/* Outlook: one consensus per future day, with honest fallback.        */
/* Cloud-adjusted sources stop after 2–5 days; beyond that the outlook */
/* shows the clear-sky potential and says so.                          */
/* ------------------------------------------------------------------ */


export function buildOutlook(readings: UvReading[], today: string, days = 6): OutlookDay[] {
  const ok = readings.filter((r) => r.status === "ok");
  const dates = new Set<string>();
  for (const r of ok) for (const d of r.daily) if (d.date > today) dates.add(d.date);

  return [...dates].sort().slice(0, days).map((date) => {
    const pick = (kind: UvKind) =>
      ok.filter((r) => r.kind === kind)
        .map((r) => r.daily.find((d) => d.date === date)?.max)
        .filter((v): v is number => typeof v === "number");
    const cloudy = pick("cloud-adjusted");
    const clear = pick("clear-sky");
    const kind: UvKind | null = cloudy.length ? "cloud-adjusted" : clear.length ? "clear-sky" : null;
    const max = kind === "cloud-adjusted" ? median(cloudy) : median(clear);
    return {
      date,
      max,
      kind,
      category: whoCategory(max),
      cloudAdjusted: median(cloudy),
      clearSky: median(clear),
      sources: cloudy.length + clear.length,
    };
  });
}

/** Hour-by-hour median of hourly cloud-adjusted sources (Met Office, CAMS). */
export function buildHourlyCurve(readings: UvReading[]): HourlyValue[] {
  const byHour = new Map<string, number[]>();
  for (const r of readings) {
    if (r.status !== "ok" || r.kind !== "cloud-adjusted" || r.resolution !== "hourly") continue;
    for (const h of r.hourly) {
      const key = new Date(Math.floor(Date.parse(h.time) / 3600_000) * 3600_000).toISOString();
      byHour.set(key, [...(byHour.get(key) ?? []), h.uvi]);
    }
  }
  return [...byHour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, vals]) => ({ time, uvi: median(vals) as number }));
}
