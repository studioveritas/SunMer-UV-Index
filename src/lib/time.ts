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
  const hasMidday = new Set<string>();
  for (const h of hourly) {
    const at = new Date(h.time);
    const d = localDate(at, tz);
    byDay.set(d, Math.max(byDay.get(d) ?? 0, h.uvi));
    if (localHour(at, tz) >= 11 && localHour(at, tz) <= 14) hasMidday.add(d);
  }
  // A day whose series stops before midday would report a false low peak; drop it.
  return [...byDay.entries()]
    .filter(([d]) => hasMidday.has(d))
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

export function localHour(instant: Date, tz: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hour12: false }).format(instant)) % 24;
}
