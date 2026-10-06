import type { City, ProviderMeta, UvReading } from "../types";
import { cachedFetch, emptyReading, errorMessage, type Provider } from "./base";
import { currentFromHourly, dailyMaxFromHourly, localDate } from "../time";

/**
 * Copernicus Atmosphere Monitoring Service (EU) via the Open-Meteo
 * air-quality API. Hourly cloud-adjusted `uv_index`.
 * Free for non-commercial use; set OPEN_METEO_API_KEY for commercial use.
 * Attribution to CAMS AND Open-Meteo is required.
 */
const meta: ProviderMeta = {
  id: "cams",
  name: "Copernicus CAMS",
  institute: "ECMWF / Copernicus Atmosphere Monitoring Service (EU)",
  country: "EU",
  kind: "cloud-adjusted",
  resolution: "hourly",
  licence: "CC BY 4.0 (Copernicus / Open-Meteo)",
  attribution: "Generated using Copernicus Atmosphere Monitoring Service information, via Open-Meteo.com",
  url: "https://open-meteo.com/en/docs/air-quality-api",
  revalidateMinutes: 60,
};

export function parseOpenMeteo(json: any): { time: string; uvi: number }[] {
  const times: string[] = json?.hourly?.time ?? [];
  const values: (number | null)[] = json?.hourly?.uv_index ?? [];
  return times
    .map((t, i) => ({ time: new Date(`${t}Z`).toISOString(), uvi: values[i] }))
    .filter((h): h is { time: string; uvi: number } => typeof h.uvi === "number");
}

export const cams: Provider = {
  meta,
  isConfigured: () => true,
  covers: () => true,
  async fetchCity(city: City): Promise<UvReading> {
    try {
      const key = process.env.OPEN_METEO_API_KEY;
      const host = key ? "customer-air-quality-api.open-meteo.com" : "air-quality-api.open-meteo.com";
      const url =
        `https://${host}/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}` +
        `&hourly=uv_index&timezone=GMT&forecast_days=5` +
        (key ? `&apikey=${key}` : "");
      const res = await cachedFetch(url, meta.revalidateMinutes);
      const hourly = parseOpenMeteo(await res.json());
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
