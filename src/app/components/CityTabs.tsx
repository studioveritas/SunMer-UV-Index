"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Today / Week ahead. Both panels are server-rendered (the page stays
 * cacheable); this only switches which one is visible. "#week" in the URL
 * opens the week, so a link can point straight at it.
 */
export function CityTabs({ todayLabel, today, week }: { todayLabel: string; today: ReactNode; week: ReactNode }) {
  const [tab, setTab] = useState<"today" | "week">("today");
  useEffect(() => { if (location.hash === "#week") setTab("week"); }, []);
  const choose = (t: "today" | "week") => {
    setTab(t);
    try { history.replaceState(null, "", t === "week" ? "#week" : location.pathname); } catch {}
  };
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Period">
        <button type="button" role="tab" id="tab-today" aria-controls="panel-today" aria-selected={tab === "today"} onClick={() => choose("today")}>{todayLabel}</button>
        <button type="button" role="tab" id="tab-week" aria-controls="panel-week" aria-selected={tab === "week"} onClick={() => choose("week")}>Week ahead</button>
      </div>
      <div id="panel-today" role="tabpanel" aria-labelledby="tab-today" hidden={tab !== "today"} className="tabpanel">{today}</div>
      <div id="panel-week" role="tabpanel" aria-labelledby="tab-week" hidden={tab !== "week"} className="tabpanel">{week}</div>
    </>
  );
}
