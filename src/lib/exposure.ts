/**
 * Sea & Snow exposure model.
 *
 * Three separate effects, kept apart so each can be explained:
 *
 * 1. ALTITUDE. Less air above you, less UV absorbed. Published rates differ:
 *    ~5%/km for clear-sky erythemal UV in models (TEMIS f(H)=1+0.05H;
 *    NIWA 1+0.053H), 10–12%/km in public-health guidance (WHO, Cancer
 *    Council), up to 24%/km in Alpine measurements that also include snow
 *    and cleaner air (Ambach & Blumthaler 1987, Jungfraujoch vs Innsbruck).
 *    We use 8%/km as a central value and show the 5–12% range.
 *
 * 2. SNOW RAISES THE INDEX ITSELF. Light bounces off snow, back off the
 *    air, and down again. NIWA: f = 1 + 0.4·albedo·e^(−alt/7.65); observed
 *    rises rarely exceed ~30%.
 *
 * 3. REFLECTION ONTO YOU. The UV index is measured on a flat, upward-facing
 *    surface. A face is vertical and sees half the ground: reflected UV on a
 *    vertical surface ≈ ½ × albedo × horizontal UV. That is extra dose to the
 *    eyes, under the chin and nose: the "face dose".
 */

export const ALT_RATE = { low: 0.05, central: 0.08, high: 0.12 } as const;

export function altitudeFactor(fromM: number, toM: number, rate: number = ALT_RATE.central): number {
  return (1 + (rate * toM) / 1000) / (1 + (rate * fromM) / 1000);
}

/** UV-erythemal reflectance (albedo) of each surface. */
export const SURFACES = {
  "fresh-snow": { albedo: 0.85, label: "Fresh snow", range: "80–95%" },
  snow: { albedo: 0.6, label: "Settled snow", range: "50–80%" },
  "no-snow": { albedo: 0.05, label: "Grass and rock", range: "2–5%" },
  foam: { albedo: 0.25, label: "Surf and sea foam", range: "25–30%" },
  water: { albedo: 0.08, label: "Open water", range: "5–10%" },
  sand: { albedo: 0.15, label: "Dry sand", range: "15–25%" },
} as const;
export type Surface = keyof typeof SURFACES;

/** How much a snow-covered landscape raises the UV index itself (NIWA). */
export function snowIndexFactor(albedo: number, altitudeM: number): number {
  const e = Math.exp(-altitudeM / 1000 / 7.65);
  return (1 + 0.4 * albedo * e) / (1 + 0.4 * 0.05 * e);
}

/** Extra dose on vertical skin (face, eyes) from the ground below. */
export function faceFactor(albedo: number): number {
  return 1 + 0.5 * albedo;
}

export interface SnowConditions {
  depthM: number | null;
  freshCm48h: number | null;
}

export function snowSurface(c: SnowConditions, glacier = false): Surface {
  const depth = c.depthM ?? 0;
  if ((c.freshCm48h ?? 0) >= 5 && (depth > 0.02 || glacier)) return "fresh-snow";
  if (depth >= 0.1 || glacier) return "snow";
  return "no-snow";
}

export function seaSurface(kind: "surf" | "beach", waveM: number | null): Surface {
  if (kind === "beach") return "sand";
  return (waveM ?? 1) >= 0.8 ? "foam" : "water";
}

/** Wetsuit by water temperature (O'Neill season guide), and the skin it leaves exposed. */
export function wetsuitFor(seaC: number | null): { suit: string; exposed: string } | null {
  if (seaC === null) return null;
  if (seaC >= 26) return { suit: "UV shirt or lycra", exposed: "Face, arms, legs" };
  if (seaC >= 21) return { suit: "1 mm suit", exposed: "Face, hands, feet" };
  if (seaC >= 18) return { suit: "2 mm suit or shorty", exposed: "Face, arms, legs" };
  if (seaC >= 12) return { suit: "3/2 or 4/3 mm", exposed: "Face, hands, feet" };
  if (seaC >= 8) return { suit: "4/3 or 5/4 mm, boots", exposed: "Face and hands" };
  if (seaC >= 4) return { suit: "5/4 or 6/5 mm, hood, gloves, boots", exposed: "Face only" };
  return { suit: "7 mm, hood, gloves, boots", exposed: "Face only" };
}

/** Lens category (EN ISO 12312-1) for the conditions. */
export function lensFor(surface: Surface, uvi: number | null, altitudeM: number): string {
  if ((surface === "fresh-snow" || surface === "snow") && (altitudeM >= 2500 || (uvi ?? 0) >= 6)) return "Category 4 (not for driving)";
  if (surface === "fresh-snow" || surface === "snow" || surface === "foam" || (uvi ?? 0) >= 3) return "Category 3";
  return "Category 2";
}
