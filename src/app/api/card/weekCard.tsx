import type { CityUv } from "@/lib/types";
import type { Week } from "@/lib/week";
import { vibrantFor } from "@/lib/vibrant";
import { orbColors, phaseSky } from "@/lib/palette";

const rgba = (c: string, a: number) => {
  const n = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [255, 255, 255];
  return `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${a})`;
};
const dm = (date: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00Z`)).toUpperCase();
const wd = (date: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(new Date(`${date}T12:00:00Z`)).toUpperCase();

/**
 * Week ahead card for Instagram: one bar per day, each coloured by its own
 * UV level, on a field coloured by the week's strongest day. Works in both
 * looks and all three skies. Text stays inside Instagram's Story safe zone.
 */
export function WeekCard({ uv, week, width, height, host, look }: { uv: CityUv; week: Week; width: number; height: number; host: string; look: "classic" | "vibrant" }) {
  const { city } = uv;
  const tz = city.tz;
  const u = width / 1080;
  const tall = height / width > 1.5;
  const vib = look === "vibrant";
  const phase = uv.phase;
  const dark = phase === "night";
  const days = week.days;
  const max = week.highest?.max ?? 0;

  const paper = vib ? (dark ? "#0A0B14" : phase === "dusk" ? "#FCF6F8" : "#FBFAF8") : dark ? "#121426" : "#F0F0F0";
  const ink = dark ? "#F2F0FB" : vib ? "#0D0D0D" : "#1F1F1F";
  const muted = dark ? "#A3A2BD" : "#7D7D7D";
  const mono = vib ? "Plex Mono Medium" : "Roboto Mono";
  const display = vib ? "Plex Mono" : "Jost";
  const num = vib ? "Plex Mono Light" : "Jost";

  let field: string;
  if (vib) {
    const v = vibrantFor(phase, max);
    field = [
      `radial-gradient(ellipse 70% 40% at 75% 16%, ${rgba(v.a, 0.85)} 0%, ${rgba(v.a, 0.4)} 45%, ${rgba(v.a, 0)} 100%)`,
      `radial-gradient(ellipse 55% 35% at 15% 40%, ${rgba(v.b, 0.75)} 0%, ${rgba(v.b, 0.35)} 45%, ${rgba(v.b, 0)} 100%)`,
      `radial-gradient(ellipse 65% 30% at 60% 100%, ${rgba(v.c, 0.6)} 0%, ${rgba(v.c, 0.25)} 45%, ${rgba(v.c, 0)} 100%)`,
    ].join(", ");
  } else {
    const s = phaseSky(phase, max);
    field = [
      `radial-gradient(ellipse 70% 40% at 75% 14%, ${rgba(s.outer, 0.7)} 0%, ${rgba(s.outer, 0)} 100%)`,
      `radial-gradient(ellipse 55% 35% at 18% 38%, ${rgba(s.mid, 0.55)} 0%, ${rgba(s.mid, 0)} 100%)`,
    ].join(", ");
  }

  const chartH = (tall ? 760 : 470) * u;
  const scaleMax = Math.max(6, Math.ceil(max + 1));
  const strongest = week.highest ? (week.highest.isToday ? "TODAY" : wd(week.highest.date, tz)) : "";
  const label = { display: "flex" as const, fontFamily: mono, fontSize: 26 * u, color: ink, textTransform: "uppercase" as const, letterSpacing: vib ? 0 : 2 * u };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: paper, backgroundImage: field, padding: `${(tall ? 170 : 66) * u}px ${64 * u}px ${(tall ? 250 : 54) * u}px` }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={label}>Week ahead</div>
        <div style={label}>{days.length ? `${dm(days[0].date, tz)} – ${dm(days[days.length - 1].date, tz)}` : ""}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: (tall ? 90 : 50) * u, fontFamily: display, fontSize: (tall ? 112 : 92) * u, lineHeight: 0.98, letterSpacing: vib ? -6 * u : 0, color: ink }}>
        <div style={{ display: "flex" }}>{vib ? city.name.toUpperCase() : city.name}</div>
        <div style={{ display: "flex" }}>{vib ? "UV THIS WEEK" : "UV this week"}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 40 * u }}>
        <div style={{ ...label, fontSize: 28 * u }}>{week.protectDays ? `Protect on ${week.protectDays} of ${days.length} days` : "Low UV all week"}</div>
        {week.highest && <div style={{ ...label, fontSize: 28 * u, marginTop: 10 * u }}>{`Strongest ${strongest} · ${week.highest.max}`}</div>}
      </div>

      {/* bars */}
      <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "space-between", marginTop: 40 * u }}>
        {days.map((d, i) => {
          const h = Math.max(14 * u, (chartH * (d.max ?? 0)) / scaleMax);
          const c = vib ? vibrantFor("day", d.max) : (() => { const o = orbColors(d.max); return { a: o.core, b: o.mid, c: o.outer }; })();
          const barW = (1080 - 128 - 6 * 18) / 7 * u;
          return (
            <div key={d.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: barW }}>
              <div style={{ display: "flex", fontFamily: num, fontSize: (tall ? 46 : 40) * u, color: ink, marginBottom: 14 * u }}>{d.max ?? "–"}</div>
              <div
                style={{
                  display: "flex", width: barW, height: h, borderRadius: `${Math.min(barW / 2, 40 * u)}px ${Math.min(barW / 2, 40 * u)}px ${6 * u}px ${6 * u}px`,
                  ...(d.cloudFreeOnly
                    ? { border: `${3 * u}px dashed ${ink}` }
                    : { backgroundImage: `linear-gradient(to top, ${c.c}, ${c.b} 55%, ${c.a})` }),
                }}
              />
              <div style={{ ...label, fontSize: 24 * u, marginTop: 18 * u }}>{d.isToday ? "Today" : i === 0 && dark ? "Tmrw" : wd(d.date, tz)}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40 * u }}>
        <div style={{ ...label, fontSize: 21 * u, color: muted }}>{days.some((d) => d.cloudFreeOnly) ? "Dashed: cloud-free potential" : "Peak UV index"}</div>
        <div style={{ ...label, fontSize: 22 * u }}>{host}</div>
      </div>
    </div>
  );
}
