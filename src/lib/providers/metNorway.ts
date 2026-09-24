import type { City, ProviderMeta, UvReading } from "../types";
import { cachedFetch, emptyReading, errorMessage, type Provider } from "./base";
import { currentFromHourly, dailyMaxFromHourly, localDate } from "../time";

/**
 * MET Norway — Locationforecast 2.0 "complete".
 * Variable: ultraviolet_index_clear_sky (hourly, cloud-free).
 * No key; an identifying User-Agent is mandatory under their terms.
 * Coordinates are truncated to 4 decimals as the terms request.
 * Docs: https://api.met.no/doc/locationforecast/datamodel
 */
const meta: ProviderMeta = {
  id: "met-norway",
  name: "MET Norway",
  institute: "Norwegian Meteorological Institute",
  country: "NO",
  kind: "clear-sky",
  resolution: "hourly",
  licence: "CC BY 4.0 / NLOD",
  attribution: "Data from MET Norway",
  url: "https://api.met.no/",
  revalidateMinutes: 60,
};

export function parseMetNorway(json: unknown): { time: string; uvi: number }[] {
  const ts: any[] = (json as any)?.properties?.timeseries ?? [];
  return ts
    .map((t) => ({
      time: t.time as string,
      uvi: t?.data?.instant?.details?.ultraviolet_index_clear_sky as number | undefined,
    }))
    .filter((t): t is { time: string; uvi: number } => typeof t.uvi === "number");
}

export const metNorway: Provider = {
  meta,
  isConfigured: () => Boolean(process.env.METNO_USER_AGENT),
  covers: () => true,
  async fetchCity(city: City): Promise<UvReading> {
    try {
      const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${city.lat.toFixed(4)}&lon=${city.lon.toFixed(4)}`;
      const res = await cachedFetch(url, meta.revalidateMinutes, {
        headers: { "User-Agent": process.env.METNO_USER_AGENT! },
      });
      const hourly = parseMetNorway(await res.json());
      const daily = dailyMaxFromHourly(hourly, city.tz);
      const today = localDate(new Date(), city.tz);
      return {
        ...emptyReading(meta, "ok"),
        hourly,
        daily,
        current: currentFromHourly(hourly),
        todayMax: daily.find((d) => d.date === today)?.max ?? null,
      };
    } catch (e) {
      return emptyReading(meta, "error", errorMessage(e));
    }
  },
};
