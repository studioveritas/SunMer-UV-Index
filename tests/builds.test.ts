import { describe, expect, it } from "vitest";
import { burnMinutes, effectiveSpf, fromHourly } from "@/lib/burn";
import { buildHourlyCurve, buildOutlook } from "@/lib/consensus";
import { decideAlert } from "@/lib/alerts";
import { decodeCfTime, extractCities, inBenelux } from "@/lib/providers/knmiObserved";
import { CITIES } from "@/lib/config/cities";
import type { UvReading } from "@/lib/types";

const flat = (uvi: number, hours = 12) =>
  Array.from({ length: hours }, (_, i) => ({ time: new Date(Date.UTC(2026, 6, 1, 8 + i)).toISOString(), uvi }));

describe("burn time", () => {
  it("matches the closed form at constant UV", () => {
    // Type II, MED 250 J/m²; UVI 6 -> 0.15 W/m² -> 250/0.15 s = 27.8 min
    expect(burnMinutes(fromHourly(flat(6)), new Date(Date.UTC(2026, 6, 1, 9)), 2)).toBe(28);
  });
  it("scales with SPF", () => {
    expect(burnMinutes(fromHourly(flat(6)), new Date(Date.UTC(2026, 6, 1, 9)), 2, 2)).toBe(56);
  });
  it("returns null when the dose isn't reached", () => {
    expect(burnMinutes(fromHourly(flat(0.5, 4)), new Date(Date.UTC(2026, 6, 1, 9)), 6)).toBeNull();
  });
  it("real-life sunscreen is far weaker than the label", () => {
    expect(effectiveSpf(50, "label")).toBe(50);
    expect(Math.round(effectiveSpf(50, "real-life"))).toBe(7);
  });
});

const r = (provider: any, kind: UvReading["kind"], daily: { date: string; max: number }[], hourly: { time: string; uvi: number }[] = []): UvReading => ({
  provider, kind, status: "ok", resolution: hourly.length ? "hourly" : "daily-max", current: null, todayMax: null, daily, hourly, fetchedAt: "",
});

describe("outlook", () => {
  it("uses cloud-adjusted where available and falls back to clear-sky", () => {
    const days = buildOutlook([
      r("cams", "cloud-adjusted", [{ date: "2026-07-02", max: 5 }, { date: "2026-07-03", max: 6 }]),
      r("knmi-temis", "clear-sky", [2, 3, 4, 5, 6].map((d) => ({ date: `2026-07-0${d}`, max: 7 }))),
    ], "2026-07-01");
    expect(days.map((d) => d.kind)).toEqual(["cloud-adjusted", "cloud-adjusted", "clear-sky", "clear-sky", "clear-sky"]);
    expect(days[0].max).toBe(5);
    expect(days[2].max).toBe(7);
  });
});

describe("hourly curve", () => {
  it("takes the median of hourly cloud-adjusted sources", () => {
    const t = "2026-07-01T12:00:00.000Z";
    const curve = buildHourlyCurve([
      r("met-office", "cloud-adjusted", [], [{ time: t, uvi: 4 }]),
      r("cams", "cloud-adjusted", [], [{ time: t, uvi: 6 }]),
      r("met-norway", "clear-sky", [], [{ time: t, uvi: 9 }]),
    ]);
    expect(curve).toEqual([{ time: t, uvi: 5 }]);
  });
});

describe("alert decisions", () => {
  const base = { threshold: 6, localHour: 8, todayPeak: 7, current: 2, sentHeadsUp: false, sentNow: false };
  it("sends a morning heads-up when today will reach the threshold", () => expect(decideAlert(base)).toBe("heads-up"));
  it("sends 'now' once UV crosses", () => expect(decideAlert({ ...base, current: 6.2, localHour: 13, sentHeadsUp: true })).toBe("now"));
  it("never repeats", () => expect(decideAlert({ ...base, current: 7, sentHeadsUp: true, sentNow: true })).toBeNull());
  it("stays quiet below threshold", () => expect(decideAlert({ ...base, todayPeak: 4 })).toBeNull());
});

describe("KNMI Benelux NetCDF4 reader", () => {
  it("decodes CF time units", () => {
    expect(decodeCfTime([0, 900], "seconds since 2026-07-01 03:00:00")).toEqual(["2026-07-01T03:00:00.000Z", "2026-07-01T03:15:00.000Z"]);
  });

  it("finds the nearest grid cell in a real NetCDF4/HDF5 file", async () => {
    const h5wasm = (await import("h5wasm/node")).default;
    await h5wasm.ready;
    const path = "/tmp/knmi-test.nc";
    const lat = [52.0, 52.25, 52.5]; // Amsterdam 52.37 -> index 1
    const lon = [4.75, 5.0];         // Amsterdam 4.90  -> index 1
    const nt = 2;
    const cloudy = new Float32Array(nt * lat.length * lon.length).fill(-1);
    const clear = new Float32Array(cloudy.length).fill(-1);
    // (time, lat, lon) layout
    const idx = (t: number, y: number, x: number) => t * lat.length * lon.length + y * lon.length + x;
    cloudy[idx(0, 1, 1)] = 3.21; clear[idx(0, 1, 1)] = 4.5;
    cloudy[idx(1, 1, 1)] = 3.84; clear[idx(1, 1, 1)] = 4.7;

    const w = new h5wasm.File(path, "w");
    w.create_dataset({ name: "latitude", data: new Float32Array(lat), shape: [lat.length] });
    w.create_dataset({ name: "longitude", data: new Float32Array(lon), shape: [lon.length] });
    w.create_dataset({ name: "time", data: new Float64Array([0, 900]), shape: [nt] });
    (w.get("time") as any).create_attribute("units", "seconds since 2026-07-01 10:00:00");
    w.create_dataset({ name: "uvi_cloudy", data: cloudy, shape: [nt, lat.length, lon.length] });
    w.create_dataset({ name: "uvi_clear", data: clear, shape: [nt, lat.length, lon.length] });
    w.close();

    const f = new h5wasm.File(path, "r");
    const amsterdam = CITIES.find((c) => c.slug === "amsterdam")!;
    const out = extractCities(f as any, [amsterdam]);
    f.close();
    expect(out.amsterdam).toEqual([
      { time: "2026-07-01T10:00:00.000Z", uvi: 3.2, clear: 4.5 },
      { time: "2026-07-01T10:15:00.000Z", uvi: 3.8, clear: 4.7 },
    ]);
  });

  it("knows which cities are in the Benelux grid", () => {
    const inside = CITIES.filter(inBenelux).map((c) => c.slug);
    expect(inside).toEqual(["amsterdam", "rotterdam", "brussels", "luxembourg"]);
  });
});
