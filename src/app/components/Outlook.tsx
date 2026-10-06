import type { OutlookDay } from "@/lib/types";
import { orbStyle } from "../ui";

export function Outlook({ days, tz }: { days: OutlookDay[]; tz: string }) {
  if (!days.length) return <p className="note">No source reaches beyond today yet.</p>;
  const weekday = (date: string) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz }).format(new Date(`${date}T12:00:00Z`));
  return (
    <>
      <div className="outlook">
        {days.map((d) => (
          <div key={d.date} className={`day ${d.kind === "clear-sky" ? "clear" : ""}`}>
            <p className="sublabel">{weekday(d.date)}</p>
            <div className="orb" style={orbStyle(d.max)} aria-hidden />
            <p className="num">{d.max ?? "–"}</p>
          </div>
        ))}
      </div>
      <p className="note">
        Filled: forecast with cloud. Dashed: cloud-free potential only, because no service forecasts cloud that far ahead.
      </p>
    </>
  );
}
