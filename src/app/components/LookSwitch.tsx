"use client";

import { useEffect, useState } from "react";

/** Footer control for the design trial: shows which look you're in and lets you flip. */
export function LookSwitch() {
  const [look, setLook] = useState<string | null>(null);
  useEffect(() => setLook(document.documentElement.dataset.look ?? "classic"), []);
  if (!look) return null;
  const go = (l: string) => {
    const u = new URL(location.href);
    u.searchParams.set("look", l);
    location.href = u.toString();
  };
  return (
    <span className="look-switch">
      Look:
      {["classic", "vibrant"].map((l) => (
        <a key={l} href={`?look=${l}`} aria-current={look === l} onClick={(e) => { e.preventDefault(); go(l); }}>
          {l === "classic" ? "Classic" : "Vibrant"}
        </a>
      ))}
    </span>
  );
}
