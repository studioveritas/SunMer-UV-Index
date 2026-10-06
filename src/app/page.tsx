import Link from "next/link";
import { getAllCitiesUv } from "@/lib/service";
import { displayDate } from "@/lib/palette";
import { PaletteDots, Sky } from "./ui";
import { getCity } from "@/lib/config/cities";
import { sunInfo } from "@/lib/service";

export const revalidate = 900;

export default async function Home() {
  const cities = await getAllCitiesUv();
  const ranked = [...cities].sort((a, b) => (b.consensus.todayMax ?? -1) - (a.consensus.todayMax ?? -1));
  const top = ranked[0]?.consensus.todayMax ?? null;
  const { phase } = sunInfo(getCity("amsterdam")!);

  return (
    <div className="page" data-phase={phase}>
      <Sky uvi={top} phase={phase} />
      <main className="panel">
        <div className="head">
          <div>
            <h1 className="label">Today's UV across Europe <PaletteDots /></h1>
            <p className="sublabel">{cities.length} cities, strongest sun first</p>
          </div>
          <p className="label">{displayDate(new Date(), "Europe/Amsterdam")}</p>
        </div>

        <ol className="cities">
          {ranked.map(({ city, consensus }) => (
            <li key={city.slug}>
              <Link href={`/city/${city.slug}`}>
                <span>
                  <span className="name">{city.name}</span>
                  <span className="country">{city.country}</span>
                </span>
                <span className="track" aria-hidden>
                  <span
                    style={{
                      ["--w" as string]: `${Math.min(100, ((consensus.todayMax ?? 0) / 12) * 100)}%`,
                      // keep one colour scale across all rows: UV 12 = scarlet-violet end
                      ["--full" as string]: `${(100 / Math.max(1, Math.min(100, ((consensus.todayMax ?? 0) / 12) * 100))) * 100}%`,
                    }}
                  />
                </span>
                <span className="uv" aria-label={`Peak UV ${consensus.todayMax ?? "unknown"}`}>{consensus.todayMax ?? "–"}</span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="note" style={{ marginTop: "2rem" }}>
          <Link href="/ground-truth">How accurate is this? We check satellite and forecasts against RIVM's ground station every day.</Link>
        </p>
      </main>
    </div>
  );
}
