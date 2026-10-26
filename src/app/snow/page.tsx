import Link from "next/link";
import type { Metadata } from "next";
import { getSnowUv } from "@/lib/spotService";
import { getCity } from "@/lib/config/cities";
import { sunInfo } from "@/lib/service";
import { displayDate } from "@/lib/palette";
import { Sky } from "../ui";
import { ModeNav } from "../components/ModeNav";
import { SeasonNote } from "../components/SeasonNote";
import { SpotList } from "../components/SpotList";

export const revalidate = 900;
export const metadata: Metadata = { title: "Snow: UV in the Alps", description: "UV on the slopes at the top ski resorts in France, Austria and Italy, corrected for altitude and snow." };

export default async function SnowPage() {
  const spots = await getSnowUv();
  const top = Math.max(-1, ...spots.map((s) => s.uv.consensus.todayMax ?? -1));
  const { phase } = sunInfo(getCity("munich")!);
  return (
    <div className="page" data-phase={phase}>
      <Sky uvi={top < 0 ? null : top} phase={phase} />
      <main className="panel">
        <div className="head">
          <div>
            <h1 className="label">Today&apos;s UV on the slopes</h1>
            <p className="sublabel">{spots.length} ski resorts in France, Austria and Italy</p>
          </div>
          <p className="label">{displayDate(new Date(), "Europe/Paris")}</p>
        </div>
        <ModeNav active="snow" />
        <SeasonNote mode="snow" />
        <SpotList groups={[
          { title: "France", spots: spots.filter((s) => s.spot.country === "FR") },
          { title: "Austria", spots: spots.filter((s) => s.spot.country === "AT") },
          { title: "Italy", spots: spots.filter((s) => s.spot.country === "IT") },
        ]} />
        <p className="note" style={{ marginTop: "2rem" }}>
          Peak UV at typical skiing altitude, corrected for height and snow cover. Open a resort for the summit and village. <Link href="/sea">Sea</Link> · <Link href="/">Cities</Link>
        </p>
      </main>
    </div>
  );
}
