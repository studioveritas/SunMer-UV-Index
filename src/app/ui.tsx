import type { CSSProperties } from "react";
import type { UvReading, WhoCategory } from "@/lib/types";
import { orbColors } from "@/lib/palette";
import { whoBand } from "@/lib/who";
import { CORE_PROVIDERS, getProvider } from "@/lib/providers";

export function orbStyle(uvi: number | null): CSSProperties {
  const c = orbColors(uvi);
  return { ["--core" as string]: c.core, ["--mid" as string]: c.mid, ["--outer" as string]: c.outer, ["--s" as string]: c.scale };
}

/** Hero sky. The three dots are the three core national services: filled = reporting. */
export function Sky({ uvi, readings, children }: { uvi: number | null; readings?: Pick<UvReading, "provider" | "status">[]; children?: React.ReactNode }) {
  return (
    <header className="sky" style={orbStyle(uvi)}>
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
  const u = Math.max(0, Math.min(12, uvi ?? 0));
  const rays = 8 + Math.round(u * 2);
  const reach = 0.62 + (u / 12) * 0.38;
  const cx = 160, cy = 110, r = 34;
  const lines = Array.from({ length: rays + 1 }, (_, i) => {
    const a = Math.PI + (i * Math.PI) / rays;
    const len = (i % 2 ? 0.78 : 1) * 118 * reach;
    const w = 4.2;
    const tip = [cx + Math.cos(a) * len, cy + Math.sin(a) * len];
    const b1 = [cx + Math.cos(a + Math.PI / 2) * w, cy + Math.sin(a + Math.PI / 2) * w];
    const b2 = [cx + Math.cos(a - Math.PI / 2) * w, cy + Math.sin(a - Math.PI / 2) * w];
    return `M${b1[0].toFixed(1)} ${b1[1].toFixed(1)} L${tip[0].toFixed(1)} ${tip[1].toFixed(1)} L${b2[0].toFixed(1)} ${b2[1].toFixed(1)} Z`;
  });
  return (
    <svg className="glyph" viewBox="20 0 280 114" role="img" aria-label={`Sun, ${rays} rays`}>
      <g fill="currentColor">
        {lines.map((d, i) => <path key={i} d={d} />)}
        <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy} Z`} />
        <rect x="24" y={cy - 1} width="272" height="2.5" />
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
