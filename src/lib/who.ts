import type { WhoCategory } from "./types";

/** WHO Global Solar UV Index bands and protection messages. */
export const WHO_BANDS: {
  category: WhoCategory;
  label: string;
  min: number;
  advice: string;
}[] = [
  { category: "low", label: "Low", min: 0, advice: "No protection needed for most people." },
  { category: "moderate", label: "Moderate", min: 3, advice: "Seek shade at midday. Cover up, hat, sunscreen." },
  { category: "high", label: "High", min: 6, advice: "Seek shade at midday. Cover up, hat, sunscreen." },
  { category: "very-high", label: "Very high", min: 8, advice: "Avoid being outside at midday. Shirt, sunscreen and hat are a must." },
  { category: "extreme", label: "Extreme", min: 11, advice: "Avoid being outside at midday. Shirt, sunscreen and hat are a must." },
];

export function whoCategory(uvi: number | null): WhoCategory | null {
  if (uvi === null || Number.isNaN(uvi)) return null;
  const rounded = Math.round(uvi); // WHO bands apply to the rounded integer
  let band = WHO_BANDS[0];
  for (const b of WHO_BANDS) if (rounded >= b.min) band = b;
  return band.category;
}

export function whoBand(category: WhoCategory | null) {
  return WHO_BANDS.find((b) => b.category === category) ?? null;
}
