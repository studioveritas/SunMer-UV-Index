import Link from "next/link";
import type { Metadata } from "next";
import { getSeaUv } from "@/lib/spotService";
import { getCity } from "@/lib/config/cities";
import { sunInfo } from "@/lib/service";
import { displayDate } from "@/lib/palette";
import { Sky } from "../ui";
import { ModeNav } from "../components/ModeNav";
import { SeasonNote } from "../components/SeasonNote";
import { SpotList } from "../components/SpotList";

export const revalidate = 900;
export const metadata: Metadata = { title: "Sea: UV at surf and beach spots", description: "UV at the top surf and beach spots in the UK and France, with sea temperature, waves and reflection." };

export default async function SeaPage() {
  const spots = await getSeaUv();
  const top = Math.max(-1, ...spots.map((s) => s.uv.consensus.todayMax ?? -1));
  const { phase } = sunInfo(getCity("london")!);
  return (
    <div className="page" data-phase={phase}>
      <Sky uvi={top < 0 ? null : top} phase={phase} />
      <main className="panel">
        <div className="head">
          <div>
            <h1 className="label">Today&apos;s UV at sea</h1>
            <p className="sublabel">{spots.length} surf and beach spots, UK and France</p>
          </div>
          <p className="label">{displayDate(new Date(), "Europe/London")}</p>
        </div>
        <ModeNav active="sea" />
        <SeasonNote mode="sea" />
        <SpotList groups={[
          { title: "United Kingdom", spots: spots.filter((s) => s.spot.country === "GB") },
          { title: "France", spots: spots.filter((s) => s.spot.country === "FR") },
        ]} />
        <p className="note" style={{ marginTop: "2rem" }}>
          Peak UV at sea level. Each spot shows how much the water, foam or sand reflects back onto you. <Link href="/snow">Snow</Link> · <Link href="/">Cities</Link>
        </p>
      </main>
    </div>
  );
}
