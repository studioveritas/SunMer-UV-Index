import type { City } from "./types";
import { fetchRivmYear, RIVM_STATION, type GroundPoint } from "./providers/rivm";
import { getObserved } from "./providers/knmiObserved";
import { getCityUv } from "./service";
import { store } from "./store";
import { localDate, round1 } from "./time";
import { demoMode } from "./demo";

/**
 * Ground truth: KNMI satellite UV vs RIVM's spectroradiometer at Bilthoven,
 * plus a running scoreboard of how well each forecast service predicted
 * Bilthoven's measured daily peak.
 */

export const BILTHOVEN: City = {
  slug: "bilthoven", name: "Bilthoven", country: "NL",
  lat: RIVM_STATION.lat, lon: RIVM_STATION.lon, tz: "Europe/Amsterdam",
};

export interface Pair { time: string; ground: number; satellite: number }
export interface Stats { n: number; bias: number | null; mae: number | null; rmse: number | null; r: number | null }

/** Pair each ground reading with the satellite value nearest in time (within tolerance). */
export function pairSeries(ground: GroundPoint[], satellite: { time: string; uvi: number | null }[], toleranceMin = 8): Pair[] {
  const sat = satellite.filter((s): s is { time: string; uvi: number } => s.uvi !== null).map((s) => ({ t: Date.parse(s.time), v: s.uvi }));
  const pairs: Pair[] = [];
  for (const g of ground) {
    const t = Date.parse(g.time);
    let best: { t: number; v: number } | null = null;
    for (const s of sat) if (!best || Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
    if (best && Math.abs(best.t - t) <= toleranceMin * 60_000) pairs.push({ time: g.time, ground: g.uvi, satellite: best.v });
  }
  return pairs;
}

export function stats(pairs: { ground: number; satellite: number }[], minGround = 0.5): Stats {
  // Ignore near-zero dawn/dusk values: they inflate agreement without saying anything.
  const p = pairs.filter((x) => x.ground >= minGround || x.satellite >= minGround);
  const n = p.length;
  if (n === 0) return { n, bias: null, mae: null, rmse: null, r: null };
  const d = p.map((x) => x.satellite - x.ground);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const mg = mean(p.map((x) => x.ground)), ms = mean(p.map((x) => x.satellite));
  const cov = mean(p.map((x) => (x.ground - mg) * (x.satellite - ms)));
  const sg = Math.sqrt(mean(p.map((x) => (x.ground - mg) ** 2)));
  const ss = Math.sqrt(mean(p.map((x) => (x.satellite - ms) ** 2)));
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    n,
    bias: r2(mean(d)),
    mae: r2(mean(d.map(Math.abs))),
    rmse: r2(Math.sqrt(mean(d.map((v) => v * v)))),
    r: sg && ss ? r2(cov / (sg * ss)) : null,
  };
}

/** Daily peak from ground data, smoothed with a 3-point running median so one cloud gap doesn't set the record. */
export function groundDailyPeak(points: GroundPoint[], date: string, tz = "Europe/Amsterdam"): number | null {
  const day = points.filter((p) => localDate(new Date(p.time), tz) === date).map((p) => p.uvi);
  if (day.length < 3) return null;
  let peak = 0;
  for (let i = 1; i < day.length - 1; i++) peak = Math.max(peak, [day[i - 1], day[i], day[i + 1]].sort((a, b) => a - b)[1]);
  return round1(peak);
}

/* ---------- Forecast scoreboard (recorded every morning by the cron) ---------- */

const fcKey = (date: string) => `val:fc:${date}`;

export async function recordForecasts(): Promise<string> {
  const uv = await getCityUv(BILTHOVEN);
  const date = localDate(new Date(), BILTHOVEN.tz);
  const row: Record<string, { kind: string; max: number }> = {};
  for (const r of uv.readings) if (r.status === "ok" && r.todayMax !== null) row[r.provider] = { kind: r.kind, max: r.todayMax };
  if (uv.consensus.todayMax !== null) row["consensus"] = { kind: uv.consensus.headlineKind ?? "cloud-adjusted", max: uv.consensus.todayMax };
  await store.set(fcKey(date), JSON.stringify(row), 400 * 86400);
  return date;
}

export interface ScoreRow { source: string; kind: string; n: number; bias: number | null; mae: number | null }

export function scoreForecasts(
  days: { date: string; forecast: Record<string, { kind: string; max: number }>; measured: number | null }[],
): ScoreRow[] {
  const by = new Map<string, { kind: string; errs: number[] }>();
  for (const d of days) {
    if (d.measured === null) continue;
    for (const [source, f] of Object.entries(d.forecast)) {
      const e = by.get(source) ?? { kind: f.kind, errs: [] };
      e.errs.push(f.max - d.measured);
      by.set(source, e);
    }
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return [...by.entries()]
    .map(([source, { kind, errs }]) => ({
      source, kind, n: errs.length,
      bias: errs.length ? r2(errs.reduce((a, b) => a + b, 0) / errs.length) : null,
      mae: errs.length ? r2(errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length) : null,
    }))
    .sort((a, b) => (a.mae ?? 99) - (b.mae ?? 99));
}

/* ---------- Page data ---------- */

export interface ValidationData {
  date: string;
  ground: GroundPoint[];
  satellite: { time: string; uvi: number | null }[];
  today: Stats;
  groundPeak: number | null;
  satellitePeak: number | null;
  scoreboard: ScoreRow[];
  scoreDays: number;
  status: { ground: string; satellite: string };
}

export async function getValidation(days = 60): Promise<ValidationData> {
  if (demoMode) return (await import("./demo")).demoValidation();
  const now = new Date();
  const date = localDate(now, BILTHOVEN.tz);
  let ground: GroundPoint[] = [];
  let groundStatus = "ok";
  try {
    ground = await fetchRivmYear(now.getUTCFullYear());
  } catch (e) {
    groundStatus = e instanceof Error ? e.message : String(e);
  }
  const observed = await getObserved(BILTHOVEN);
  const groundToday = ground.filter((g) => localDate(new Date(g.time), BILTHOVEN.tz) === date);

  const history: { date: string; forecast: Record<string, { kind: string; max: number }>; measured: number | null }[] = [];
  for (let i = 1; i <= days; i++) {
    const d = localDate(new Date(now.getTime() - i * 86_400_000), BILTHOVEN.tz);
    const raw = await store.get(fcKey(d));
    if (raw) history.push({ date: d, forecast: JSON.parse(raw), measured: groundDailyPeak(ground, d) });
  }

  const sat = observed.series.filter((s) => s.uvi !== null) as { time: string; uvi: number }[];
  return {
    date,
    ground: groundToday,
    satellite: observed.series,
    today: stats(pairSeries(groundToday, observed.series)),
    groundPeak: groundDailyPeak(ground, date),
    satellitePeak: sat.length ? Math.max(...sat.map((s) => s.uvi)) : null,
    scoreboard: scoreForecasts(history),
    scoreDays: history.length,
    status: { ground: groundStatus, satellite: observed.status === "ok" ? "ok" : observed.error ?? observed.status },
  };
}
