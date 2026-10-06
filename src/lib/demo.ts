import type { City, CityUv, HourlyValue, UvReading } from "./types";
import { PROVIDERS } from "./providers";
import { emptyReading } from "./providers/base";
import { buildConsensus, buildHourlyCurve, buildOutlook } from "./consensus";
import { dailyMaxFromHourly, localDate, round1 } from "./time";
import { inBenelux } from "./providers/knmiObserved";

/**
 * Demo mode (UV_DEMO=1): plausible synthetic readings so design and QA can
 * work without API keys. Values follow latitude and a bell-shaped day.
 * Never enable in production — the UI shows a "Demo data" note.
 */
export const demoMode = process.env.UV_DEMO === "1";

function seed(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function dayCurve(city: City, dayOffset: number, peak: number, cloud: number): HourlyValue[] {
  const noonUtc = 12 - city.lon / 15;
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  const out: HourlyValue[] = [];
  for (let h = 0; h < 24; h++) {
    const t = new Date(base.getTime() + (dayOffset * 24 + h) * 3600_000);
    const x = (h + 0.5 - noonUtc) / 3.1;
    out.push({ time: t.toISOString(), uvi: round1(Math.max(0, peak * cloud * Math.exp(-x * x))) });
  }
  return out;
}

export function demoCityUv(city: City): CityUv {
  const rnd = seed(city.slug);
  const clearPeak = Math.max(1.5, 10.5 - (city.lat - 36) * 0.38) * (0.92 + rnd() * 0.12);
  const today = localDate(new Date(), city.tz);

  const readings: UvReading[] = PROVIDERS.map((p) => {
    if (!p.covers(city) || p.meta.id === "meteo-france") return emptyReading(p.meta, p.covers(city) ? "not_configured" : "not_covered");
    const clear = p.meta.kind === "clear-sky";
    const days = { "met-office": 2, cams: 5, dwd: 3, "knmi-temis": 6, "met-norway": 7 }[p.meta.id as string] ?? 3;
    let hourly: HourlyValue[] = [];
    for (let d = 0; d < days; d++) {
      const cloud = clear ? 1 : 0.55 + rnd() * 0.4;
      hourly = hourly.concat(dayCurve(city, d, clearPeak * (1 - d * 0.02) * (0.95 + rnd() * 0.1), cloud));
    }
    const daily = dailyMaxFromHourly(hourly, city.tz);
    const hourlyRes = p.meta.resolution === "hourly";
    return {
      ...emptyReading(p.meta, "ok"),
      hourly: hourlyRes ? hourly : [],
      daily,
      todayMax: daily.find((d) => d.date === today)?.max ?? null,
      current: hourlyRes ? hourly.find((h) => Math.abs(Date.parse(h.time) + 1800_000 - Date.now()) <= 1800_000)?.uvi ?? null : null,
    };
  });

  const hourlyCurve = buildHourlyCurve(readings);
  const consensus = buildConsensus(readings);
  const observedSeries = inBenelux(city)
    ? hourlyCurve
        .filter((h) => localDate(new Date(h.time), city.tz) === today)
        .flatMap((h) => [0, 15, 30, 45].map((m) => {
          const time = new Date(Date.parse(h.time) + m * 60_000).toISOString();
          const past = Date.parse(time) <= Date.now();
          return { time, uvi: past ? round1(h.uvi * (0.85 + rnd() * 0.3)) : null, clear: round1(h.uvi / 0.7) };
        }))
    : [];
  const valid = observedSeries.filter((p) => p.uvi !== null) as { time: string; uvi: number }[];

  return {
    city,
    readings,
    consensus: valid.length ? { ...consensus, current: valid[valid.length - 1].uvi, currentSource: "observed" } : consensus,
    hourlyCurve,
    outlook: buildOutlook(readings, today),
    observed: inBenelux(city)
      ? { source: "knmi-benelux", status: "ok", series: observedSeries, latest: valid.at(-1) ?? null, peakSoFar: valid.length ? Math.max(...valid.map((v) => v.uvi)) : null, fileTime: null }
      : { source: "knmi-benelux", status: "not_covered", series: [], latest: null, peakSoFar: null, fileTime: null },
    generatedAt: new Date().toISOString(),
  };
}
