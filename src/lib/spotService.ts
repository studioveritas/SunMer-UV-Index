import type { CityUv } from "./types";
import { getCityUv } from "./service";
import { SEA_SPOTS, SNOW_SPOTS, type Spot } from "./config/spots";
import { getConditions, type SpotConditions } from "./providers/conditions";
import { demoMode } from "./demo";
import { round1 } from "./time";
import { whoCategory } from "./who";
import {
  ALT_RATE, SURFACES, altitudeFactor, faceFactor, seaSurface, snowIndexFactor, snowSurface, type Surface,
} from "./exposure";

export interface Rung { label: string; m: number; uvi: number | null; low: number | null; high: number | null }

export interface SpotUv {
  spot: Spot;
  /** The spot's UV at its headline altitude (slopes for ski, sea level otherwise). Same shape as a city. */
  uv: CityUv;
  /** What the forecast says before altitude and snow corrections. */
  raw: number | null;
  /** Multiplier applied to every UV value: altitude × snow-on-index. */
  factor: number;
  headlineM: number;
  surface: Surface;
  albedo: number;
  /** Extra dose on the face from reflection, × the index. */
  face: number;
  /** Face-dose peak: headline peak × face factor. */
  facePeak: number | null;
  ladder: Rung[];
  conditions: SpotConditions;
}

const scale = (v: number | null, f: number) => (v === null ? null : round1(v * f));

/** Multiply every UV figure in a CityUv by f (altitude and snow raise the whole day evenly). */
export function scaleUv(uv: CityUv, f: number): CityUv {
  if (f === 1) return uv;
  const c = uv.consensus;
  const todayMax = scale(c.todayMax, f);
  return {
    ...uv,
    consensus: {
      ...c,
      todayMax,
      current: scale(c.current, f),
      category: whoCategory(todayMax),
      cloudEffect: scale(c.cloudEffect, f),
      cloudAdjusted: { ...c.cloudAdjusted, median: scale(c.cloudAdjusted.median, f), spread: scale(c.cloudAdjusted.spread, f) },
      clearSky: { ...c.clearSky, median: scale(c.clearSky.median, f), spread: scale(c.clearSky.spread, f) },
    },
    readings: uv.readings.map((r) => ({
      ...r,
      current: scale(r.current, f),
      todayMax: scale(r.todayMax, f),
      daily: r.daily.map((d) => ({ ...d, max: round1(d.max * f) })),
      hourly: r.hourly.map((h) => ({ ...h, uvi: round1(h.uvi * f) })),
    })),
    hourlyCurve: uv.hourlyCurve.map((h) => ({ ...h, uvi: round1(h.uvi * f) })),
    uvCurve: uv.uvCurve.map((h) => ({ ...h, uvi: round1(h.uvi * f) })),
    outlook: uv.outlook.map((d) => {
      const max = scale(d.max, f);
      return { ...d, max, category: whoCategory(max), cloudAdjusted: scale(d.cloudAdjusted, f), clearSky: scale(d.clearSky, f) };
    }),
  };
}

function demoConditions(spot: Spot): SpotConditions {
  let h = 0;
  for (const ch of spot.slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = (h % 1000) / 1000;
  if (spot.kind === "ski") return { snowDepthM: spot.glacier ? 1.2 : round1(r * 0.8), freshCm48h: round1(r * 30), waveM: null, wavePeriodS: null, seaC: null };
  return { snowDepthM: null, freshCm48h: null, waveM: round1(0.6 + r * 2.4), wavePeriodS: Math.round(8 + r * 7), seaC: round1((spot.country === "GB" ? 10 : 14) + r * 3 - (spot.lat - 50) * 0.3) };
}

export async function getSpotUv(spot: Spot): Promise<SpotUv> {
  const [base, conditions] = await Promise.all([getCityUv(spot), demoMode ? demoConditions(spot) : getConditions(spot)]);
  const raw = base.consensus.todayMax;

  const surface: Surface = spot.kind === "ski"
    ? snowSurface({ depthM: conditions.snowDepthM, freshCm48h: conditions.freshCm48h }, spot.glacier)
    : seaSurface(spot.kind, conditions.waveM);
  const albedo = SURFACES[surface].albedo;
  const snowy = surface === "fresh-snow" || surface === "snow";

  const factorAt = (m: number, rate: number = ALT_RATE.central) =>
    altitudeFactor(spot.ref, m, rate) * (snowy ? snowIndexFactor(albedo, m) : 1);

  const headlineM = spot.kind === "ski" ? spot.slopes ?? spot.base : 0;
  const factor = factorAt(headlineM);
  const uv = scaleUv(base, factor);
  const face = faceFactor(albedo);

  const rung = (label: string, m: number): Rung => ({
    label,
    m,
    uvi: scale(raw, factorAt(m)),
    low: scale(raw, factorAt(m, ALT_RATE.low)),
    high: scale(raw, factorAt(m, ALT_RATE.high)),
  });
  const ladder = spot.kind === "ski"
    ? [rung("Summit", spot.summit ?? headlineM), rung("Slopes", headlineM), rung("Village", spot.base)]
    : [rung("Sea level", 0)];

  return { spot, uv, raw, factor: Math.round(factor * 100) / 100, headlineM, surface, albedo, face, facePeak: scale(uv.consensus.todayMax, face), ladder, conditions };
}

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

export const getSeaUv = () => pool(SEA_SPOTS, 4, getSpotUv);
export const getSnowUv = () => pool(SNOW_SPOTS, 4, getSpotUv);
