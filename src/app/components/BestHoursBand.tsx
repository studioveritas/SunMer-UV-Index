import type { BestHours } from "@/lib/bestHours";

const t = (iso: string, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Sunrise to sunset as one strip: low UV (sky), moderate (gold), high (scarlet). */
export function BestHoursBand({ best, tz }: { best: BestHours; tz: string }) {
  const first = Date.parse(best.segments[0]?.start ?? new Date().toISOString());
  const last = Date.parse(best.segments.at(-1)?.end ?? new Date().toISOString());
  const span = Math.max(1, last - first);
  const now = Date.now();
  const nowPct = ((now - first) / span) * 100;

  const headline = best.next
    ? `${t(best.next.start, tz)} to ${t(best.next.end, tz)}`
    : best.lowWindows.length
      ? "Low-UV hours are over for today"
      : "No low-UV daylight today";

  return (
    <div>
      <p className="value">{headline}</p>
      <div className="band" role="img" aria-label="Today's UV by time of day">
        {best.segments.map((s) => (
          <span key={s.start} className={s.level} style={{ width: `${((Date.parse(s.end) - Date.parse(s.start)) / span) * 100}%` }} />
        ))}
        {nowPct > 0 && nowPct < 100 && <i className="now" style={{ left: `${nowPct}%` }} />}
      </div>
      <div className="band-scale">
        <span>{best.sunrise ? `Sunrise ${t(best.sunrise, tz)}` : ""}</span>
        <span>{best.sunset ? `Sunset ${t(best.sunset, tz)}` : ""}</span>
      </div>
      <p className="note">
        {best.protectFrom && best.protectUntil
          ? `UV is 3 or higher from ${t(best.protectFrom, tz)} to ${t(best.protectUntil, tz)}. Outside that, most people need no sun protection.`
          : "UV stays below 3 all day: no sun protection needed for most people."}
      </p>
    </div>
  );
}
