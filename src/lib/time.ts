/** YYYY-MM-DD for a given instant in a given IANA timezone. */
export function localDate(instant: Date, tz: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Group hourly values into daily maxima by the city's local date. */
export function dailyMaxFromHourly(
  hourly: { time: string; uvi: number }[],
  tz: string,
): { date: string; max: number }[] {
  const byDay = new Map<string, number>();
  for (const h of hourly) {
    const d = localDate(new Date(h.time), tz);
    byDay.set(d, Math.max(byDay.get(d) ?? 0, h.uvi));
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, max]) => ({ date, max: round1(max) }));
}

/** Value for the hour containing `now` (or the latest one before it). */
export function currentFromHourly(
  hourly: { time: string; uvi: number }[],
  now = new Date(),
): number | null {
  let best: { t: number; uvi: number } | null = null;
  for (const h of hourly) {
    const t = Date.parse(h.time);
    if (t <= now.getTime() && (!best || t > best.t)) best = { t, uvi: h.uvi };
  }
  if (!best || now.getTime() - best.t > 3 * 3600_000) return null; // stale
  return round1(best.uvi);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
