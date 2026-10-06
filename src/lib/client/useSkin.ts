"use client";

import { useCallback, useEffect, useState } from "react";
import type { SkinTypeId } from "../burn";

export interface SkinSettings { skin: SkinTypeId; spf: number; application: "label" | "real-life" }
const KEY = "uv:settings";
const EVENT = "uv:settings";
const DEFAULT: SkinSettings = { skin: 2, spf: 1, application: "real-life" };

function read(): SkinSettings {
  try {
    const legacy = Number(localStorage.getItem("uv:skin"));
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return { ...DEFAULT, ...(legacy ? { skin: legacy as SkinTypeId } : {}), ...(raw ?? {}) };
  } catch {
    return DEFAULT;
  }
}

/** Skin type and sunscreen, kept in this browser only and shared between panels. */
export function useSkin(): [SkinSettings, (patch: Partial<SkinSettings>) => void, boolean] {
  const [s, setS] = useState<SkinSettings>(DEFAULT);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setS(read());
    setReady(true);
    const on = () => setS(read());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const update = useCallback((patch: Partial<SkinSettings>) => {
    const next = { ...read(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      localStorage.setItem("uv:skin", String(next.skin));
    } catch {}
    setS(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [s, update, ready];
}
