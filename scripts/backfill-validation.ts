/**
 * Build the publishable ground-truth dataset: KNMI satellite UV vs RIVM
 * ground measurements at Bilthoven, for a date range.
 *
 *   npm run backfill-validation -- 2026-04-01 2026-09-30
 *
 * Writes data/validation/pairs.csv and data/validation/summary.json with
 * overall, per-month and per-UV-level statistics.
 *
 * Fair use: one KNMI file per day, downloaded sequentially, with a pause.
 * The script assumes KNMI file names contain the date as YYYYMMDD; check
 * the first listing and adjust `matchesDate` if the naming differs.
 */
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fetchRivmYearRaw } from "./lib-rivm";
import { parseRivm, RIVM_STATION } from "../src/lib/providers/rivm";
import { extractCities } from "../src/lib/providers/knmiObserved";
import { pairSeries, stats, type Pair } from "../src/lib/validation";

const [from, to] = process.argv.slice(2);
if (!from || !to) throw new Error("Usage: backfill-validation <from YYYY-MM-DD> <to YYYY-MM-DD>");
const KEY = process.env.KNMI_API_KEY;
if (!KEY) throw new Error("KNMI_API_KEY missing");
const DATASET = process.env.KNMI_UV_DATASET ?? "cloud_modified_UV_index_benelux";
const VERSION = process.env.KNMI_UV_VERSION ?? "1.0";
const API = `https://api.dataplatform.knmi.nl/open-data/v1/datasets/${DATASET}/versions/${VERSION}/files`;
const station = { slug: "bilthoven", name: "Bilthoven", country: "NL", lat: RIVM_STATION.lat, lon: RIVM_STATION.lon, tz: "Europe/Amsterdam" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const matchesDate = (filename: string, date: string) => filename.includes(date.replaceAll("-", ""));

async function knmi(url: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { Authorization: KEY! } });
    if (res.status === 429) { await sleep(2000 * 2 ** attempt); continue; }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }
  throw new Error("KNMI rate limit");
}

async function listFiles(): Promise<string[]> {
  const names: string[] = [];
  let token: string | undefined;
  do {
    const page = await knmi(`${API}?maxKeys=1000${token ? `&nextPageToken=${token}` : ""}`);
    names.push(...(page.files ?? []).map((f: { filename: string }) => f.filename));
    token = page.nextPageToken;
  } while (token);
  return names.sort();
}

const days: string[] = [];
for (let t = Date.parse(`${from}T12:00:00Z`); t <= Date.parse(`${to}T12:00:00Z`); t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));

const files = await listFiles();
console.log(`${files.length} KNMI files listed; first: ${files[0]}, last: ${files.at(-1)}`);

const years = [...new Set(days.map((d) => Number(d.slice(0, 4))))];
const ground = (await Promise.all(years.map(async (y) => parseRivm(await fetchRivmYearRaw(y))))).flat();
const h5wasm = (await import("h5wasm/node")).default;
await h5wasm.ready;

const all: (Pair & { date: string })[] = [];
const perDay: Record<string, ReturnType<typeof stats>> = {};
for (const date of days) {
  const file = files.filter((f) => matchesDate(f, date)).at(-1); // latest version of that day
  if (!file) { console.log(`${date}: no KNMI file`); continue; }
  const { temporaryDownloadUrl } = await knmi(`${API}/${encodeURIComponent(file)}/url`);
  const bin = Buffer.from(await (await fetch(temporaryDownloadUrl)).arrayBuffer());
  const tmp = path.join(tmpdir(), file);
  await writeFile(tmp, bin);
  const f = new h5wasm.File(tmp, "r");
  const sat = extractCities(f as never, [station]).bilthoven;
  f.close();
  await unlink(tmp);
  const g = ground.filter((p) => p.time.startsWith(date));
  const pairs = pairSeries(g, sat);
  pairs.forEach((p) => all.push({ ...p, date }));
  perDay[date] = stats(pairs);
  console.log(`${date}: ${pairs.length} pairs, MAE ${perDay[date].mae}, bias ${perDay[date].bias}`);
  await sleep(1500);
}

const byMonth: Record<string, ReturnType<typeof stats>> = {};
for (const m of [...new Set(all.map((p) => p.date.slice(0, 7)))]) byMonth[m] = stats(all.filter((p) => p.date.startsWith(m)));
const bands = { "below 3": [0, 3], "3 to 6": [3, 6], "6 and up": [6, 99] } as const;
const byLevel = Object.fromEntries(Object.entries(bands).map(([k, [lo, hi]]) => [k, stats(all.filter((p) => p.ground >= lo && p.ground < hi), 0)]));

await mkdir("data/validation", { recursive: true });
await writeFile("data/validation/pairs.csv", ["date,time_utc,rivm_ground_uvi,knmi_satellite_uvi", ...all.map((p) => `${p.date},${p.time},${p.ground},${p.satellite}`)].join("\n"));
await writeFile("data/validation/summary.json", JSON.stringify({ from, to, overall: stats(all), byMonth, byLevel, perDay }, null, 2));
console.log("Overall:", stats(all));
