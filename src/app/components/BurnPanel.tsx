"use client";

import { useEffect, useMemo, useState } from "react";
import { SKIN_TYPES, burnMinutes, effectiveSpf, peakStart, type UvCurve } from "@/lib/burn";
import { useSkin } from "@/lib/client/useSkin";

const SPFS = [1, 15, 30, 50] as const;

function fmt(min: number | null) {
  if (min === null) return { n: "No", unit: "burn likely" };
  if (min >= 120) return { n: (min / 60).toFixed(1).replace(".0", ""), unit: "hr" };
  return { n: String(min), unit: "min" };
}

export function BurnPanel({ curve, tz }: { curve: UvCurve; tz: string }) {
  const [{ skin, spf, application }, update] = useSkin();
  const setSkin = (v: typeof skin) => update({ skin: v });
  const setSpf = (v: number) => update({ spf: v });
  const setApplication = (v: "label" | "real-life") => update({ application: v });
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const result = useMemo(() => {
    if (!now) return null;
    const factor = effectiveSpf(spf, application);
    const endOfDay = new Date(now.getTime() + 18 * 3600_000);
    const peak = peakStart(curve, now, endOfDay);
    return {
      nowMin: burnMinutes(curve, now, skin, factor),
      peakMin: peak ? burnMinutes(curve, peak, skin, factor) : null,
      peakAt: peak ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(peak) : null,
      factor,
    };
  }, [curve, skin, spf, application, now, tz]);

  const type = SKIN_TYPES.find((s) => s.id === skin)!;
  const a = fmt(result?.nowMin ?? null);
  const b = fmt(result?.peakMin ?? null);

  if (curve.length === 0) {
    return <p className="note">Burn time needs an hourly forecast. Connect Met Office or CAMS to enable it.</p>;
  }

  return (
    <div>
      <div className="pair">
        <div>
          <p className="label">Burn time if out now</p>
          <p className="value">{a.n} <small>{a.unit}</small></p>
        </div>
        <div>
          <p className="label">Burn time at peak</p>
          <p className="value">{b.n} <small>{b.unit}</small></p>
          {result?.peakAt && <p className="note">Peak hour starts {result.peakAt}</p>}
        </div>
      </div>

      <p className="label">Skin type</p>
      <ul className="chips" aria-label="Fitzpatrick skin type">
        {SKIN_TYPES.map((s) => (
          <li key={s.id}>
            <button
              className="skin"
              style={{ background: s.tone, color: s.id >= 4 ? "#fff" : "var(--ink)" }}
              aria-pressed={skin === s.id}
              aria-label={`Type ${s.roman}: ${s.describe}`}
              onClick={() => setSkin(s.id)}
            >
              {s.roman}
            </button>
          </li>
        ))}
      </ul>
      <p className="note">Type {type.roman}: {type.describe}.</p>

      <p className="label" style={{ marginTop: "1.6rem" }}>Sunscreen</p>
      <ul className="chips">
        {SPFS.map((v) => (
          <li key={v}><button className="chip" aria-pressed={spf === v} onClick={() => setSpf(v)}>{v === 1 ? "None" : `SPF ${v}`}</button></li>
        ))}
      </ul>
      {spf > 1 && (
        <>
          <ul className="chips">
            <li><button className="chip" aria-pressed={application === "real-life"} onClick={() => setApplication("real-life")}>As people apply it</button></li>
            <li><button className="chip" aria-pressed={application === "label"} onClick={() => setApplication("label")}>As tested</button></li>
          </ul>
          <p className="note">
            {application === "real-life"
              ? `Most people apply about half the tested amount. SPF ${spf} then works like SPF ${Math.round(result?.factor ?? 1)}.`
              : `Assumes the full tested amount: about a shot glass for the whole body.`}
          </p>
        </>
      )}
      <p className="note">An estimate from average skin sensitivity. Individual skin varies, so use it as a guide, not a guarantee.</p>
    </div>
  );
}
