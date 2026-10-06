import type { CSSProperties } from "react";
import type { UvReading, WhoCategory } from "@/lib/types";
import { orbColors, phaseSky } from "@/lib/palette";
import { whoBand } from "@/lib/who";
import { sunGlyph } from "@/lib/glyph";
import { CORE_PROVIDERS, getProvider } from "@/lib/providers";

export function orbStyle(uvi: number | null): CSSProperties {
  const c = orbColors(uvi);
  return { ["--core" as string]: c.core, ["--mid" as string]: c.mid, ["--outer" as string]: c.outer, ["--s" as string]: c.scale };
}

/** Hero sky. The three dots are the three core national services: filled = reporting. */
export function Sky({ uvi, readings, phase = "day", children }: { uvi: number | null; readings?: Pick<UvReading, "provider" | "status">[]; phase?: "day" | "dusk" | "night"; children?: React.ReactNode }) {
  const p = phaseSky(phase, uvi);
  const style = { ["--core" as string]: p.core, ["--mid" as string]: p.mid, ["--outer" as string]: p.outer, ["--s" as string]: p.scale, ["--sky-now" as string]: p.sky };
  return (
    <header className="sky" style={style}>
      {phase === "night" && <span className="stars" aria-hidden />}
      {readings && (
        <ul className="status" aria-label="Core sources reporting">
          {CORE_PROVIDERS.map((id) => {
            const on = readings.find((r) => r.provider === id)?.status === "ok";
            return <li key={id} className={on ? "on" : ""} title={`${getProvider(id)!.meta.name}: ${on ? "reporting" : "not reporting"}`} />;
          })}
        </ul>
      )}
      {children}
    </header>
  );
}

export function PaletteDots() {
  return (
    <span className="dots" aria-hidden>
      <i style={{ background: "var(--amber)" }} />
      <i style={{ background: "#ece08a" }} />
      <i style={{ background: "var(--sky)" }} />
    </span>
  );
}

/** Half sun. Rays multiply with the UV index (8 rays at 0, 32 at 12+). */
export function SunGlyph({ uvi }: { uvi: number | null }) {
  const g = sunGlyph(uvi);
  return (
    <svg className="glyph" viewBox={g.viewBox} role="img" aria-label={`Sun, ${g.rays} rays`}>
      <g fill="currentColor">
        {g.paths.map((d, i) => <path key={i} d={d} />)}
        <rect x={g.horizon.x} y={g.horizon.y} width={g.horizon.w} height={g.horizon.h} />
      </g>
    </svg>
  );
}

export function Gauge({ label, value, display, max = 11 }: { label: string; value: number | null; display: React.ReactNode; max?: number }) {
  const at = value === null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="gauge-row">
      <div>
        <p className="label">{label}</p>
        <p className="v">{display}</p>
      </div>
      <span className="gauge" style={{ ["--at" as string]: `calc(${(at * 100).toFixed(1)}% - 1px)` }} aria-hidden />
    </div>
  );
}

export function Category({ category }: { category: WhoCategory | null }) {
  const band = whoBand(category);
  if (!band) return <>No data</>;
  return (
    <>
      <span className="who" style={{ background: `var(--who-${band.category})` }} aria-hidden />
      {band.label}
    </>
  );
}

/** Crescent moon for night mode, same footprint as the sun glyph. */
export function MoonGlyph() {
  return (
    <svg className="glyph" viewBox="20 0 280 114" role="img" aria-label="Moon">
      <path fill="currentColor" d="M170 14a48 48 0 1 0 38 78 40 40 0 1 1-38-78z" />
      <rect x="24" y="109" width="272" height="2.5" fill="currentColor" />
    </svg>
  );
}
