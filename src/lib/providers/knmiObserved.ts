import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unstable_cache } from "next/cache";
import type { City, ObservedLayer } from "../types";
import { CITIES } from "../config/cities";
import { RIVM_STATION } from "./rivm";
import { localDate, round1 } from "../time";

/**
 * KNMI high-resolution Benelux layer.
 *
 * Dataset: "Cloud-modified UV index Benelux" on the KNMI Data Platform.
 * Satellite ozone + cloud observations, every quarter hour, 03:00–21:45 UTC,
 * variables `uvi_clear` and `uvi_cloudy`, NetCDF4, fill value -1.
 * Coverage: 2.25–7.75°E, 49.25–54.00°N (Amsterdam, Rotterdam, Brussels, Luxembourg).
 *
 * This is the only *measured* layer in the app. Everything else is forecast.
 * It is shown as "observed today" and powers "right now" for Benelux cities.
 */

const API = "https://api.dataplatform.knmi.nl/open-data/v1";
const DATASET = process.env.KNMI_UV_DATASET ?? "cloud_modified_UV_index_benelux";
const VERSION = process.env.KNMI_UV_VERSION ?? "1.0";
const BBOX = { west: 2.25, east: 7.75, south: 49.25, north: 54.0 };

export const knmiObservedMeta = {
  name: "KNMI Benelux (observed)",
  attribution: "UV observations: KNMI, CC BY 4.0",
  url: "https://dataplatform.knmi.nl/dataset/cloud-modified-uv-index-benelux-1-0",
};

export function inBenelux(city: City): boolean {
  return city.lon >= BBOX.west && city.lon <= BBOX.east && city.lat >= BBOX.south && city.lat <= BBOX.north;
}

function empty(status: ObservedLayer["status"], error?: string): ObservedLayer {
  return { source: "knmi-benelux", status, series: [], latest: null, peakSoFar: null, fileTime: null, ...(error ? { error } : {}) };
}

/* ---------------- NetCDF4 reading (pure, testable) ---------------- */

type H5File = { keys(): string[]; get(p: string): any };

/** Find a dataset anywhere in the file by one of several names (case-insensitive). */
function findDataset(f: H5File, names: string[], prefix = ""): any | null {
  const wanted = names.map((n) => n.toLowerCase());
  const node = prefix ? f.get(prefix) : f;
  for (const key of node.keys()) {
    const p = prefix ? `${prefix}/${key}` : key;
    const item = f.get(p);
    if (item?.type === "Dataset" && wanted.includes(key.toLowerCase())) return item;
    if (item?.type === "Group") {
      const hit = findDataset(f, names, p);
      if (hit) return hit;
    }
  }
  return null;
}

function attr(ds: any, name: string): string | undefined {
  const v = ds?.attrs?.[name]?.value;
  return v === undefined ? undefined : String(v);
}

/** CF time: "<unit> since <iso>" -> Date[] */
export function decodeCfTime(values: ArrayLike<number>, units: string): string[] {
  const m = /^(seconds|minutes|hours|days) since (.+)$/i.exec(units.trim());
  if (!m) throw new Error(`Unsupported time units "${units}"`);
  const scale = { seconds: 1e3, minutes: 6e4, hours: 3.6e6, days: 8.64e7 }[m[1].toLowerCase() as "seconds"];
  const iso = m[2].trim().replace(" ", "T");
  const origin = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Array.from(values, (v) => new Date(origin + v * scale).toISOString());
}

function nearest(arr: ArrayLike<number>, target: number): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (Math.abs(arr[i] - target) < Math.abs(arr[best] - target)) best = i;
  return best;
}

/**
 * Extract the (time series) value at the grid cell nearest to each city.
 * Works out the dimension order from array lengths, so it tolerates
 * (time, lat, lon) or (time, lon, lat) layouts.
 */
export function extractCities(f: H5File, cities: City[]) {
  const latDs = findDataset(f, ["latitude", "lat"]);
  const lonDs = findDataset(f, ["longitude", "lon"]);
  const timeDs = findDataset(f, ["time"]);
  const cloudyDs = findDataset(f, ["uvi_cloudy"]);
  const clearDs = findDataset(f, ["uvi_clear"]);
  if (!latDs || !lonDs || !timeDs || !cloudyDs) throw new Error("KNMI file: expected latitude/longitude/time/uvi_cloudy");

  const lats = latDs.value as ArrayLike<number>;
  const lons = lonDs.value as ArrayLike<number>;
  const times = decodeCfTime(timeDs.value, attr(timeDs, "units") ?? "seconds since 1970-01-01 00:00:00");
  const shape: number[] = cloudyDs.shape;
  const tAxis = shape.indexOf(times.length);
  const latAxis = shape.findIndex((n, i) => i !== tAxis && n === lats.length);
  const lonAxis = shape.findIndex((n, i) => i !== tAxis && i !== latAxis && n === lons.length);
  if (tAxis < 0 || latAxis < 0 || lonAxis < 0) throw new Error(`KNMI file: cannot map shape [${shape}]`);

  const strides = shape.map((_, i) => shape.slice(i + 1).reduce((a, b) => a * b, 1));
  const cloudy = cloudyDs.value as ArrayLike<number>;
  const clear = clearDs?.value as ArrayLike<number> | undefined;
  const clean = (v: number | undefined) => (v === undefined || v < 0 || !Number.isFinite(v) ? null : round1(v));

  const out: Record<string, { time: string; uvi: number | null; clear: number | null }[]> = {};
  for (const city of cities) {
    const iy = nearest(lats, city.lat);
    const ix = nearest(lons, city.lon);
    out[city.slug] = times.map((time, it) => {
      const idx = it * strides[tAxis] + iy * strides[latAxis] + ix * strides[lonAxis];
      return { time, uvi: clean(cloudy[idx]), clear: clean(clear?.[idx]) };
    });
  }
  return out;
}

/* ---------------- Fetching (KNMI Open Data API) ---------------- */

async function knmi(pathname: string) {
  const res = await fetch(`${API}${pathname}`, {
    headers: { Authorization: process.env.KNMI_API_KEY! },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} from KNMI Open Data API`);
  return res.json();
}

async function downloadAndExtract(): Promise<{ fileTime: string; byCity: ReturnType<typeof extractCities> }> {
  // Fair use: one listing call, newest first, then one download.
  const list = await knmi(`/datasets/${DATASET}/versions/${VERSION}/files?maxKeys=1&sorting=desc&orderBy=created`);
  const file = list?.files?.[0];
  if (!file?.filename) throw new Error("KNMI: no files in dataset");
  const { temporaryDownloadUrl } = await knmi(`/datasets/${DATASET}/versions/${VERSION}/files/${encodeURIComponent(file.filename)}/url`);
  const bin = await fetch(temporaryDownloadUrl, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  if (!bin.ok) throw new Error(`${bin.status} downloading ${file.filename}`);

  const tmp = path.join(tmpdir(), `knmi-uv-${Date.now()}.nc`);
  await writeFile(tmp, Buffer.from(await bin.arrayBuffer()));
  try {
    const h5wasm = (await import("h5wasm/node")).default;
    await h5wasm.ready;
    const f = new h5wasm.File(tmp, "r");
    try {
      return { fileTime: file.created ?? file.lastModified ?? file.filename, byCity: extractCities(f, [...CITIES.filter(inBenelux), { slug: "bilthoven", name: "Bilthoven", country: "NL", lat: RIVM_STATION.lat, lon: RIVM_STATION.lon, tz: "Europe/Amsterdam" }]) };
    } finally {
      f.close();
    }
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

// The NetCDF file is too big for the per-fetch data cache, so we cache the
// small extracted result instead: one download per 15 minutes for all cities.
const cachedExtract = unstable_cache(downloadAndExtract, ["knmi-benelux-uv"], { revalidate: 900 });

export async function getObserved(city: City): Promise<ObservedLayer> {
  if (!inBenelux(city)) return empty("not_covered");
  if (!process.env.KNMI_API_KEY) return empty("not_configured");
  try {
    const { fileTime, byCity } = await cachedExtract();
    const today = localDate(new Date(), city.tz);
    const series = (byCity[city.slug] ?? []).filter((p) => localDate(new Date(p.time), city.tz) === today);
    const valid = series.filter((p): p is { time: string; uvi: number; clear: number | null } => p.uvi !== null && Date.parse(p.time) <= Date.now());
    return {
      source: "knmi-benelux",
      status: "ok",
      series,
      latest: valid.length ? { time: valid[valid.length - 1].time, uvi: valid[valid.length - 1].uvi } : null,
      peakSoFar: valid.length ? Math.max(...valid.map((p) => p.uvi)) : null,
      fileTime,
    };
  } catch (e) {
    return empty("error", e instanceof Error ? e.message : String(e));
  }
}
