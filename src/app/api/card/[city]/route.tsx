import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getCity } from "@/lib/config/cities";
import { getCityUv } from "@/lib/service";
import { DESCRIPTOR, displayDate, displayTime, phaseSky } from "@/lib/palette";
import { moonGlyphSvg, sunGlyphSvg } from "@/lib/glyph";
import { whoCategory } from "@/lib/who";
import { VibrantCard } from "../vibrantCard";
import { WeekCard } from "../weekCard";
import { buildWeek } from "@/lib/week";

export const runtime = "nodejs";
export const revalidate = 900;

const FORMATS = {
  story: { width: 1080, height: 1920 },  // Instagram / WhatsApp status
  post: { width: 1080, height: 1350 },   // Instagram feed post, 4:5 portrait
  square: { width: 1080, height: 1080 }, // feed posts (square)
  og: { width: 1200, height: 630 },      // link previews
} as const;

const font = (f: string) => readFile(path.join(process.cwd(), "assets/fonts", f));

/** The renderer fades "transparent" through black, so fade to the same colour at zero alpha. */
function rgba(c: string, a: number) {
  const n = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [196, 207, 234];
  return `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${a})`;
}
const svgSrc = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/**
 * GET /api/card/:city?format=story|post|square|og&look=classic|vibrant&kind=day|week&download=1
 * Public: anyone (admin or visitor) can fetch and post it.
 * Today's sky orb as a shareable image. At night it shows tomorrow's peak
 * under a night sky, matching the page.
 */
export async function GET(req: Request, ctx: { params: Promise<{ city: string }> }) {
  const { city: slug } = await ctx.params;
  const city = getCity(slug);
  if (!city) return new Response("Unknown city", { status: 404 });
  const params = new URL(req.url).searchParams;
  const format = (params.get("format") ?? "story") as keyof typeof FORMATS;
  const { width, height } = FORMATS[format] ?? FORMATS.story;
  const look = params.get("look") === "vibrant" ? "vibrant" : "classic";
  const download = params.get("download") === "1";
  const kind = params.get("kind") === "week" ? "week" : "day";

  const uv = await getCityUv(city);
  const host = (process.env.NEXT_PUBLIC_SITE_URL ?? "uv-europe").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: city.tz }).format(new Date());
  const headers: Record<string, string> = { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" };
  if (download) headers["Content-Disposition"] = `attachment; filename="uv-${slug}-${date}-${kind === "week" ? "week-" : ""}${format}-${look}.png"`;

  if (kind === "week") {
    const files = look === "vibrant" ? ["plex-mono-400.woff", "plex-mono-300.woff", "plex-mono-500.woff"] : ["jost-400.woff", "jost-300.woff", "roboto-mono-400.woff"];
    const [f1, f2, f3] = await Promise.all(files.map(font));
    const fonts = look === "vibrant"
      ? [{ name: "Plex Mono", data: f1, weight: 400 as const }, { name: "Plex Mono Light", data: f2, weight: 300 as const }, { name: "Plex Mono Medium", data: f3, weight: 500 as const }]
      : [{ name: "Jost", data: f1, weight: 400 as const }, { name: "Jost Light", data: f2, weight: 300 as const }, { name: "Roboto Mono", data: f3, weight: 400 as const }];
    return new ImageResponse(<WeekCard uv={uv} week={buildWeek(uv)} width={width} height={height} host={host} look={look} />, { width, height, fonts, headers });
  }

  if (look === "vibrant") {
    const [plex, plexLight, plexMedium] = await Promise.all([font("plex-mono-400.woff"), font("plex-mono-300.woff"), font("plex-mono-500.woff")]);
    return new ImageResponse(<VibrantCard uv={uv} width={width} height={height} host={host} />, {
      width,
      height,
      fonts: [
        { name: "Plex Mono", data: plex, weight: 400 },
        { name: "Plex Mono Light", data: plexLight, weight: 300 },
        { name: "Plex Mono Medium", data: plexMedium, weight: 500 },
      ],
      headers,
    });
  }

  const night = uv.phase === "night";
  const value = night ? uv.outlook[0]?.max ?? null : uv.consensus.todayMax;
  const category = night ? whoCategory(value) : uv.consensus.category;
  const sky = phaseSky(uv.phase, value);
  const skyBase = night ? "rgba(22, 24, 46, 1)" : uv.phase === "dusk" ? "rgba(158, 162, 212, 1)" : "rgba(196, 207, 234, 1)";
  const paper = night ? "#121426" : "#F0F0F0";
  const ink = night ? "#EBE8F4" : "#1F1F1F";
  const muted = night ? "#8D90B3" : "#8C8C8C";
  const s = Number(sky.scale);
  const landscape = format === "og";
  const unit = width / 1080;

  const [jost, jostLight, mono] = await Promise.all([font("jost-400.woff"), font("jost-300.woff"), font("roboto-mono-400.woff")]);
  const orb = `radial-gradient(ellipse ${40 * s}% ${82 * s}% at 42% 102%, ${rgba(sky.core, 1)} 0%, ${rgba(sky.core, 0)} 72%), radial-gradient(ellipse ${44 * s}% ${88 * s}% at 63% 104%, ${rgba(sky.mid, 1)} 0%, ${rgba(sky.mid, 0)} 74%), radial-gradient(ellipse ${66 * s}% ${125 * s}% at 55% 108%, ${rgba(sky.outer, 1)} 0%, ${rgba(sky.outer, 0)} 80%)`;
  const label = { fontFamily: "Roboto Mono", textTransform: "uppercase" as const, letterSpacing: 2 * unit, color: ink };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: landscape ? "row" : "column", backgroundColor: paper }}>
        <div style={{ display: "flex", flex: landscape ? "0 0 46%" : format === "story" ? "0 0 52%" : "0 0 46%", backgroundColor: skyBase, backgroundImage: orb }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: `${56 * unit}px ${64 * unit}px`, justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ ...label, fontSize: 34 * unit, display: "flex", alignItems: "center" }}>
                {night ? "Tomorrow's peak UV" : "Today's peak UV"}
                <div style={{ display: "flex", marginLeft: 18 * unit }}>
                  {["#E0914F", "#ECE08A", "#C4CFEA"].map((c) => <div key={c} style={{ width: 20 * unit, height: 20 * unit, borderRadius: 99, backgroundColor: c, marginRight: 10 * unit }} />)}
                </div>
              </div>
              <div style={{ ...label, fontSize: 20 * unit, marginTop: 10 * unit }}>{category ? DESCRIPTOR[category] : "Waiting for sources"}</div>
              {format === "square" && <div style={{ height: 24 * unit }} />}
            </div>
            <div style={{ ...label, fontSize: 34 * unit }}>{displayDate(night && uv.outlook[0] ? new Date(`${uv.outlook[0].date}T12:00:00Z`) : new Date(), city.tz)}</div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "flex-end", fontFamily: "Jost", color: ink, fontSize: (landscape ? 200 : format === "square" ? 210 : 300) * unit, lineHeight: 0.85 }}>
              {value ?? "–"}
              <span style={{ fontFamily: "Jost Light", fontSize: (landscape ? 52 : 78) * unit, color: muted, marginLeft: 14 * unit }}>uvi</span>
            </div>
            <img src={svgSrc(night ? moonGlyphSvg(ink) : sunGlyphSvg(value, ink))} width={(landscape ? 260 : format === "square" ? 320 : 400) * unit} height={(landscape ? 106 : format === "square" ? 130 : 163) * unit} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: "Jost", color: ink, fontSize: 84 * unit }}>{city.name}</div>
              <div style={{ ...label, color: muted, fontSize: 22 * unit, marginTop: 6 * unit }}>
                {uv.sun.sunset ? `Sunset ${displayTime(uv.sun.sunset, city.tz)}` : ""}
              </div>
            </div>
            <div style={{ ...label, color: muted, fontSize: 22 * unit }}>{host}</div>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: "Jost", data: jost, weight: 400 },
        { name: "Jost Light", data: jostLight, weight: 300 },
        { name: "Roboto Mono", data: mono, weight: 400 },
      ],
      headers,
    },
  );
}
