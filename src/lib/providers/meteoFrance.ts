import type { City, ProviderMeta, UvReading } from "../types";
import { cachedFetch, emptyReading, errorMessage, type Provider } from "./base";
import { localDate } from "../time";

/**
 * Météo-France (FR) — UV index forecast API (announced 18 June 2026,
 * product "UVQ": daily max per commune, with-cloud and clear-sky).
 *
 * STATUS: scaffolded, off by default. The public endpoint schema must be
 * confirmed on portail-api.meteofrance.fr before this goes live.
 * Set METEOFRANCE_UV_URL to a template containing {lat} and {lon}, and
 * adapt `parseMeteoFrance` to the documented response.
 */
const meta: ProviderMeta = {
  id: "meteo-france",
  name: "Météo-France",
  institute: "Météo-France (French national weather service)",
  country: "FR",
  kind: "cloud-adjusted",
  resolution: "daily-max",
  licence: "Etalab Open Licence 2.0",
  attribution: "Source : Météo-France",
  url: "https://portail-api.meteofrance.fr/",
  revalidateMinutes: 180,
};

/** TODO: align with the official response schema once confirmed. */
export function parseMeteoFrance(json: any): { date: string; max: number }[] {
  const rows: any[] = json?.forecast ?? json?.data ?? [];
  return rows
    .map((r) => ({ date: String(r.date).slice(0, 10), max: Number(r.uv ?? r.uv_max ?? r.value) }))
    .filter((r) => Number.isFinite(r.max));
}

export const meteoFrance: Provider = {
  meta,
  isConfigured: () => Boolean(process.env.METEOFRANCE_UV_URL && process.env.METEOFRANCE_API_KEY),
  covers: (city) => city.country === "FR",
  async fetchCity(city: City): Promise<UvReading> {
    try {
      const url = process.env.METEOFRANCE_UV_URL!
        .replace("{lat}", String(city.lat))
        .replace("{lon}", String(city.lon));
      const res = await cachedFetch(url, meta.revalidateMinutes, {
        headers: { apikey: process.env.METEOFRANCE_API_KEY!, accept: "application/json" },
      });
      const daily = parseMeteoFrance(await res.json());
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
