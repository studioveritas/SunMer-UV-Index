import { describe, expect, it } from "vitest";
import { altitudeFactor, faceFactor, snowIndexFactor, snowSurface, seaSurface, wetsuitFor, lensFor } from "../src/lib/exposure";
import { parseMarine, parseSnow } from "../src/lib/providers/conditions";
import { seasonFor } from "../src/lib/season";
import { SPOTS, SEA_SPOTS, SNOW_SPOTS } from "../src/lib/config/spots";
import { CITIES } from "../src/lib/config/cities";
import { getSpotUv, scaleUv } from "../src/lib/spotService";
import { demoCityUv } from "../src/lib/demo";

describe("exposure model", () => {
  it("raises UV 8% per km by default, relative to the reference height", () => {
    expect(altitudeFactor(0, 1000)).toBeCloseTo(1.08, 5);
    expect(altitudeFactor(1000, 1000)).toBe(1);
    expect(altitudeFactor(1300, 2800)).toBeCloseTo(1.224 / 1.104, 3);
    expect(altitudeFactor(0, 3000, 0.05)).toBeLessThan(altitudeFactor(0, 3000, 0.12));
  });
  it("snow lifts the index by under 30% (NIWA), less at height", () => {
    const low = snowIndexFactor(0.85, 1000);
    const high = snowIndexFactor(0.85, 3000);
    expect(low).toBeGreaterThan(1.2);
    expect(low).toBeLessThan(1.3);
    expect(high).toBeLessThan(low);
    expect(snowIndexFactor(0.05, 2000)).toBeCloseTo(1, 5);
  });
  it("face dose adds half the ground's reflectance", () => {
    expect(faceFactor(0.8)).toBeCloseTo(1.4);
    expect(faceFactor(0.15)).toBeCloseTo(1.075);
  });
  it("classifies surfaces", () => {
    expect(snowSurface({ depthM: 0.8, freshCm48h: 20 })).toBe("fresh-snow");
    expect(snowSurface({ depthM: 0.8, freshCm48h: 0 })).toBe("snow");
    expect(snowSurface({ depthM: 0, freshCm48h: 0 })).toBe("no-snow");
    expect(snowSurface({ depthM: null, freshCm48h: null }, true)).toBe("snow");
    expect(seaSurface("surf", 1.5)).toBe("foam");
    expect(seaSurface("surf", 0.3)).toBe("water");
    expect(seaSurface("beach", 2)).toBe("sand");
  });
  it("wetsuit and lens advice follow the conditions", () => {
    expect(wetsuitFor(13)!.suit).toBe("3/2 or 4/3 mm");
    expect(wetsuitFor(6)!.exposed).toBe("Face only");
    expect(wetsuitFor(null)).toBeNull();
    expect(lensFor("fresh-snow", 4, 3200)).toMatch(/Category 4/);
    expect(lensFor("no-snow", 1, 1500)).toBe("Category 2");
  });
});

describe("conditions parsers", () => {
  const iso = (d: Date) => d.toISOString().slice(0, 16);
  const now = new Date();
  it("reads snow depth now and 48 h snowfall", () => {
    const json = { hourly: { time: [iso(new Date(now.getTime() - 3600_000)), iso(now)], snow_depth: [0.5, 0.62] }, daily: { snowfall_sum: [4, 6.5, 1] } };
    expect(parseSnow(json)).toEqual({ snowDepthM: 0.62, freshCm48h: 11.5 });
    expect(parseSnow({})).toEqual({ snowDepthM: null, freshCm48h: null });
  });
  it("reads waves and sea temperature", () => {
    const json = { hourly: { time: [iso(now)], wave_height: [1.8], wave_period: [11], sea_surface_temperature: [14.2] } };
    expect(parseMarine(json)).toEqual({ waveM: 1.8, wavePeriodS: 11, seaC: 14.2 });
  });
});

describe("seasons", () => {
  it("uses meteorological seasons", () => {
    expect(seasonFor(new Date("2026-10-26T10:00:00Z"))).toBe("autumn");
    expect(seasonFor(new Date("2027-01-15T10:00:00Z"))).toBe("winter");
    expect(seasonFor(new Date("2027-04-10T10:00:00Z"))).toBe("spring");
    expect(seasonFor(new Date("2027-07-10T10:00:00Z"))).toBe("summer");
  });
});

describe("spots", () => {
  it("has unique slugs that don't clash with cities, and sane elevations", () => {
    const slugs = [...SPOTS.map((s) => s.slug), ...CITIES.map((c) => c.slug)];
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(SEA_SPOTS.filter((s) => s.country === "GB").length).toBeGreaterThanOrEqual(10);
    expect(SEA_SPOTS.filter((s) => s.country === "FR").length).toBeGreaterThanOrEqual(8);
    for (const c of ["FR", "AT", "IT"]) expect(SNOW_SPOTS.filter((s) => s.country === c).length).toBeGreaterThanOrEqual(6);
    for (const s of SNOW_SPOTS) {
      expect(s.base).toBeLessThan(s.slopes!);
      expect(s.slopes!).toBeLessThanOrEqual(s.summit!);
      expect(s.skip).toContain("met-office");
    }
  });
  it("scales every UV figure evenly", () => {
    const uv = demoCityUv(CITIES[0]);
    const up = scaleUv(uv, 1.5);
    expect(up.consensus.todayMax).toBeCloseTo((uv.consensus.todayMax ?? 0) * 1.5, 0);
    expect(up.hourlyCurve[12].uvi).toBeCloseTo(uv.hourlyCurve[12].uvi * 1.5, 0);
    expect(up.outlook[0]?.max ?? 0).toBeCloseTo((uv.outlook[0]?.max ?? 0) * 1.5, 0);
  });
  it("summit > slopes > village for a ski resort", async () => {
    process.env.UV_DEMO = "1";
    const s = await getSpotUv(SNOW_SPOTS.find((x) => x.slug === "val-thorens")!);
    const [summit, slopes, village] = s.ladder;
    if (s.raw !== null) {
      expect(summit.uvi!).toBeGreaterThanOrEqual(slopes.uvi!);
      expect(slopes.uvi!).toBeGreaterThanOrEqual(village.uvi!);
      expect(s.factor).toBeGreaterThan(1);
    }
  });
});
