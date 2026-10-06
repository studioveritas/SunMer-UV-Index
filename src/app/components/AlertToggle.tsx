"use client";

import { useEffect, useState } from "react";

const THRESHOLDS = [
  { v: 3, label: "3 Moderate" },
  { v: 6, label: "6 High" },
  { v: 8, label: "8 Very high" },
  { v: 11, label: "11 Extreme" },
];
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "checking" | "unsupported" | "install-first" | "off" | "on" | "busy" | "denied" | "error";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function AlertToggle({ city, cityName }: { city: string; cityName: string }) {
  const [state, setState] = useState<State>("checking");
  const [threshold, setThreshold] = useState(6);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState(ios && !standalone ? "install-first" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      const saved = localStorage.getItem(`uv:alert:${city}`);
      if (sub && saved) { setThreshold(Number(saved)); setState("on"); } else setState("off");
    });
  }, [city]);

  async function turnOn() {
    if (!VAPID) { setState("error"); setMessage("Alerts aren't set up on this server yet."); return; }
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("denied");
      const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) }));
      const skin = Number(localStorage.getItem("uv:skin")) || undefined;
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, city, threshold, skin }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't save the alert.");
      localStorage.setItem(`uv:alert:${city}`, String(threshold));
      setMessage(`Alert on. You'll hear from us when UV in ${cityName} reaches ${threshold}.`);
      setState("on");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't turn alerts on.");
      setState("error");
    }
  }

  async function turnOff() {
    setState("busy");
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/alerts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    localStorage.removeItem(`uv:alert:${city}`);
    setMessage("Alert off.");
    setState("off");
  }

  if (state === "checking") return null;
  if (state === "unsupported") return <p className="note">This browser can't receive alerts.</p>;
  if (state === "install-first")
    return <p className="note">On iPhone, alerts work once this site is on your Home Screen. Tap Share, then Add to Home Screen, and open it from there.</p>;
  if (state === "denied") return <p className="note">Notifications are blocked for this site. Allow them in your browser settings to turn alerts on.</p>;

  return (
    <div>
      <p className="note">Alert me when UV in {cityName} reaches</p>
      <ul className="chips">
        {THRESHOLDS.map((t) => (
          <li key={t.v}>
            <button className="chip" aria-pressed={threshold === t.v} disabled={state === "on" || state === "busy"} onClick={() => setThreshold(t.v)}>{t.label}</button>
          </li>
        ))}
      </ul>
      {state === "on"
        ? <button className="action ghost" onClick={turnOff}>Turn alert off</button>
        : <button className="action" onClick={turnOn} disabled={state === "busy"}>{state === "busy" ? "Turning alert on" : "Turn alert on"}</button>}
      {message && <p className="note" role="status">{message}</p>}
      <p className="note">A morning heads-up when today will reach your level, and a second alert when it does. At most two a day.</p>
    </div>
  );
}
