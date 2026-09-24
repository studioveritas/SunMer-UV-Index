import type { City, ProviderMeta, UvReading } from "../types";
import { cachedFetch, emptyReading, errorMessage, type Provider } from "./base";
import { currentFromHourly, dailyMaxFromHourly, localDate } from "../time";

/**
 * Met Office (UK) — Weather DataHub, Site-Specific "Global Spot" hourly.
 * Cloud-adjusted UV index per hour, any lat/lon worldwide.
 * Auth: `apikey` header. Free tier: 360 calls/day.
 * Docs: https://datahub.metoffice.gov.uk/
 */
const meta: ProviderMeta = {
  id: "met-office",
  name: "Met Office",
  institute: "Met Office (UK national weather service)",
  country: "GB",
  kind: "cloud-adjusted",
  resolution: "hourly",
  licence: "Met Office Weather DataHub terms",
  attribution: "Contains Met Office data",
  url: "https://datahub.metoffice.gov.uk/",
  revalidateMinutes: Number(process.env.MET_OFFICE_REFRESH_MINUTES ?? 180),
};

const BASE = "https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point/hourly";

interface MetOfficeHour {
  time: string;
  uvIndex?: number;
}

export function parseMetOffice(json: unknown): { time: string; uvi: number }[] {
  const series: MetOfficeHour[] =
    (json as any)?.features?.[0]?.properties?.timeSeries ?? [];
  return series
    .filter((h) => typeof h.uvIndex === "number")
    .map((h) => ({
      // Met Office uses e.g. "2026-09-24T10:00Z"
      time: new Date(h.time).toISOString(),
      uvi: h.uvIndex as number,
    }));
}

export const metOffice: Provider = {
  meta,
  isConfigured: () => Boolean(process.env.MET_OFFICE_API_KEY),
  covers: () => true,
  async fetchCity(city: City): Promise<UvReading> {
    try {
      const url = `${BASE}?latitude=${city.lat.toFixed(4)}&longitude=${city.lon.toFixed(4)}&excludeParameterMetadata=true`;
      const res = await cachedFetch(url, meta.revalidateMinutes, {
        headers: { apikey: process.env.MET_OFFICE_API_KEY!, accept: "application/json" },
      });
      const hourly = parseMetOffice(await res.json());
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
