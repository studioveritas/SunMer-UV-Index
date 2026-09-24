import type { City, CityUv, UvReading } from "./types";
import { PROVIDERS } from "./providers";
import { emptyReading } from "./providers/base";
import { buildConsensus } from "./consensus";
import { CITIES } from "./config/cities";

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
  const readings: UvReading[] = await Promise.all(
    PROVIDERS.map((p) => {
      if (!p.covers(city)) return Promise.resolve(emptyReading(p.meta, "not_covered"));
      if (!p.isConfigured()) return Promise.resolve(emptyReading(p.meta, "not_configured"));
      return p.fetchCity(city); // adapters never throw; failures become status "error"
    }),
  );
  return {
    city,
    readings,
    consensus: buildConsensus(readings),
    generatedAt: new Date().toISOString(),
  };
}

export async function getAllCitiesUv(): Promise<CityUv[]> {
  return pool(CITIES, 4, getCityUv);
}
