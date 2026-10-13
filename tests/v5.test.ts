import { describe, expect, it } from "vitest";
import { vibrantRGB, vibrantFor } from "@/lib/vibrant";
import { bellCurve, buildWeek } from "@/lib/week";
import { bestHours } from "@/lib/bestHours";
import { demoCityUv } from "@/lib/demo";
import { CITIES } from "@/lib/config/cities";

describe("vibrant palette follows UV", () => {
  it("is blue when low", () => {
    const [a] = vibrantRGB(1);
    expect(a[2]).toBeGreaterThan(a[0]); // more blue than red
  });
  it("is orange-red when high and red when very high", () => {
    const [h] = vibrantRGB(6.5);
    expect(h[0]).toBeGreaterThan(200);
    expect(h[2]).toBeLessThan(80);
    const [v] = vibrantRGB(9);
    expect(v[0]).toBeGreaterThan(190);
    expect(v[1]).toBeLessThan(60);
  });
  it("turns pink-violet at dusk regardless of UV, and darkens at night", () => {
    expect(vibrantFor("dusk", 1).a).toBe(vibrantFor("dusk", 9).a);
    const day = vibrantRGB(5)[0], night = vibrantFor("night", 5).a.match(/\d+/g)!.map(Number);
    expect(night[0]).toBeLessThan(day[0]);
  });
});

describe("week ahead", () => {
  const amsterdam = CITIES.find((c) => c.slug === "amsterdam")!;
  it("builds seven days from today by day, starting tomorrow at night", () => {
    const uv = demoCityUv(amsterdam);
    const day = buildWeek({ ...uv, phase: "day" });
    expect(day.days[0].isToday).toBe(true);
    expect(day.days.length).toBeGreaterThanOrEqual(5);
    const night = buildWeek({ ...uv, phase: "night" });
    expect(night.days[0].isToday).toBe(false);
  });
  it("counts protect days consistently with the level shown", () => {
    const uv = demoCityUv(amsterdam);
    const w = buildWeek({ ...uv, phase: "day" });
    for (const d of w.days) {
      if (d.max === null) continue;
      expect(Math.round(d.max) >= 3).toBe(d.protectFrom !== null);
    }
  });
  it("gives a clear-sky bell its protection window around solar noon", () => {
    const curve = bellCurve("2026-06-21", 7, 52.37, 4.9);
    const b = bestHours(curve, new Date("2026-06-21T12:00:00Z"), 52.37, 4.9, new Date(0));
    expect(new Date(b.protectFrom!).getUTCHours()).toBeGreaterThanOrEqual(7);
    expect(new Date(b.protectUntil!).getUTCHours()).toBeLessThanOrEqual(16);
  });
});
