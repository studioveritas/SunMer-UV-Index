import type { Confidence, UvReading, WhoCategory } from "@/lib/types";
import { whoBand } from "@/lib/who";

export function Category({ category }: { category: WhoCategory | null }) {
  const band = whoBand(category);
  if (!band) return <span className="meta">No data</span>;
  return (
    <span>
      <span className={`swatch uv-${band.category}`} aria-hidden />
      {band.label}
    </span>
  );
}

export function SourceDots({ readings }: { readings: Pick<UvReading, "provider" | "status">[] }) {
  return (
    <span className="dots" aria-label={`${readings.filter((r) => r.status === "ok").length} sources reporting`}>
      {readings.map((r) => (
        <span key={r.provider} className={`dot ${r.status}`} title={`${r.provider}: ${r.status}`} />
      ))}
    </span>
  );
}

export const CONFIDENCE_COPY: Record<Confidence, string> = {
  high: "Sources agree",
  medium: "Sources roughly agree",
  low: "Sources disagree or few reporting",
  none: "No sources reporting",
};
