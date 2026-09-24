/**
 * Live smoke test against every upstream service for one city.
 *   npm run check-sources            (Amsterdam)
 *   npm run check-sources -- paris
 * Loads credentials from .env
 */
import { CITIES } from "../src/lib/config/cities";
import { PROVIDERS } from "../src/lib/providers";

const slug = process.argv[2] ?? "amsterdam";
const city = CITIES.find((c) => c.slug === slug);
if (!city) throw new Error(`Unknown city ${slug}`);

for (const p of PROVIDERS) {
  if (!p.covers(city)) { console.log(`${p.meta.name.padEnd(16)} not covered`); continue; }
  if (!p.isConfigured()) { console.log(`${p.meta.name.padEnd(16)} not configured`); continue; }
  const r = await p.fetchCity(city);
  console.log(`${p.meta.name.padEnd(16)} ${r.status.padEnd(6)} today=${r.todayMax} now=${r.current} ${r.error ?? ""}`);
}
