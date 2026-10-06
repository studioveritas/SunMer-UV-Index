import Link from "next/link";
import { notFound } from "next/navigation";
import { CITIES, getCity } from "@/lib/config/cities";
import { getCityUv } from "@/lib/service";
import { getProvider } from "@/lib/providers";
import { whoBand } from "@/lib/who";
import { DESCRIPTOR, displayDate, displayTime } from "@/lib/palette";
import type { Metadata } from "next";
import { Category, Gauge, MoonGlyph, PaletteDots, Sky, SunGlyph } from "../../ui";
import { DoseLog } from "../../components/DoseLog";
import { BestHoursBand } from "../../components/BestHoursBand";
import { ShareButton } from "../../components/ShareButton";
import { bestHours } from "@/lib/bestHours";
import { localDate } from "@/lib/time";
import { whoCategory } from "@/lib/who";
import { BurnPanel } from "../../components/BurnPanel";
import { AlertToggle } from "../../components/AlertToggle";
import { Curve } from "../../components/Curve";
import { Outlook } from "../../components/Outlook";

export const revalidate = 900;

export function generateStaticParams() {
  return CITIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const city = getCity(slug);
  if (!city) return {};
  const image = `/api/card/${slug}?format=og`;
  return {
    title: `UV in ${city.name} today`,
    openGraph: { title: `Today's sky over ${city.name}`, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

const STATUS_COPY = {
  ok: "Reporting",
  error: "Unavailable now",
  not_configured: "Not connected",
  not_covered: "Doesn't cover city",
} as const;

const AGREEMENT = { high: "Agree", medium: "Close", low: "Split", none: "None" } as const;
const AGREEMENT_LEVEL = { high: 10, medium: 6.5, low: 3, none: 0 } as const;

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();

  const { consensus: c, readings, hourlyCurve, uvCurve, outlook, observed, sun, phase, generatedAt } = await getCityUv(city);
  const night = phase === "night";
  // After dark the headline looks ahead: tomorrow's peak, tomorrow's best hours.
  const headline = night ? outlook[0]?.max ?? null : c.todayMax;
  const headlineCategory = night ? whoCategory(headline) : c.category;
  const band = whoBand(headlineCategory);
  const now = new Date();
  const bandDay = night && Date.parse(sun.sunset ?? "0") < now.getTime() ? new Date(now.getTime() + 12 * 3600_000) : now;
  const best = bestHours(uvCurve, bandDay, city.lat, city.lon, now);
  const fullSun =
    c.cloudAdjusted.median !== null && c.clearSky.median
      ? Math.min(100, Math.round((c.cloudAdjusted.median / c.clearSky.median) * 100))
      : null;

  return (
    <div className="page" data-phase={phase}>
      <Sky uvi={headline} readings={readings} phase={phase}>
        <Link href="/" className="label back">All cities</Link>
      </Sky>

      <main className="panel">
        <div className="head">
          <div>
            <h1 className="label">{city.name}: {night ? "tomorrow's" : "today's"} peak UV <PaletteDots /></h1>
            <p className="sublabel">
              {night ? `After sunset. Showing tomorrow` : headlineCategory ? DESCRIPTOR[headlineCategory] : "Waiting for sources"}
            </p>
          </div>
          <p className="label">{displayDate(new Date(), city.tz)}</p>
        </div>

        <div className="reading">
          <p className="big">{headline ?? "–"}<small>uvi</small></p>
          {night ? <MoonGlyph /> : <SunGlyph uvi={headline} />}
        </div>

        <div className="pair">
          <div>
            <p className="label">Level</p>
            <p className="value"><Category category={headlineCategory} /></p>
            {band && <p className="note">{band.advice}</p>}
          </div>
          <div>
            {night ? (
              <>
                <p className="label">Sunset</p>
                <p className="value">{sun.sunset ? displayTime(sun.sunset, city.tz) : "–"}</p>
                <p className="note">Today peaked at {c.todayMax ?? "–"}.</p>
              </>
            ) : (
              <>
                <p className="label">Right now</p>
                <p className="value">{c.current ?? "–"}</p>
                <p className="note">
                  {c.currentSource === "observed" ? "Measured by KNMI satellite, last 15 min" : c.currentSource === "forecast" ? "Forecast for this hour" : "No hourly source"}
                </p>
              </>
            )}
          </div>
        </div>

        {!night && <BurnPanel curve={uvCurve} tz={city.tz} />}

        <section className="block">
          <p className="label">{night ? "Best hours for a run tomorrow" : "Best hours for a run"}</p>
          <BestHoursBand best={best} tz={city.tz} />
        </section>

        <section className="block">
          <p className="label">Your dose today</p>
          <DoseLog curve={uvCurve} tz={city.tz} date={localDate(now, city.tz)} />
        </section>

        <section className="block pair" aria-label="Conditions">
          <Gauge label="Cloud-free sky" value={c.clearSky.median} display={c.clearSky.median ?? "–"} />
          <Gauge label="Cloud takes off" value={c.cloudEffect} display={c.cloudEffect !== null ? `−${c.cloudEffect}` : "–"} max={6} />
          <Gauge label="Sources" value={AGREEMENT_LEVEL[c.confidence]} display={`${AGREEMENT[c.confidence]}, ${c.sourcesOk}`} max={10} />
          <Gauge label="Peak so far" value={observed.peakSoFar} display={observed.peakSoFar ?? "–"} />
        </section>

        <section>
          <p className="label">% of full sun</p>
          <div className="bar">
            <span className="fill" style={{ ["--w" as string]: `${fullSun ?? 0}%` }} />
            <span className="n">{fullSun ?? "–"}<small>%</small></span>
          </div>
          <p className="note">How much of the cloud-free UV is expected to reach the ground today.</p>
        </section>

        {observed.status !== "not_covered" && (
          <section className="block">
            <p className="label">Measured today</p>
            {observed.status === "ok" ? (
              <>
                <Curve observed={observed} forecast={hourlyCurve} tz={city.tz} />
                <p className="note">
                  Filled: measured by KNMI from satellite every 15 minutes. Dashed: cloud-free potential. Line: forecast.
                  {observed.latest && ` Latest ${displayTime(observed.latest.time, city.tz)}.`}
                </p>
              </>
            ) : (
              <p className="note">
                {observed.status === "not_configured" ? "Add a KNMI Data Platform key to show measured UV for Benelux cities." : `KNMI measurements unavailable: ${observed.error}`}
              </p>
            )}
          </section>
        )}

        <section className="block">
          <p className="label">Next six days</p>
          <Outlook days={outlook} tz={city.tz} />
        </section>

        <section className="block">
          <p className="label">Share</p>
          <ShareButton slug={city.slug} cityName={city.name} />
        </section>

        <section className="block">
          <p className="label">Alerts</p>
          <AlertToggle city={city.slug} cityName={city.name} />
        </section>

        <section className="block">
          <p className="label">By source</p>
          <div className="table-wrap">
            <table className="sources">
              <thead>
                <tr><th>Source</th><th>Measures</th><th>Today</th><th>Next days</th><th>Status</th></tr>
              </thead>
              <tbody>
                {readings.map((r) => {
                  const meta = getProvider(r.provider)!.meta;
                  return (
                    <tr key={r.provider}>
                      <td>{meta.name}</td>
                      <td>{r.kind === "clear-sky" ? "Cloud-free" : "With cloud"}</td>
                      <td>{r.todayMax ?? "–"}</td>
                      <td>{r.daily.slice(1, 4).map((d) => d.max).join(" / ") || "–"}</td>
                      <td title={r.error}>{STATUS_COPY[r.status]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">Updated {displayTime(generatedAt, city.tz)}. <Link href="/ground-truth">How accurate is this?</Link></p>
        </section>
      </main>
    </div>
  );
}
