/**
 * Seasons decide what the app leads with. Meteorological seasons, Europe.
 * Autumn and winter lead with Snow; summer with Sea; spring shows both,
 * because spring skiing is the UV peak of the ski year.
 */
export type Season = "autumn" | "winter" | "spring" | "summer";

export function seasonFor(d: Date, tz = "Europe/Amsterdam"): Season {
  const m = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, month: "numeric" }).format(d));
  if (m >= 9 && m <= 11) return "autumn";
  if (m === 12 || m <= 2) return "winter";
  if (m <= 5) return "spring";
  return "summer";
}

export const SEASON_COPY: Record<Season, { name: string; lead: "sea" | "snow"; sea: string; snow: string }> = {
  autumn: {
    name: "Autumn",
    lead: "snow",
    sea: "The sun drops fast, but the Atlantic swell season starts. Low UV, long sessions, foam bouncing light into your eyes.",
    snow: "Glacier season. Sölden, Hintertux, Tignes, Kaprun and Cervinia ski high on fresh snow while the valleys are still green.",
  },
  winter: {
    name: "Winter",
    lead: "snow",
    sea: "UK and Breton UV rarely passes 2. The risk moves to your eyes and the only skin a hood leaves: your face.",
    snow: "The lowest sun of the year, yet altitude and fresh snow can push the slopes into moderate or high while the city reads 1.",
  },
  spring: {
    name: "Spring",
    lead: "snow",
    sea: "UV climbs quickly from March while the water is still cold. Full wetsuits, exposed faces.",
    snow: "The UV peak of the ski year. A high spring sun on snow at 2,500 m can match midsummer at the beach.",
  },
  summer: {
    name: "Summer",
    lead: "sea",
    sea: "Peak beach UV. Sand and foam add to what the index shows.",
    snow: "Only the glaciers ski: Hintertux. Highest UV of the year on snow.",
  },
};
