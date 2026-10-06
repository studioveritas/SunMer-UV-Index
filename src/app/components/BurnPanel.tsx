"use client";

import { useEffect, useMemo, useState } from "react";
import type { HourlyValue } from "@/lib/types";
import { SKIN_TYPES, burnMinutes, effectiveSpf, peakStart, type SkinTypeId } from "@/lib/burn";

const SPFS = [1, 15, 30, 50] as const;
const KEY = "uv:skin";

function fmt(min: number | null) {
  if (min === null) return { n: "No", unit: "burn likely" };
  if (min >= 120) return { n: (min / 60).toFixed(1).replace(".0", ""), unit: "hr" };
  return { n: String(min), unit: "min" };
}

export function BurnPanel({ curve, tz }: { curve: HourlyValue[]; tz: string }) {
  const [skin, setSkin] = useState<SkinTypeId>(2);
  const [spf, setSpf] = useState<number>(1);
  const [application, setApplication] = useState<"label" | "real-life">("real-life");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const saved = Number(localStorage.getItem(KEY));
    if (saved >= 1 && saved <= 6) setSkin(saved as SkinTypeId);
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY, String(skin)); } catch {} }, [skin]);

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
