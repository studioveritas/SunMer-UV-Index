import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { COUNTRY_LABEL, SPORT_LABEL, SPOTS, getSpot } from "@/lib/config/spots";
import { getSpotUv } from "@/lib/spotService";
import { whoBand, whoCategory } from "@/lib/who";
import { displayDate, displayTime } from "@/lib/palette";
import { VIBRANT_DESCRIPTOR } from "@/lib/vibrant";
import { bestHours } from "@/lib/bestHours";
import { buildWeek } from "@/lib/week";
import { SURFACES, wetsuitFor } from "@/lib/exposure";
import { headlineLabel, kitFor } from "@/lib/kit";
import { round1 } from "@/lib/time";
import { SEASON_COPY, seasonFor } from "@/lib/season";
import { Category, Gauge, MoonGlyph, Sky, SunGlyph } from "../../ui";
import { CityTabs } from "../../components/CityTabs";
import { WeekAhead } from "../../components/WeekAhead";
import { BurnPanel } from "../../components/BurnPanel";
import { BestHoursBand } from "../../components/BestHoursBand";
import { Outlook } from "../../components/Outlook";
import { CardDownload } from "../../components/CardDownload";

export const revalidate = 900;

export function generateStaticParams() {
  return SPOTS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const spot = getSpot(slug);
  if (!spot) return {};
  const image = `/api/card/${slug}?format=og`;
  return {
    title: `UV ${headlineLabel(spot)} at ${spot.name} today`,
    description: spot.blurb,
    openGraph: { title: `Today's UV at ${spot.name}`, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

const m = (n: number) => `${n.toLocaleString("en-GB")} m`;

export default async function SpotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const spot = getSpot(slug);
  if (!spot) notFound();

  const s = await getSpotUv(spot);
  const { uv, conditions: cond, ladder, surface, albedo } = s;
  const { consensus: c, uvCurve, outlook, sun, phase, generatedAt } = uv;
  const night = phase === "night";
  const headline = night ? outlook[0]?.max ?? null : c.todayMax;
  const category = night ? whoCategory(headline) : c.category;
  const band = whoBand(category);
  const now = new Date();
  const bandDay = night && Date.parse(sun.sunset ?? "0") < now.getTime() ? new Date(now.getTime() + 12 * 3600_000) : now;
  const best = bestHours(uvCurve, bandDay, spot.lat, spot.lon, now);
  const faceCurve = uvCurve.map((p) => ({ ...p, uvi: round1(p.uvi * s.face) }));
  const facePeak = headline === null ? null : round1(headline * s.face);
  const ski = spot.kind === "ski";
  const snowy = surface === "fresh-snow" || surface === "snow";
  const suit = wetsuitFor(cond.seaC);
  const inSeason = spot.season.includes(Number(new Intl.DateTimeFormat("en-GB", { timeZone: spot.tz, month: "numeric" }).format(now)));
  const season = SEASON_COPY[seasonFor(now, spot.tz)];
  const back = ski ? { href: "/snow", label: "All resorts" } : { href: "/sea", label: "All spots" };
  const lift = s.raw !== null && c.todayMax !== null ? Math.round((s.factor - 1) * 100) : null;

  return (
    <div className="page" data-phase={phase}>
      <Sky uvi={headline} readings={uv.readings} phase={phase}>
        <Link href={back.href} className="label back">{back.label}</Link>
      </Sky>

      <main className="panel">
        <div className="head">
          <div>
            <h1 className="label">{spot.name}: {night ? "tomorrow's" : "today's"} peak UV {headlineLabel(spot)}</h1>
            <p className="sublabel">
              {night ? "After sunset. Showing tomorrow" : category ? VIBRANT_DESCRIPTOR[category] : "Waiting for sources"}
            </p>
          </div>
          <p className="label">{displayDate(now, spot.tz)}</p>
        </div>

        <p className="spot-intro">
          <span className="label">{SPORT_LABEL[spot.kind]} · {spot.region}, {COUNTRY_LABEL[spot.country] ?? spot.country}</span>
          {spot.blurb}.{!inSeason && " Out of its main season."}
        </p>

        <CityTabs
          todayLabel={night ? "Tomorrow" : "Today"}
          week={<WeekAhead uv={uv} week={buildWeek(uv)} />}
          today={<>
            <div className="reading">
              <p className="big">{headline ?? "–"}<small>uvi</small></p>
              {night ? <MoonGlyph /> : <SunGlyph uvi={headline} />}
            </div>

            <div className="pair">
              <div>
                <p className="label">Level</p>
                <p className="value"><Category category={category} /></p>
                {band && <p className="note">{band.advice}</p>}
              </div>
              <div>
                <p className="label">On your face</p>
                <p className="value">{facePeak ?? "–"}</p>
                <p className="note">
                  {SURFACES[surface].label} reflects {SURFACES[surface].range} of UV back up. Eyes, nose and under the chin get about {Math.round((s.face - 1) * 100)}% more than the index shows.
                </p>
              </div>
            </div>

            {ski && (
              <section className="block">
                <p className="label">Altitude</p>
                <ol className="ladder">
                  {ladder.map((r) => (
                    <li key={r.label}>
                      <span className="rung-name">{r.label}</span>
                      <span className="rung-m">{m(r.m)}</span>
                      <span className="rung-bar" aria-hidden><span style={{ ["--w" as string]: `${Math.min(100, ((r.uvi ?? 0) / 12) * 100)}%` }} /></span>
                      <span className="rung-uv">{r.uvi ?? "–"}</span>
                    </li>
                  ))}
                </ol>
                <p className="note">
                  UV rises with height: less air above you. We use 8% per 1,000 m; published rates run 5–12%, so the summit reads {ladder[0].low ?? "–"} to {ladder[0].high ?? "–"}.
                  {snowy && " Snow cover adds to the index itself, as light bounces between snow and sky."}
                </p>
              </section>
            )}

            <section className="block pair" aria-label="Conditions">
              {ski ? (
                <>
                  <Gauge label="Snow depth" value={cond.snowDepthM !== null ? Math.min(10, cond.snowDepthM * 5) : null} display={cond.snowDepthM !== null ? `${Math.round(cond.snowDepthM * 100)} cm` : "–"} max={10} />
                  <Gauge label="Fresh, 48 h" value={cond.freshCm48h !== null ? Math.min(10, cond.freshCm48h / 3) : null} display={cond.freshCm48h !== null ? `${Math.round(cond.freshCm48h)} cm` : "–"} max={10} />
                  <Gauge label="Reflection" value={albedo * 10} display={`${Math.round(albedo * 100)}%`} max={10} />
                  <Gauge label="Height adds" value={lift !== null ? Math.min(10, lift / 5) : null} display={lift !== null ? `+${lift}%` : "–"} max={10} />
                </>
              ) : (
                <>
                  <Gauge label="Sea" value={cond.seaC !== null ? Math.min(10, cond.seaC / 2.6) : null} display={cond.seaC !== null ? `${Math.round(cond.seaC)}°C` : "–"} max={10} />
                  <Gauge label={spot.kind === "surf" ? "Waves" : "Swell"} value={cond.waveM !== null ? Math.min(10, cond.waveM * 3) : null} display={cond.waveM !== null ? `${cond.waveM} m${cond.wavePeriodS ? `, ${Math.round(cond.wavePeriodS)} s` : ""}` : "–"} max={10} />
                  <Gauge label="Reflection" value={albedo * 20} display={`${Math.round(albedo * 100)}%`} max={10} />
                  <Gauge label="Cloud takes off" value={c.cloudEffect} display={c.cloudEffect ? `−${c.cloudEffect}` : c.cloudEffect === 0 ? "0" : "–"} max={6} />
                </>
              )}
            </section>
            {!ski && suit && <p className="note">Water at {Math.round(cond.seaC!)}°C calls for {suit.suit}. What stays in the sun: {suit.exposed.toLowerCase()}.</p>}

            {!night && (
              <section className="block">
                <p className="label">Burn time {ski ? "on snow" : spot.kind === "surf" ? "in the water" : "on the sand"}</p>
                <BurnPanel curve={faceCurve} tz={spot.tz} />
                <p className="note">For your face, including reflection off the {SURFACES[surface].label.toLowerCase()}. Cold and wind hide it: you feel no heat, you still burn.</p>
              </section>
            )}

            <section className="block">
              <p className="label">{night ? "Lowest-UV hours tomorrow" : `Lowest-UV hours to ${ski ? "ski" : spot.kind === "surf" ? "surf" : "be out"}`}</p>
              <BestHoursBand best={best} tz={spot.tz} />
            </section>

            <section className="block">
              <p className="label">Kit</p>
              <dl className="kit">
                {kitFor(s).map((k) => (
                  <div key={k.label}><dt>{k.label}</dt><dd>{k.value}</dd></div>
                ))}
              </dl>
            </section>

            <section className="block">
              <p className="label">This season</p>
              <p className="season-line">{ski ? season.snow : season.sea}</p>
            </section>

            <section className="block">
              <p className="label">Next six days</p>
              <Outlook days={outlook} tz={spot.tz} />
            </section>

            <section className="block">
              <p className="label">Post today&apos;s UV</p>
              <CardDownload slug={spot.slug} cityName={spot.name} />
            </section>

            <section className="block">
              <p className="label">How we work this out</p>
              <p className="note">
                Forecast UV from KNMI/TEMIS, Copernicus CAMS and MET Norway{ski ? ` for the village (${m(spot.base)})` : " at the coast"}: {s.raw ?? "–"} today.
                {ski && ` Raised to ${m(s.headlineM)}${snowy ? " and for snow cover" : ""}: ×${s.factor}.`}
                {" "}Face dose adds half the ground&apos;s reflectance, because a vertical face sees half the ground.
                {" "}{ski ? "Snow from Open-Meteo at slope height." : "Waves and sea temperature from the Open-Meteo Marine API."} Estimates, not medical advice.
                {" "}Updated {displayTime(generatedAt, spot.tz)}.
              </p>
            </section>
          </>}
        />
      </main>
    </div>
  );
}
