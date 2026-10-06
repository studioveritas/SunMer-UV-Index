import { cachedFetch } from "./base";

/**
 * RIVM (NL public health institute) ground measurements at Bilthoven.
 * Spectroradiometers (Dilor / Brewer) and UV radiometers, one value every
 * ~10–12 minutes, UTC. Unvalidated near-real-time data, published daily.
 * Licence: free use with attribution "RIVM/opendata".
 * File per year: https://data.rivm.nl/data/zonkracht/Zonkracht{YYYY}.txt
 */
export const RIVM_STATION = { name: "RIVM Bilthoven", lat: 52.0831, lon: 5.1653 };
export const rivmAttribution = "Ground measurements: RIVM/opendata";

export interface GroundPoint { time: string; uvi: number; instrument: string }

/** Parses lines like "20260101 1205 12.083  0.16      er1". */
export function parseRivm(text: string): GroundPoint[] {
  const out: GroundPoint[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})\s+[\d.]+\s+(-?[\d.]+)\s+(\S+)/.exec(line.trim());
    if (!m) continue;
    const uvi = Number(m[6]);
    if (!Number.isFinite(uvi) || uvi < 0) continue;
    out.push({ time: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00.000Z`, uvi, instrument: m[7] });
  }
  return out;
}

export async function fetchRivmYear(year: number): Promise<GroundPoint[]> {
  const name = year >= 2026 ? `Zonkracht${year}.txt` : `ZonkrachtRIVM${year}.txt`;
  const res = await cachedFetch(`https://data.rivm.nl/data/zonkracht/${name}`, 30);
  return parseRivm(await res.text());
}
