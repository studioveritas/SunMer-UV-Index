import type { City, ProviderMeta, UvReading } from "../types";
import { cachedFetch, emptyReading, errorMessage, type Provider } from "./base";
import { localDate } from "../time";

/**
 * Deutscher Wetterdienst (DE) — UV-Gefahrenindex open data (uvi.json).
 * Daily max UV (cloud-adjusted, integer) for selected stations: today,
 * tomorrow, day after. Updated once a day ~10:00. No key.
 * Coverage is station-based: cities are matched by German name.
 */
const meta: ProviderMeta = {
  id: "dwd",
  name: "DWD",
  institute: "Deutscher Wetterdienst (German national weather service)",
  country: "DE",
  kind: "cloud-adjusted",
  resolution: "daily-max",
  licence: "DWD open data (GeoNutzV / CC BY 4.0)",
  attribution: "Quelle: Deutscher Wetterdienst",
  url: "https://opendata.dwd.de/climate_environment/health/alerts/",
  revalidateMinutes: 180,
};

const URL = "https://opendata.dwd.de/climate_environment/health/alerts/uvi.json";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");

export function parseDwd(json: any, city: City): { date: string; max: number }[] | null {
  const names = (city.dwdNames ?? []).map(norm);
  const entry = (json?.content ?? []).find((c: any) => names.includes(norm(String(c.city))));
  if (!entry) return null;
  const base = new Date(`${json.forecast_day ?? localDate(new Date(), city.tz)}T12:00:00Z`);
  const day = (offset: number) => new Date(base.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  const f = entry.forecast ?? {};
  return [
    { date: day(0), max: f.today },
    { date: day(1), max: f.tomorrow },
    { date: day(2), max: f.dayafter_to },
  ].filter((d) => typeof d.max === "number");
}

export const dwd: Provider = {
  meta,
  isConfigured: () => true,
  covers: (city) => Boolean(city.dwdNames?.length),
  async fetchCity(city: City): Promise<UvReading> {
    try {
      const res = await cachedFetch(URL, meta.revalidateMinutes);
      const daily = parseDwd(await res.json(), city);
      if (!daily) return emptyReading(meta, "not_covered");
      const today = localDate(new Date(), city.tz);
      return {
        ...emptyReading(meta, "ok"),
        daily,
        todayMax: daily.find((d) => d.date === today)?.max ?? null,
      };
    } catch (e) {
      return emptyReading(meta, "error", errorMessage(e));
    }
  },
};
