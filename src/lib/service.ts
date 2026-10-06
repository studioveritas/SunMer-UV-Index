import type { City, CityUv, UvReading } from "./types";
import { PROVIDERS } from "./providers";
import { emptyReading } from "./providers/base";
import { getObserved } from "./providers/knmiObserved";
import { buildConsensus, buildHourlyCurve, buildOutlook } from "./consensus";
import { CITIES } from "./config/cities";
import { localDate } from "./time";
import { demoCityUv, demoMode } from "./demo";

/** Small concurrency limiter so a cold cache doesn't burst upstream services. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function getCityUv(city: City): Promise<CityUv> {
  if (demoMode) return demoCityUv(city);
  const [readings, observed] = await Promise.all([
    Promise.all(
      PROVIDERS.map((p): Promise<UvReading> => {
        if (!p.covers(city)) return Promise.resolve(emptyReading(p.meta, "not_covered"));
        if (!p.isConfigured()) return Promise.resolve(emptyReading(p.meta, "not_configured"));
        return p.fetchCity(city); // adapters never throw; failures become status "error"
      }),
    ),
    getObserved(city),
  ]);

  const consensus = buildConsensus(readings);

  // Measured beats modelled: if KNMI observed UV in the last 30 minutes, it is "right now".
  if (observed.latest && Date.now() - Date.parse(observed.latest.time) < 30 * 60_000) {
    consensus.current = observed.latest.uvi;
    consensus.currentSource = "observed";
  }

  return {
    city,
    readings,
    consensus,
    hourlyCurve: buildHourlyCurve(readings),
    outlook: buildOutlook(readings, localDate(new Date(), city.tz)),
    observed,
    generatedAt: new Date().toISOString(),
  };
}

export async function getAllCitiesUv(): Promise<CityUv[]> {
  return pool(CITIES, 4, getCityUv);
}
