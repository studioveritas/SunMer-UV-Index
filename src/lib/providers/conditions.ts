import type { Spot } from "../config/spots";
import { cachedFetch } from "./base";

/**
 * Ground conditions that change UV exposure, via Open-Meteo:
 *  - snow: hourly snow depth and 48 h snowfall at the slopes altitude
 *    (Open-Meteo downscales to the `elevation` we pass).
 *  - sea: wave height and sea-surface temperature from the Marine API.
 * Failures return nulls; the UV reading never depends on these.
 */
export interface SpotConditions {
  snowDepthM: number | null;
  freshCm48h: number | null;
  waveM: number | null;
  wavePeriodS: number | null;
  seaC: number | null;
}

const EMPTY: SpotConditions = { snowDepthM: null, freshCm48h: null, waveM: null, wavePeriodS: null, seaC: null };

function nearestNow(times: string[], values: (number | null)[]): number | null {
  const now = Date.now();
  let best: number | null = null;
  let gap = Infinity;
  times.forEach((t, i) => {
    const v = values[i];
    const d = Math.abs(Date.parse(`${t}Z`) - now);
    if (typeof v === "number" && d < gap) { gap = d; best = v; }
  });
  return best;
}

export function parseSnow(json: any): Pick<SpotConditions, "snowDepthM" | "freshCm48h"> {
  const depth = nearestNow(json?.hourly?.time ?? [], json?.hourly?.snow_depth ?? []);
  const sums: (number | null)[] = json?.daily?.snowfall_sum ?? [];
  // past_days=2 + today: the first three values are the last 48 h plus today so far.
  const fresh = sums.slice(0, 3).reduce<number>((a, v) => a + (typeof v === "number" ? v : 0), 0);
  return { snowDepthM: depth, freshCm48h: sums.length ? Math.round(fresh * 10) / 10 : null };
}

export function parseMarine(json: any): Pick<SpotConditions, "waveM" | "wavePeriodS" | "seaC"> {
  const t = json?.hourly?.time ?? [];
  return {
    waveM: nearestNow(t, json?.hourly?.wave_height ?? []),
    wavePeriodS: nearestNow(t, json?.hourly?.wave_period ?? []),
    seaC: nearestNow(t, json?.hourly?.sea_surface_temperature ?? []),
  };
}

export async function getConditions(spot: Spot): Promise<SpotConditions> {
  const key = process.env.OPEN_METEO_API_KEY;
  const k = key ? `&apikey=${key}` : "";
  try {
    if (spot.kind === "ski") {
      const host = key ? "customer-api.open-meteo.com" : "api.open-meteo.com";
      const url = `https://${host}/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}&elevation=${spot.slopes ?? spot.base}` +
        `&hourly=snow_depth&daily=snowfall_sum&past_days=2&forecast_days=1&timezone=GMT${k}`;
      const res = await cachedFetch(url, 60);
      return { ...EMPTY, ...parseSnow(await res.json()) };
    }
    const host = key ? "customer-marine-api.open-meteo.com" : "marine-api.open-meteo.com";
    const url = `https://${host}/v1/marine?latitude=${spot.lat}&longitude=${spot.lon}` +
      `&hourly=wave_height,wave_period,sea_surface_temperature&forecast_days=1&timezone=GMT${k}`;
    const res = await cachedFetch(url, 60);
    return { ...EMPTY, ...parseMarine(await res.json()) };
  } catch {
    return EMPTY;
  }
}
