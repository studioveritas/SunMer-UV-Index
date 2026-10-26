import { SEASON_COPY, seasonFor } from "@/lib/season";

export function SeasonNote({ mode }: { mode: "sea" | "snow" }) {
  const season = seasonFor(new Date());
  const copy = SEASON_COPY[season];
  return (
    <p className="season-note">
      <span className="label">{copy.name}</span> {copy[mode]}
    </p>
  );
}
