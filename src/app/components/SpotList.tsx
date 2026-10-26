import Link from "next/link";
import type { SpotUv } from "@/lib/spotService";
import { SPORT_LABEL } from "@/lib/config/spots";
import { SURFACES } from "@/lib/exposure";

const fmtM = (m: number) => `${m.toLocaleString("en-GB")} m`;

function meta(s: SpotUv): string {
  const { spot, conditions: c } = s;
  if (spot.kind === "ski") {
    const snow = s.surface === "no-snow" ? "No snow cover" : SURFACES[s.surface].label;
    return [`Slopes ${fmtM(s.headlineM)}`, snow, spot.glacier ? "Glacier" : null].filter(Boolean).join(" · ");
  }
  return [SPORT_LABEL[spot.kind], c.seaC !== null ? `Sea ${Math.round(c.seaC)}°` : null, spot.kind === "surf" && c.waveM !== null ? `Waves ${c.waveM} m` : null]
    .filter(Boolean).join(" · ");
}

/** Grouped rows, strongest UV first within each group. Same row design as the city list. */
export function SpotList({ groups }: { groups: { title: string; spots: SpotUv[] }[] }) {
  return (
    <>
      {groups.map((g) => (
        <section key={g.title} className="spot-group">
          <h2 className="label">{g.title}</h2>
          <ol className="cities">
            {[...g.spots].sort((a, b) => (b.uv.consensus.todayMax ?? -1) - (a.uv.consensus.todayMax ?? -1)).map((s) => {
              const v = s.uv.consensus.todayMax;
              const w = Math.min(100, ((v ?? 0) / 12) * 100);
              return (
                <li key={s.spot.slug}>
                  <Link href={`/spot/${s.spot.slug}`}>
                    <span>
                      <span className="name">{s.spot.name}</span>
                      <span className="country">{s.spot.region}</span>
                      <span className="spot-meta">{meta(s)}</span>
                    </span>
                    <span className="track" aria-hidden>
                      <span style={{ ["--w" as string]: `${w}%`, ["--full" as string]: `${(100 / Math.max(1, w)) * 100}%` }} />
                    </span>
                    <span className="uv" aria-label={`Peak UV ${v ?? "unknown"}`}>{v ?? "–"}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </>
  );
}
