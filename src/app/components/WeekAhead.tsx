import type { CityUv } from "@/lib/types";
import type { Week, WeekDay } from "@/lib/week";
import { whoBand } from "@/lib/who";
import { displayTime } from "@/lib/palette";
import { orbStyle } from "../ui";
import { CardDownload } from "./CardDownload";

const name = (d: WeekDay, tz: string, night: boolean, i: number) =>
  d.isToday ? "Today" : night && i === 0 ? "Tomorrow" : new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long" }).format(new Date(`${d.date}T12:00:00Z`));
const short = (d: WeekDay, tz: string) => (d.isToday ? "Today" : new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(new Date(`${d.date}T12:00:00Z`)));
const dayMonth = (d: WeekDay, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(`${d.date}T12:00:00Z`));

export function WeekAhead({ uv, week }: { uv: CityUv; week: Week }) {
  const { city } = uv;
  const tz = city.tz;
  const night = uv.phase === "night";
  const { days, highest, lowest, protectDays, commonLevel } = week;
  if (!days.length) return <section className="block"><p className="note">No service forecasts beyond today yet.</p></section>;

  const level = whoBand(commonLevel)?.label ?? "Unknown";
  const hi = highest ? days.indexOf(highest) : -1;
  const lead = highest ? `${level} UV most days. Strongest on ${name(highest, tz, night, hi)} at ${highest.max}.` : `${level} UV most days.`;
  const scaleMax = Math.max(6, Math.ceil((highest?.max ?? 0) + 1));

  return (
    <>
      <section className="block">
        <p className="label">{night ? "The days ahead" : "This week"}</p>
        <p className="week-head">{lead}</p>
        <p className="note">
          {protectDays ? `Sun protection needed around midday on ${protectDays} of ${days.length} days.` : "UV stays below 3 every day: no sun protection needed for most people."}
        </p>
      </section>

      <section className="block stats">
        <div><p className="label">Highest</p><p className="value">{highest?.max ?? "–"}</p><p className="note">{highest ? `${name(highest, tz, night, hi)}, ${whoBand(highest.category)?.label}` : ""}</p></div>
        <div><p className="label">Lowest</p><p className="value">{lowest?.max ?? "–"}</p><p className="note">{lowest ? `${name(lowest, tz, night, days.indexOf(lowest))}, ${whoBand(lowest.category)?.label}` : ""}</p></div>
        <div><p className="label">Protect days</p><p className="value">{protectDays}<small> / {days.length}</small></p><p className="note">UV 3 or higher</p></div>
      </section>

      <section className="block">
        <p className="label">Peak UV by day</p>
        <div className="strip" style={{ ["--n" as string]: days.length }} role="img" aria-label="Peak UV for each day of the week">
          {days.map((d) => (
            <div key={d.date} className={`col ${d.cloudFreeOnly ? "clear" : ""} ${d.isToday ? "today" : ""}`} style={orbStyle(d.max)}>
              <p>{d.max ?? "–"}</p>
              <div className="well"><span className="stem" style={{ ["--h" as string]: `${((d.max ?? 0) / scaleMax) * 100}%` }} /></div>
              <p>{short(d, tz)}</p>
            </div>
          ))}
        </div>
        <p className="note">Bar colour follows the UV level. Dashed: cloud-free potential only, because no service forecasts cloud that far ahead.</p>
      </section>

      <section className="block">
        <p className="label">Day by day</p>
        <ol className="days">
          {days.map((d, i) => {
            const band = whoBand(d.category);
            return (
              <li key={d.date} className={d.cloudFreeOnly ? "clear" : ""}>
                <p className="when">{name(d, tz, night, i)} · {dayMonth(d, tz)}</p>
                <p className="n">{d.max ?? "–"}</p>
                <p className="meta">
                  {band && <span className="who" style={{ background: `var(--who-${band.category})` }} aria-hidden />}
                  {band?.label ?? "No data"}.{" "}
                  {d.protectFrom && d.protectUntil ? `Protect ${displayTime(d.protectFrom, tz)}–${displayTime(d.protectUntil, tz)}.` : "No protection needed."}
                  {d.sunset ? ` Sunset ${displayTime(d.sunset, tz)}.` : ""}
                  {d.cloudFreeOnly ? " Cloud-free potential." : ""}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="block">
        <p className="label">Post the week ahead</p>
        <CardDownload slug={city.slug} cityName={city.name} kind="week" />
        <p className="note">Seven days, one bar each, coloured by UV level. Made for Monday posting.</p>
      </section>
    </>
  );
}
