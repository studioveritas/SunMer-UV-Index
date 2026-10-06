import { describe, expect, it } from "vitest";
import { skyPhase, sunTimes, sunAltitude } from "@/lib/sun";
import { bestHours } from "@/lib/bestHours";
import { doseBetween, burnMinutes, mergeObserved, fromHourly } from "@/lib/burn";
import { parseRivm } from "@/lib/providers/rivm";
import { groundDailyPeak, pairSeries, scoreForecasts, stats } from "@/lib/validation";

const AMS = { lat: 52.3676, lon: 4.9041 };
const minutesUtc = (d: Date | null) => (d ? d.getUTCHours() * 60 + d.getUTCMinutes() : NaN);

describe("sun", () => {
  it("matches Amsterdam's midsummer sunrise (~03:18 UTC) and sunset (~20:06 UTC)", () => {
    const t = sunTimes(new Date(Date.UTC(2026, 5, 21, 12)), AMS.lat, AMS.lon);
    expect(Math.abs(minutesUtc(t.sunrise) - (3 * 60 + 18))).toBeLessThanOrEqual(4);
    expect(Math.abs(minutesUtc(t.sunset) - (20 * 60 + 6))).toBeLessThanOrEqual(4);
  });
  it("puts the sun ~61° high at Amsterdam's midsummer noon", () => {
    const t = sunTimes(new Date(Date.UTC(2026, 5, 21, 12)), AMS.lat, AMS.lon);
    expect(sunAltitude(t.noon, AMS.lat, AMS.lon)).toBeCloseTo(61.1, 0);
  });
  it("classifies day, dusk and night", () => {
    expect(skyPhase(new Date(Date.UTC(2026, 5, 21, 11)), AMS.lat, AMS.lon)).toBe("day");
    expect(skyPhase(new Date(Date.UTC(2026, 5, 21, 20, 10)), AMS.lat, AMS.lon)).toBe("dusk");
    expect(skyPhase(new Date(Date.UTC(2026, 5, 21, 23, 30)), AMS.lat, AMS.lon)).toBe("night");
  });
});

/** Bell-shaped summer day around 11:40 UTC, peak 7. */
const summer = () =>
  Array.from({ length: 24 }, (_, h) => ({
    time: new Date(Date.UTC(2026, 5, 21, h)).toISOString(),
    uvi: Math.round(7 * Math.exp(-(((h + 0.5 - 11.67) / 3) ** 2)) * 10) / 10,
  }));

describe("best hours", () => {
  it("finds low-UV windows either side of midday and the protection period", () => {
    const b = bestHours(fromHourly(summer()), new Date(Date.UTC(2026, 5, 21, 12)), AMS.lat, AMS.lon, new Date(Date.UTC(2026, 5, 21, 4)));
    expect(b.lowWindows.length).toBe(2);
    const from = new Date(b.protectFrom!).getUTCHours();
    const until = new Date(b.protectUntil!).getUTCHours();
    expect(from).toBeGreaterThanOrEqual(7);
    expect(from).toBeLessThanOrEqual(9);
    expect(until).toBeGreaterThanOrEqual(14);
    expect(until).toBeLessThanOrEqual(16);
    expect(b.next).not.toBeNull();
  });
});

describe("dose", () => {
  it("integrates a flat UV 4 for one hour to 360 J/m²", () => {
    const flat = fromHourly(Array.from({ length: 6 }, (_, i) => ({ time: new Date(Date.UTC(2026, 5, 21, 9 + i)).toISOString(), uvi: 4 })));
    expect(Math.round(doseBetween(flat, Date.UTC(2026, 5, 21, 10), Date.UTC(2026, 5, 21, 11)))).toBe(360);
  });
  it("counts dose already received when estimating time left", () => {
    const flat = fromHourly(Array.from({ length: 6 }, (_, i) => ({ time: new Date(Date.UTC(2026, 5, 21, 9 + i)).toISOString(), uvi: 4 })));
    // Type II, MED 250: with 150 already, 100 J/m² left at 0.1 W/m² = 1000 s ≈ 17 min
    expect(burnMinutes(flat, new Date(Date.UTC(2026, 5, 21, 11)), 2, 1, 10, 150)).toBe(17);
  });
  it("prefers measurements over forecast up to the last observation", () => {
    const fc = fromHourly([{ time: "2020-01-01T10:00:00.000Z", uvi: 5 }, { time: "2020-01-01T11:00:00.000Z", uvi: 5 }]);
    const merged = mergeObserved(fc, [{ time: "2020-01-01T10:15:00.000Z", uvi: 2 }, { time: "2020-01-01T10:45:00.000Z", uvi: 2.2 }]);
    expect(merged.map((p) => p.uvi)).toEqual([2, 2.2, 5]);
  });
});

describe("RIVM ground data", () => {
  const sample = `Zonkrachtmetingen, 2026
YYYYMMDD hhmm  T.dec   UVI InstCode
20260225 1132 11.533  1.46      nlb
20260225 1143 11.717  1.47      nlb
20260225 1200 12.000  1.46      nlb
20260225 1212 12.200  1.46      nlb`;
  it("parses the published text format (UTC)", () => {
    expect(parseRivm(sample)[1]).toEqual({ time: "2026-02-25T11:43:00.000Z", uvi: 1.47, instrument: "nlb" });
  });
  it("smooths the daily peak with a running median", () => {
    const pts = parseRivm(sample).concat({ time: "2026-02-25T12:20:00.000Z", uvi: 9.9, instrument: "nlb" }, { time: "2026-02-25T12:30:00.000Z", uvi: 1.4, instrument: "nlb" });
    expect(groundDailyPeak(pts, "2026-02-25")).toBe(1.5); // the 9.9 spike is ignored
  });
});

describe("validation statistics", () => {
  const ground = [0, 1, 2, 3].map((i) => ({ time: `2026-07-01T1${i}:05:00.000Z`, uvi: 4 + i, instrument: "nlb" }));
  const sat = [0, 1, 2, 3].map((i) => ({ time: `2026-07-01T1${i}:00:00.000Z`, uvi: 4.5 + i }));
  it("pairs readings within tolerance and reports bias", () => {
    const s = stats(pairSeries(ground, sat));
    expect(s).toMatchObject({ n: 4, bias: 0.5, mae: 0.5, rmse: 0.5, r: 1 });
  });
  it("drops pairs outside the time tolerance", () => {
    expect(pairSeries(ground, sat, 3)).toHaveLength(0);
  });
  it("ranks forecasts by typical miss", () => {
    const rows = scoreForecasts([
      { date: "a", measured: 5, forecast: { cams: { kind: "cloud-adjusted", max: 5.5 }, "knmi-temis": { kind: "clear-sky", max: 7 } } },
      { date: "b", measured: 4, forecast: { cams: { kind: "cloud-adjusted", max: 3.5 }, "knmi-temis": { kind: "clear-sky", max: 6 } } },
    ]);
    expect(rows[0]).toMatchObject({ source: "cams", mae: 0.5, bias: 0 });
    expect(rows[1]).toMatchObject({ source: "knmi-temis", mae: 2, bias: 2 });
  });
});
