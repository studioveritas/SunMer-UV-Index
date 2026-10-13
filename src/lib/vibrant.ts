import type { WhoCategory } from "./types";

/**
 * "Vibrant" look: saturated blurred colour fields on white, after the
 * reference weather UI. Three blobs per reading, chosen by UV level:
 * blues when low, lemon at moderate, oranges at high, reds at very high,
 * crimson and magenta at extreme. At dusk the field turns pink-violet;
 * at night it is the same scale pulled down toward the dark, so it glows.
 */
export type Look = "classic" | "vibrant";
export type Phase = "day" | "dusk" | "night";
export const LOOKS: Look[] = ["classic", "vibrant"];

type RGB = [number, number, number];
// [blob A, blob B, blob C] by UVI anchor
const STOPS: [number, string, string, string][] = [
  [0, "#3D7BFF", "#7FD0FF", "#8C9BFF"],
  [2, "#2F8CFF", "#9BE6FF", "#5E7BFF"],
  [3, "#57B4FF", "#FFE24A", "#8FD6FF"],
  [5, "#FFB52E", "#FFE03A", "#FF8C42"],
  [6, "#FF7A1A", "#FFB23F", "#FF4A2E"],
  [8, "#FF3B30", "#FF7A1A", "#D9002B"],
  [11, "#C8002D", "#E6007E", "#FF3B30"],
];
const DUSK: RGB[] = [[255, 95, 162], [164, 92, 255], [255, 138, 92]];
const NIGHT: RGB[] = [[92, 48, 170], [30, 62, 170]];

const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const lerp = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const toNight = (c: RGB): RGB => c.map((v, i) => Math.round(v * 0.62 + [10, 11, 20][i] * 0.38)) as RGB;
export const css = (c: RGB) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

export function vibrantRGB(uvi: number | null): RGB[] {
  const u = Math.max(0, Math.min(12, uvi ?? 0));
  let i = 0;
  while (i < STOPS.length - 2 && u > STOPS[i + 1][0]) i++;
  const [u0, ...A] = STOPS[i];
  const [u1, ...B] = STOPS[i + 1];
  const t = Math.max(0, Math.min(1, (u - u0) / (u1 - u0)));
  return A.map((c, k) => lerp(hex(c), hex(B[k]), t));
}

export function vibrantColors(uvi: number | null) {
  const [a, b, c] = vibrantRGB(uvi);
  return { a: css(a), b: css(b), c: css(c) };
}

export function vibrantFor(phase: Phase, uvi: number | null) {
  // Night: indigo and violet, with one blob still carrying the day's UV colour.
  const set = phase === "dusk" ? DUSK : phase === "night" ? [toNight(vibrantRGB(uvi)[0]), NIGHT[0], NIGHT[1]] : vibrantRGB(uvi);
  return { a: css(set[0]), b: css(set[1]), c: css(set[2]) };
}

/** Colour words for the vibrant palette (the classic look keeps its own). */
export const VIBRANT_DESCRIPTOR: Record<WhoCategory, string> = {
  low: "Shades of sky & cobalt blue",
  moderate: "Shades of lemon & sky blue",
  high: "Shades of tangerine & orange",
  "very-high": "Shades of red & orange",
  extreme: "Shades of crimson & magenta",
};
