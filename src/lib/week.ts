import type { CityUv, UvKind, WhoCategory } from "./types";
import type { UvCurve } from "./burn";
import { bestHours } from "./bestHours";
import { sunAltitude, sunTimes } from "./sun";
import { localDate, round1 } from "./time";
import { whoCategory } from "./who";

/**
 * The week ahead for one city: today plus the outlook days (after dark,
 * tomorrow onward). Protection hours come from the forecast curve where a
 * service forecasts that day hour by hour; beyond that from a bell curve
 * around solar noon scaled to the day's peak, which is how UV behaves on a
 * clear day and is labelled as cloud-free potential.
 */
export interface WeekDay {
  date: string; // YYYY-MM-DD, city-local
  max: number | null;
  kind: UvKind | null;
  category: WhoCategory | null;
  cloudFreeOnly: boolean;
  protectFrom: string | null;
  protectUntil: string | null;
  sunset: string | null;
  isToday: boolean;
}

export interface Week {
  days: WeekDay[];
  highest: WeekDay | null;
  lowest: WeekDay | null;
  protectDays: number;
  commonLevel: WhoCategory | null;
}

const noonOf = (date: string) => new Date(`${date}T12:00:00Z`);

/**
 * UV through a clear day, scaled to the day's peak. Clear-sky UV tracks the
 * sun's height: roughly sin(altitude)^2.4, the same shape the demo data and
 * the satellite products show. Sampled every 15 minutes.
 */
export function bellCurve(date: string, peak: number, lat: number, lon: number): UvCurve {
  const st = sunTimes(noonOf(date), lat, lon);
  const shape = (t: number) => Math.pow(Math.max(0, Math.sin((sunAltitude(new Date(t), lat, lon) * Math.PI) / 180)), 2.4);
  const top = shape(st.noon.getTime()) || 1;
  const out: UvCurve = [];
  for (let m = -12 * 60; m <= 12 * 60; m += 15) {
    const t = st.noon.getTime() + m * 60_000;
    out.push({ time: new Date(t).toISOString(), uvi: (peak * shape(t)) / top });
  }
  return out;
}

function curveFor(uv: CityUv, date: string, max: number): UvCurve {
  const { city } = uv;
  const day = uv.uvCurve.filter((p) => localDate(new Date(p.time), city.tz) === date);
  // Use the forecast curve only if it covers the middle of that day.
  const hours = day.map((p) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: city.tz, hour: "numeric", hourCycle: "h23" }).format(new Date(p.time))));
  if (day.length >= 6 && hours.some((h) => h >= 11) && hours.some((h) => h <= 14)) return day;
  return bellCurve(date, max, city.lat, city.lon);
}

export function buildWeek(uv: CityUv, now = new Date()): Week {
  const { city } = uv;
  const today = localDate(now, city.tz);
  const night = uv.phase === "night";
  const raw: { date: string; max: number | null; kind: UvKind | null }[] = [
    ...(night ? [] : [{ date: today, max: uv.consensus.todayMax, kind: uv.consensus.headlineKind }]),
    ...uv.outlook.map((o) => ({ date: o.date, max: o.max, kind: o.kind })),
  ].slice(0, 7);

  const days: WeekDay[] = raw.map((d) => {
    const st = sunTimes(noonOf(d.date), city.lat, city.lon);
    let protectFrom: string | null = null, protectUntil: string | null = null;
    if (d.max !== null) {
      const b = bestHours(curveFor(uv, d.date, d.max), noonOf(d.date), city.lat, city.lon, new Date(0));
      protectFrom = b.protectFrom;
      protectUntil = b.protectUntil;
    }
    return {
      date: d.date,
      max: d.max === null ? null : round1(d.max),
      kind: d.kind,
      category: whoCategory(d.max),
      cloudFreeOnly: d.kind === "clear-sky",
      protectFrom,
      protectUntil,
      sunset: st.sunset?.toISOString() ?? null,
      isToday: d.date === today,
    };
  });

  const known = days.filter((d) => d.max !== null);
  // "Strongest" should be a day with a real cloud forecast when there is one,
  // not the cloud-free potential of a day too far ahead to forecast cloud.
  const forecast = known.filter((d) => !d.cloudFreeOnly);
  const highest = (forecast.length ? forecast : known).reduce<WeekDay | null>((a, d) => (!a || (d.max ?? 0) > (a.max ?? 0) ? d : a), null);
  const lowest = known.reduce<WeekDay | null>((a, d) => (!a || (d.max ?? 99) < (a.max ?? 99) ? d : a), null);
  const counts = new Map<WhoCategory, number>();
  for (const d of known) if (d.category) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
  const commonLevel = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { days, highest, lowest, protectDays: known.filter((d) => Math.round(d.max!) >= 3).length, commonLevel };
}
