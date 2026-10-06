/**
 * Core data model.
 *
 * Key design decision: UV "clear-sky" and UV "cloud-adjusted" are two
 * different truths and must never be averaged together.
 *   - clear-sky      = the sun's potential (what the sky COULD deliver)
 *   - cloud-adjusted = the expected reality under forecast cloud
 * The consensus engine keeps them apart and reports both.
 */

export type ProviderId =
  | "met-office"
  | "knmi-temis"
  | "met-norway"
  | "cams"
  | "dwd"
  | "meteo-france";

export type UvKind = "cloud-adjusted" | "clear-sky";
export type Resolution = "hourly" | "daily-max" | "solar-noon";
export type ReadingStatus = "ok" | "error" | "not_configured" | "not_covered";

export interface City {
  slug: string;
  name: string;
  country: string; // ISO 3166-1 alpha-2
  lat: number;
  lon: number;
  tz: string; // IANA timezone, used to decide what "today" means locally
  /** Station names as they appear in DWD's uvi.json (German spelling). */
  dwdNames?: string[];
}

export interface DailyValue {
  date: string; // YYYY-MM-DD in the city's local time
  max: number;
}

export interface HourlyValue {
  time: string; // ISO-8601 UTC
  uvi: number;
}

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  institute: string;
  country: string;
  kind: UvKind;
  resolution: Resolution;
  licence: string;
  attribution: string;
  url: string;
  /** Minutes the upstream data may be cached for. */
  revalidateMinutes: number;
}

export interface UvReading {
  provider: ProviderId;
  status: ReadingStatus;
  kind: UvKind;
  resolution: Resolution;
  /** Value for the current hour, only when the source is hourly. */
  current: number | null;
  /** Peak UV today (local date). */
  todayMax: number | null;
  daily: DailyValue[];
  hourly: HourlyValue[];
  fetchedAt: string;
  error?: string;
}

export type WhoCategory = "low" | "moderate" | "high" | "very-high" | "extreme";
export type Confidence = "high" | "medium" | "low" | "none";

export interface Consensus {
  /** Headline number: cloud-adjusted median if any, else clear-sky median. */
  todayMax: number | null;
  headlineKind: UvKind | null;
  cloudAdjusted: { median: number | null; n: number; spread: number | null };
  clearSky: { median: number | null; n: number; spread: number | null };
  /** How much cloud is expected to take off the peak (clear-sky minus cloud-adjusted). */
  cloudEffect: number | null;
  current: number | null;
  /** "observed" when KNMI satellite data is fresher than the forecast. */
  currentSource: "observed" | "forecast" | null;
  category: WhoCategory | null;
  confidence: Confidence;
  sourcesOk: number;
}

export interface OutlookDay {
  date: string;
  /** Headline for the day: cloud-adjusted median if any source reaches that far, else clear-sky. */
  max: number | null;
  kind: UvKind | null;
  category: WhoCategory | null;
  cloudAdjusted: number | null;
  clearSky: number | null;
  sources: number;
}

/** KNMI satellite-derived UV, every 15 min, Benelux only. Measured, not forecast. */
export interface ObservedLayer {
  source: "knmi-benelux";
  status: "ok" | "error" | "not_configured" | "not_covered";
  /** Quarter-hourly cloud-modified UV (null where KNMI has no value). */
  series: { time: string; uvi: number | null; clear: number | null }[];
  latest: { time: string; uvi: number } | null;
  peakSoFar: number | null;
  fileTime: string | null;
  error?: string;
}

export interface CityUv {
  city: City;
  consensus: Consensus;
  readings: UvReading[];
  /** Hour-by-hour cloud-adjusted median across sources (drives burn time). */
  hourlyCurve: HourlyValue[];
  /** Days after today, up to 6. */
  outlook: OutlookDay[];
  observed: ObservedLayer;
  generatedAt: string;
}
