import Link from "next/link";
import type { Metadata } from "next";
import { getAllCitiesUv, sunInfo } from "@/lib/service";
import { getCity } from "@/lib/config/cities";
import { displayDate } from "@/lib/palette";
import { PaletteDots, Sky } from "../ui";
import { CardDownload } from "../components/CardDownload";
import { ShareThumb } from "../components/ShareThumb";

export const revalidate = 900;
export const metadata: Metadata = { title: "Post today's UV" };

/**
 * One place for the admin (and anyone else) to grab today's cards for every
 * city. Public on purpose: no login, so partners and clubs can post too.
 */
export default async function SharePage() {
  const cities = await getAllCitiesUv();
  const ranked = [...cities].sort((a, b) => (b.consensus.todayMax ?? -1) - (a.consensus.todayMax ?? -1));
  const { phase } = sunInfo(getCity("amsterdam")!);

  return (
    <div className="page" data-phase={phase}>
      <Sky uvi={ranked[0]?.consensus.todayMax ?? null} phase={phase}>
        <Link href="/" className="label back">All cities</Link>
      </Sky>
      <main className="panel">
        <div className="head">
          <div>
            <h1 className="label">Post today&apos;s UV <PaletteDots /></h1>
            <p className="sublabel">Instagram Story and Post images, today and the week ahead, every city</p>
          </div>
          <p className="label">{displayDate(new Date(), "Europe/Amsterdam")}</p>
        </div>
        <ul className="share-grid">
          {ranked.map(({ city, consensus }) => (
            <li key={city.slug}>
              <ShareThumb slug={city.slug} alt={`Today's UV card for ${city.name}`} />
              <h2>{city.name} · {consensus.todayMax ?? "–"}</h2>
              <CardDownload slug={city.slug} cityName={city.name} compact />
              <CardDownload slug={city.slug} cityName={city.name} compact kind="week" />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
