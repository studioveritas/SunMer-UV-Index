import Link from "next/link";
import type { Metadata } from "next";
import { getValidation } from "@/lib/validation";
import { getProvider } from "@/lib/providers";
import { rivmAttribution } from "@/lib/providers/rivm";
import { displayDate } from "@/lib/palette";
import { sunInfo } from "@/lib/service";
import { getCity } from "@/lib/config/cities";
import { PaletteDots, Sky } from "../ui";

export const revalidate = 1800;
export const metadata: Metadata = { title: "Ground truth: how accurate is satellite UV?" };

const TZ = "Europe/Amsterdam";
const fmt = (v: number | null, signed = false) => (v === null ? "–" : `${signed && v > 0 ? "+" : ""}${v}`);
const sourceName = (id: string) => (id === "consensus" ? "Our consensus" : getProvider(id as never)?.meta.name ?? id);

function Comparison({ ground, satellite }: { ground: { time: string; uvi: number }[]; satellite: { time: string; uvi: number | null }[] }) {
  const W = 640, H = 220, padL = 28, padB = 24, padT = 10;
  const hour = (iso: string) => {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date(iso));
    return Number(p.find((x) => x.type === "hour")!.value) + Number(p.find((x) => x.type === "minute")!.value) / 60;
  };
  const h0 = 6, h1 = 20;
  const yMax = Math.max(4, Math.ceil(Math.max(0, ...ground.map((g) => g.uvi), ...satellite.map((s) => s.uvi ?? 0)) + 0.5));
  const x = (h: number) => padL + ((h - h0) / (h1 - h0)) * (W - padL - 8);
  const y = (v: number) => padT + (1 - v / yMax) * (H - padT - padB);
  const sat = satellite.filter((s) => s.uvi !== null).map((s) => `${x(hour(s.time)).toFixed(1)},${y(s.uvi as number).toFixed(1)}`);
  return (
    <svg className="curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ground measurements against satellite UV, today">
      {Array.from({ length: Math.floor(yMax / 2) + 1 }, (_, i) => i * 2).map((v) => (
        <g key={v}><line x1={padL} x2={W - 8} y1={y(v)} y2={y(v)} stroke="var(--rule)" /><text x={0} y={y(v) + 4}>{v}</text></g>
      ))}
      {[8, 11, 14, 17, 20].map((h) => <text key={h} x={x(h) - 8} y={H - 6}>{String(h).padStart(2, "0")}h</text>)}
      {sat.length > 1 && <polyline points={sat.join(" ")} fill="none" stroke="var(--amber)" strokeWidth="2.5" />}
      {ground.map((g) => <circle key={g.time} cx={x(hour(g.time))} cy={y(g.uvi)} r="2.6" fill="var(--ink)" />)}
    </svg>
  );
}

export default async function GroundTruth() {
  const v = await getValidation();
  const { phase } = sunInfo(getCity("amsterdam")!);

  return (
    <div className="page" data-phase={phase}>
      <Sky uvi={v.groundPeak} phase={phase}>
        <Link href="/" className="label back">All cities</Link>
      </Sky>
      <main className="panel">
        <div className="head">
          <div>
            <h1 className="label">Ground truth <PaletteDots /></h1>
            <p className="sublabel">Satellite and forecasts against RIVM Bilthoven</p>
          </div>
          <p className="label">{displayDate(new Date(), TZ)}</p>
        </div>

        <section className="block prose">
          <p>
            Every UV number on this site is modelled: from satellites, or from weather forecasts. The Netherlands has one
            place where UV is measured from the ground with a spectroradiometer, on the RIVM roof in Bilthoven. So we check
            ourselves against it, every day, in public.
          </p>
        </section>

        <section className="block">
          <p className="label">Today: satellite against the ground</p>
          {v.ground.length || v.satellite.length ? (
            <>
              <Comparison ground={v.ground} satellite={v.satellite} />
              <p className="note">Dots: RIVM ground measurements. Line: KNMI satellite UV for the grid cell over the station.</p>
            </>
          ) : (
            <p className="note">No data for today yet. RIVM publishes once a day; KNMI needs an API key on this server.</p>
          )}
          <div className="metric-grid" style={{ marginTop: "1.5rem" }}>
            <div><p className="label">Peak, ground</p><p className="value">{fmt(v.groundPeak)}</p></div>
            <div><p className="label">Peak, satellite</p><p className="value">{fmt(v.satellitePeak)}</p></div>
            <div><p className="label">Typical gap</p><p className="value">{fmt(v.today.mae)}</p><p className="note">Mean absolute difference, UVI</p></div>
            <div><p className="label">Bias</p><p className="value">{fmt(v.today.bias, true)}</p><p className="note">Satellite minus ground</p></div>
          </div>
          <p className="note">{v.today.n} paired readings within 8 minutes, ignoring values below 0.5. Correlation {fmt(v.today.r)}.</p>
        </section>

        <section className="block">
          <p className="label">Forecast scoreboard</p>
          {v.scoreboard.length ? (
            <div className="table-wrap">
              <table className="sources">
                <thead><tr><th>Source</th><th>Measures</th><th>Typical miss</th><th>Bias</th><th>Days</th></tr></thead>
                <tbody>
                  {v.scoreboard.map((r) => (
                    <tr key={r.source}>
                      <td>{sourceName(r.source)}</td>
                      <td>{r.kind === "clear-sky" ? "Cloud-free" : "With cloud"}</td>
                      <td>{fmt(r.mae)}</td>
                      <td>{fmt(r.bias, true)}</td>
                      <td>{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="note">The scoreboard starts filling the morning after alerts and the daily job are switched on.</p>
          )}
          <p className="note">
            Each morning we record what every service forecasts for Bilthoven&apos;s peak, then score it against the peak RIVM
            measured that day (3-reading running median, so one cloud gap doesn&apos;t count). Cloud-free sources are expected
            to overshoot: that gap is the cloud effect.
          </p>
        </section>

        <section className="block prose">
          <p className="label">Method</p>
          <p className="note">
            Ground: RIVM spectroradiometers (Dilor, Brewer) and radiometers, unvalidated near-real-time data. Satellite: KNMI
            cloud-modified UV index for the Benelux, nearest grid cell to the station. Data: <a href="/api/validation">JSON</a>,{" "}
            <a href="/api/validation?format=csv">CSV</a>. {rivmAttribution}. Satellite UV: KNMI, CC BY 4.0.
          </p>
          {(v.status.ground !== "ok" || v.status.satellite !== "ok") && (
            <p className="note">Source status: ground {v.status.ground}, satellite {v.status.satellite}.</p>
          )}
        </section>
      </main>
    </div>
  );
}
