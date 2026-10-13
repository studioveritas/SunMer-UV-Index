import type { CityUv } from "@/lib/types";
import { vibrantFor } from "@/lib/vibrant";
import { whoBand } from "@/lib/who";
import { bestHours } from "@/lib/bestHours";

const rgba = (c: string, a: number) => {
  const n = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [255, 255, 255];
  return `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${a})`;
};
const time = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const stamp = (d: Date, tz: string) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "2-digit" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}${g("month").toUpperCase()}'${g("year")}`;
};

/**
 * Vibrant Instagram card: big blurred colour field, stacked Plex Mono
 * headline, oversized UV number bleeding off the right edge.
 * The renderer has no blur filter, so softness comes from stacked radial
 * gradients that fade to the same colour at zero alpha.
 */
export function VibrantCard({ uv, width, height, host }: { uv: CityUv; width: number; height: number; host: string }) {
  const { city } = uv;
  const night = uv.phase === "night";
  const day = night && uv.outlook[0] ? new Date(`${uv.outlook[0].date}T12:00:00Z`) : new Date();
  const value = night ? uv.outlook[0]?.max ?? null : uv.consensus.todayMax;
  const band = whoBand(night ? uv.outlook[0]?.category ?? null : uv.consensus.category);
  const v = vibrantFor(uv.phase, value);
  const best = bestHours(uv.uvCurve, day, city.lat, city.lon, new Date(0));

  const paper = night ? "#0B0A12" : uv.phase === "dusk" ? "#FCF6F8" : "#FBFAF8";
  const ink = night ? "#F4F1FF" : "#0D0D0D";
  const u = width / 1080;
  const tall = height / width > 1.5;
  const num = value === null ? "–" : String(value);
  const numSize = (num.length > 2 ? (tall ? 600 : 470) : tall ? 760 : 600) * u;

  const field = [
    `radial-gradient(ellipse 62% 44% at 66% ${tall ? 30 : 34}%, ${rgba(v.a, 0.95)} 0%, ${rgba(v.a, 0.55)} 38%, ${rgba(v.a, 0)} 100%)`,
    `radial-gradient(ellipse 58% 40% at 24% ${tall ? 52 : 58}%, ${rgba(v.b, 0.95)} 0%, ${rgba(v.b, 0.5)} 40%, ${rgba(v.b, 0)} 100%)`,
    `radial-gradient(ellipse 50% 32% at 76% ${tall ? 84 : 88}%, ${rgba(v.c, 0.9)} 0%, ${rgba(v.c, 0.45)} 42%, ${rgba(v.c, 0)} 100%)`,
  ].join(", ");

  const small = { fontFamily: "Plex Mono Medium", fontSize: 26 * u, letterSpacing: 0.5 * u, color: ink, textTransform: "uppercase" as const };
  const rule = { height: 2 * u, backgroundColor: night ? "rgba(244,241,255,0.25)" : "rgba(13,13,13,0.18)", width: "100%" };

  const facts: [string, string][] = [
    ["Level", band ? band.label : "No data"],
    ["Protect", best.protectFrom && best.protectUntil ? `${time(best.protectFrom, city.tz)}–${time(best.protectUntil, city.tz)}` : "Not needed"],
    ["Cloud-free sky", uv.consensus.clearSky.median !== null ? String(uv.consensus.clearSky.median) : "–"],
    ["Sunset", uv.sun.sunset ? time(uv.sun.sunset, city.tz) : "–"],
  ];

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", backgroundColor: paper, backgroundImage: field, padding: `${(tall ? 170 : 66) * u}px ${64 * u}px`, overflow: "hidden" }}>
      {/* top bar */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={small}>{night ? "Tomorrow's UV" : "Today's UV"}</div>
        <div style={small}>{band ? band.label : ""}</div>
      </div>

      {/* stacked headline */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: (tall ? 90 : 56) * u, fontFamily: "Plex Mono", fontSize: (tall ? 112 : 96) * u, lineHeight: 0.98, letterSpacing: -6 * u, color: ink, textTransform: "uppercase" }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {stamp(day, city.tz)}
          <span style={{ fontFamily: "Plex Mono Medium", fontSize: 22 * u, letterSpacing: 0, marginLeft: 24 * u, marginTop: 18 * u }}>({city.country})</span>
        </div>
        <div style={{ display: "flex" }}>{city.name}</div>
        <div style={{ display: "flex" }}>Peak (*) UV</div>
        <div style={{ display: "flex" }}>Index</div>
      </div>

      <div style={{ ...rule, marginTop: 44 * u }} />

      {/* facts */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 26 * u, width: tall ? "70%" : "62%" }}>
        {facts.map(([k, val]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontFamily: "Plex Mono Medium", fontSize: 28 * u, color: ink, textTransform: "uppercase", marginBottom: 10 * u }}>
            <span>{k}</span><span>{val}</span>
          </div>
        ))}
      </div>

      {/* the number, bleeding off the right edge */}
      <div style={{ position: "absolute", right: (num.length === 1 ? 40 : -70) * u, bottom: (tall ? 330 : 120) * u, display: "flex", fontFamily: "Plex Mono Light", fontSize: numSize, lineHeight: 0.8, letterSpacing: -numSize * 0.09, color: ink }}>
        {num}
      </div>

      {/* footer */}
      <div style={{ position: "absolute", left: 64 * u, right: 64 * u, bottom: (tall ? 250 : 54) * u, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={small}>UV index</div>
        <div style={{ ...small, fontSize: 22 * u }}>{host}</div>
      </div>
    </div>
  );
}
