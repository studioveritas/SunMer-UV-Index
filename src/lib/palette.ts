import type { WhoCategory } from "./types";

/**
 * Brand palette from the reference: periwinkle sky, lavender haze, gold core,
 * amber and scarlet edges. The orb is interpolated by UV index so the hero
 * is a reading, not decoration.
 */
type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mix = (a: RGB, b: RGB, t: number): string =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(" ")})`;

// UVI anchor -> [core, mid, outer]
const STOPS: [number, string, string, string][] = [
  [0, "#EFE3B4", "#E8CDB8", "#CEC4DC"],
  [3, "#E6C462", "#E3A66A", "#CAB5D3"],
  [6, "#E3B550", "#E08E4E", "#C8AFCF"],
  [8, "#E3A247", "#D9693F", "#C6A3C8"],
  [11, "#E08C42", "#CF4E38", "#A98BCB"],
];

export function orbColors(uvi: number | null) {
  const u = Math.max(0, Math.min(12, uvi ?? 0));
  let i = 0;
  while (i < STOPS.length - 2 && u > STOPS[i + 1][0]) i++;
  const [u0, c0, m0, o0] = STOPS[i];
  const [u1, c1, m1, o1] = STOPS[i + 1];
  const t = Math.max(0, Math.min(1, (u - u0) / (u1 - u0)));
  return {
    core: mix(hex(c0), hex(c1), t),
    mid: mix(hex(m0), hex(m1), t),
    outer: mix(hex(o0), hex(o1), t),
    scale: (0.72 + (u / 12) * 0.58).toFixed(3),
  };
}

export const DESCRIPTOR: Record<WhoCategory, string> = {
  low: "Shades of lavender & pale gold",
  moderate: "Shades of gold & soft amber",
  high: "Shades of amber & orange",
  "very-high": "Shades of scarlet & orange",
  extreme: "Shades of scarlet & violet",
};

/** "06/ 10/ 2026", as in the reference. */
export function displayDate(d: Date, tz: string): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("day")}/ ${get("month")}/ ${get("year")}`;
}

export function displayTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * After sunset the sky turns: dusk keeps a low ember on a rose-lavender sky,
 * night drops to indigo with a faint violet glow where the sun went down.
 */
export function phaseSky(phase: "day" | "dusk" | "night", uvi: number | null) {
  if (phase === "dusk") return { sky: "#9EA2D4", core: "rgb(231 140 92)", mid: "rgb(200 110 140)", outer: "rgb(128 122 186)", scale: "0.85" };
  if (phase === "night") return { sky: "#16182E", core: "rgb(92 88 150)", mid: "rgb(58 58 112)", outer: "rgb(36 38 76)", scale: "0.8" };
  return { sky: "var(--sky-day)", ...orbColors(uvi) };
}
