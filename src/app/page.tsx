import Link from "next/link";
import { getAllCitiesUv } from "@/lib/service";
import { Category, CONFIDENCE_COPY, SourceDots } from "./ui";

export const revalidate = 900;

export default async function Home() {
  const cities = await getAllCitiesUv();
  const ranked = [...cities].sort(
    (a, b) => (b.consensus.todayMax ?? -1) - (a.consensus.todayMax ?? -1),
  );

  return (
    <main>
      <h1>Today's UV across Europe</h1>
      <p className="lede">
        Peak UV index today for {cities.length} cities, cross-checked across national weather
        services. Ranked from strongest sun to weakest.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>City</th>
              <th>Peak UV</th>
              <th>Level</th>
              <th>Cloud takes off</th>
              <th>Agreement</th>
              <th>Sources</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ city, consensus, readings }) => (
              <tr key={city.slug}>
                <td>
                  <Link href={`/city/${city.slug}`}>{city.name}</Link>{" "}
                  <span className="meta">{city.country}</span>
                </td>
                <td className="num">{consensus.todayMax ?? "–"}</td>
                <td><Category category={consensus.category} /></td>
                <td>{consensus.cloudEffect !== null ? `−${consensus.cloudEffect}` : "–"}</td>
                <td className="meta">{CONFIDENCE_COPY[consensus.confidence]}</td>
                <td><SourceDots readings={readings} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
