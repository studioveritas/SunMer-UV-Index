import Link from "next/link";
import { notFound } from "next/navigation";
import { CITIES, getCity } from "@/lib/config/cities";
import { getCityUv } from "@/lib/service";
import { getProvider } from "@/lib/providers";
import { whoBand } from "@/lib/who";
import { Category, CONFIDENCE_COPY } from "../../ui";

export const revalidate = 900;

export function generateStaticParams() {
  return CITIES.map((c) => ({ slug: c.slug }));
}

const STATUS_COPY = {
  ok: "Reporting",
  error: "Unavailable right now",
  not_configured: "Not connected yet",
  not_covered: "Doesn't cover this city",
} as const;

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();

  const { consensus, readings, generatedAt } = await getCityUv(city);
  const band = whoBand(consensus.category);

  return (
    <main>
      <p><Link href="/">All cities</Link></p>
      <h1>{city.name}</h1>
      <p className="lede">
        Peak UV today: <strong>{consensus.todayMax ?? "no data"}</strong>{" "}
        <Category category={consensus.category} />
        {consensus.current !== null && <> Right now: {consensus.current}</>}
      </p>

      {band && <div className="panel">{band.advice}</div>}

      <div className="panel">
        <p>
          Cloud-free sky could reach <strong>{consensus.clearSky.median ?? "–"}</strong>.
          With forecast cloud: <strong>{consensus.cloudAdjusted.median ?? "–"}</strong>.
        </p>
        <p className="meta">
          {CONFIDENCE_COPY[consensus.confidence]} ({consensus.sourcesOk} reporting).
          Updated {new Date(generatedAt).toLocaleString("en-GB", { timeZone: city.tz })}.
        </p>
      </div>

      <h2>By source</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Source</th><th>Measures</th><th>Today</th><th>Next days</th><th>Status</th></tr>
          </thead>
          <tbody>
            {readings.map((r) => {
              const meta = getProvider(r.provider)!.meta;
              return (
                <tr key={r.provider}>
                  <td>{meta.name} <span className="meta">{meta.country}</span></td>
                  <td className="meta">{r.kind === "clear-sky" ? "Cloud-free potential" : "With forecast cloud"}</td>
                  <td>{r.todayMax ?? "–"}</td>
                  <td className="meta">{r.daily.slice(1, 4).map((d) => d.max).join(" / ") || "–"}</td>
                  <td className="meta" title={r.error}>{STATUS_COPY[r.status]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
