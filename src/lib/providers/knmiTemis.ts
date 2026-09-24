import type { City, ProviderMeta, UvReading } from "../types";
import { cachedFetch, emptyReading, errorMessage, type Provider } from "./base";
import { localDate } from "../time";

/**
 * KNMI (NL) — TEMIS clear-sky UV index forecast at local solar noon,
 * today + 5 days, 0.25° grid, based on assimilated satellite ozone.
 * Updated once a day (~05:00 UTC). No key.
 *
 * v1 reads the per-location page; it is the lightest integration.
 * Upgrade path: the global forecast netCDF (uvief_fc.nc), or KNMI Data
 * Platform dataset `uv_index` v1.0 (needs a free API key) for NL detail.
 */
const meta: ProviderMeta = {
  id: "knmi-temis",
  name: "KNMI / TEMIS",
  institute: "Royal Netherlands Meteorological Institute (KNMI)",
  country: "NL",
  kind: "clear-sky",
  resolution: "solar-noon",
  licence: "KNMI open data (CC BY 4.0)",
  attribution: "UV forecast: KNMI / TEMIS",
  url: "https://www.temis.nl/uvradiation/UVindex.php",
  revalidateMinutes: 360,
};

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** Parses rows like "24 Sep 2026 | 12.8 | 267.2 DU" out of the HTML table. */
export function parseTemis(html: string): { date: string; max: number }[] {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const re = /(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?) DU/g;
  const out: { date: string; max: number }[] = [];
  for (const m of text.matchAll(re)) {
    out.push({
      date: `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`,
      max: Number(m[4]),
    });
  }
  return out;
}

export const knmiTemis: Provider = {
  meta,
  isConfigured: () => true,
  // TEMIS is global; KNMI is also the source of the ozone used by CAMS & DWD.
  covers: () => true,
  async fetchCity(city: City): Promise<UvReading> {
    try {
      const url = `https://www.temis.nl/uvradiation/nrt/uvindex.php?lon=${city.lon.toFixed(2)}&lat=${city.lat.toFixed(2)}`;
      const res = await cachedFetch(url, meta.revalidateMinutes);
      const daily = parseTemis(await res.text());
      if (daily.length === 0) throw new Error("TEMIS page format changed: no rows parsed");
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
