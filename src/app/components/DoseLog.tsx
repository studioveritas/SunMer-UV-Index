"use client";

import { useEffect, useMemo, useState } from "react";
import { burnMinutes, doseBetween, effectiveSpf, medFor, type UvCurve } from "@/lib/burn";
import { useSkin } from "@/lib/client/useSkin";

interface Session { start: number; end: number | null; spf: number }

const fmtTime = (t: number, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(t));

/**
 * Personal dose so far. Log time outside (a live timer or quick add);
 * we integrate the UV curve over each session (KNMI measurements where we
 * have them, forecast elsewhere) and show it against your burn dose.
 * Everything stays in this browser.
 */
export function DoseLog({ curve, tz, date }: { curve: UvCurve; tz: string; date: string }) {
  const [settings] = useSkin();
  const key = `uv:dose:${date}`;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    try { setSessions(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch {}
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [key]);

  const save = (next: Session[]) => {
    setSessions(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  };

  const spfNow = effectiveSpf(settings.spf, settings.application);
  const outside = sessions.find((s) => s.end === null);
  const med = medFor(settings.skin);

  const { dose, pct, left } = useMemo(() => {
    if (now === null) return { dose: 0, pct: 0, left: null as number | null };
    const d = sessions.reduce((sum, s) => sum + doseBetween(curve, s.start, s.end ?? now, s.spf), 0);
    return {
      dose: d,
      pct: Math.round((d / med) * 100),
      left: d >= med ? 0 : burnMinutes(curve, new Date(now), settings.skin, spfNow, 10, d),
    };
  }, [sessions, curve, now, med, settings.skin, spfNow]);

  const start = () => save([...sessions, { start: Date.now(), end: null, spf: spfNow }]);
  const stop = () => save(sessions.map((s) => (s.end === null ? { ...s, end: Date.now() } : s)));
  const add = (min: number) => save([...sessions, { start: Date.now() - min * 60_000, end: Date.now(), spf: spfNow }]);
  const remove = (i: number) => save(sessions.filter((_, j) => j !== i));

  if (now === null) return null;

  return (
    <div>
      <div className="bar" aria-label={`${pct}% of your burn dose`}>
        <span className="fill" style={{ ["--w" as string]: `${Math.min(100, pct)}%` }} />
        <span className="n">{pct}<small>% of burn dose</small></span>
      </div>
      <p className="note">
        {(dose / 100).toFixed(1)} SED today (standard erythema doses).{" "}
        {pct >= 100
          ? "You've reached your burn dose. Get into the shade."
          : pct >= 75
            ? "Close to your limit. Cover up or head inside soon."
            : left !== null && outside
              ? `At this rate you reach your burn dose in about ${left} min.`
              : sessions.length === 0
                ? "Log time outside to see your dose."
                : ""}
      </p>

      {outside
        ? <button className="action" onClick={stop}>I'm back inside</button>
        : <button className="action" onClick={start}>I'm going outside</button>}
      <ul className="chips" aria-label="Add time already spent outside">
        {[15, 30, 60].map((m) => <li key={m}><button className="chip" onClick={() => add(m)}>Add last {m} min</button></li>)}
      </ul>

      {sessions.length > 0 && (
        <ul className="sessions">
          {sessions.map((s, i) => (
            <li key={s.start}>
              <span>
                {fmtTime(s.start, tz)}–{s.end ? fmtTime(s.end, tz) : "now"}
                {s.spf > 1 ? `, SPF ${Math.round(s.spf)} effective` : ", no sunscreen"}
              </span>
              <button onClick={() => remove(i)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <p className="note">Uses KNMI measurements where available, otherwise the forecast. Saved in this browser only, cleared each day.</p>
    </div>
  );
}
