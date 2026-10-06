import type { HourlyValue, ObservedLayer } from "@/lib/types";
import { localDate } from "@/lib/time";

/**
 * Today's UV curve: KNMI satellite measurements (quarter-hourly, filled),
 * the cloud-free potential (dashed), and the forecast (thin line).
 */
export function Curve({ observed, forecast, tz }: { observed: ObservedLayer; forecast: HourlyValue[]; tz: string }) {
  const W = 640, H = 220, padL = 28, padB = 24, padT = 10;
  const hourOf = (iso: string) => {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date(iso));
    return Number(p.find((x) => x.type === "hour")!.value) + Number(p.find((x) => x.type === "minute")!.value) / 60;
  };
  const h0 = 5, h1 = 21;
  const today = localDate(new Date(), tz);
  const todayForecast = forecast.filter((f) => {
    const h = hourOf(f.time);
    return localDate(new Date(f.time), tz) === today && h >= h0 && h <= h1;
  });
  const values = [
    ...observed.series.map((p) => Math.max(p.uvi ?? 0, p.clear ?? 0)),
    ...todayForecast.map((f) => f.uvi),
  ];
  const yMax = Math.max(6, Math.ceil(Math.max(0, ...values) + 1));
  const x = (h: number) => padL + ((h - h0) / (h1 - h0)) * (W - padL - 8);
  const y = (v: number) => padT + (1 - v / yMax) * (H - padT - padB);

  const pts = (arr: { h: number; v: number | null }[]) =>
    arr.filter((p) => p.v !== null && p.h >= h0 && p.h <= h1).map((p) => `${x(p.h).toFixed(1)},${y(p.v as number).toFixed(1)}`);

  const obs = pts(observed.series.map((p) => ({ h: hourOf(p.time), v: p.uvi })));
  const clear = pts(observed.series.map((p) => ({ h: hourOf(p.time), v: p.clear })));
  const fc = pts(todayForecast.map((f) => ({ h: hourOf(f.time) + 0.5, v: f.uvi })));
  const nowH = hourOf(new Date().toISOString());

  return (
    <svg className="curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Today's UV curve: measured, cloud-free and forecast">
      <defs>
        <linearGradient id="obsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--amber)" stopOpacity=".9" />
          <stop offset="60%" stopColor="#ece08a" stopOpacity=".7" />
          <stop offset="100%" stopColor="var(--sky)" stopOpacity=".3" />
        </linearGradient>
      </defs>
      {[0, 3, 6, 8, 11].filter((v) => v <= yMax).map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - 8} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
          <text x={0} y={y(v) + 4}>{v}</text>
        </g>
      ))}
      {[6, 9, 12, 15, 18, 21].map((h) => <text key={h} x={x(h) - 8} y={H - 6}>{String(h).padStart(2, "0")}h</text>)}
      {obs.length > 1 && (
        <polygon points={`${obs[0].split(",")[0]},${y(0)} ${obs.join(" ")} ${obs[obs.length - 1].split(",")[0]},${y(0)}`} fill="url(#obsFill)" />
      )}
      {clear.length > 1 && <polyline points={clear.join(" ")} fill="none" stroke="var(--violet)" strokeWidth="1.5" strokeDasharray="4 4" />}
      {fc.length > 1 && <polyline points={fc.join(" ")} fill="none" stroke="var(--ink)" strokeWidth="1.2" />}
      {nowH >= h0 && nowH <= h1 && <line x1={x(nowH)} x2={x(nowH)} y1={padT} y2={y(0)} stroke="var(--ink)" strokeWidth="2" />}
    </svg>
  );
}
