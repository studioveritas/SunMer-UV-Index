import { describe, expect, it } from "vitest";
import { parseTemis } from "@/lib/providers/knmiTemis";
import { parseMetNorway } from "@/lib/providers/metNorway";
import { parseMetOffice } from "@/lib/providers/metOffice";
import { parseOpenMeteo } from "@/lib/providers/cams";
import { parseDwd } from "@/lib/providers/dwd";
import { CITIES } from "@/lib/config/cities";

describe("TEMIS parser", () => {
  it("reads date / UV / ozone rows from the HTML table", () => {
    const html = `<table><tr><td><i>Date</i></td><td>UV index</td></tr>
      <tr><td>24 Sep 2026</td><td>3.4</td><td>291.2 DU</td></tr>
      <tr><td>25 Sep 2026</td><td>3.1</td><td>301.0 DU</td></tr></table>`;
    expect(parseTemis(html)).toEqual([
      { date: "2026-09-24", max: 3.4 },
      { date: "2026-09-25", max: 3.1 },
    ]);
  });
});

describe("MET Norway parser", () => {
  it("extracts ultraviolet_index_clear_sky and skips missing values", () => {
    const json = { properties: { timeseries: [
      { time: "2026-09-24T11:00:00Z", data: { instant: { details: { ultraviolet_index_clear_sky: 3.2 } } } },
      { time: "2026-09-30T11:00:00Z", data: { instant: { details: {} } } },
    ] } };
    expect(parseMetNorway(json)).toEqual([{ time: "2026-09-24T11:00:00Z", uvi: 3.2 }]);
  });
});

describe("Met Office parser", () => {
  it("reads uvIndex from GeoJSON timeSeries", () => {
    const json = { features: [{ properties: { timeSeries: [
      { time: "2026-09-24T12:00Z", uvIndex: 3 }, { time: "2026-09-24T13:00Z" },
    ] } }] };
    expect(parseMetOffice(json)).toEqual([{ time: "2026-09-24T12:00:00.000Z", uvi: 3 }]);
  });
});

describe("Open-Meteo / CAMS parser", () => {
  it("zips hourly arrays and drops nulls", () => {
    const json = { hourly: { time: ["2026-09-24T12:00", "2026-09-24T13:00"], uv_index: [2.5, null] } };
    expect(parseOpenMeteo(json)).toEqual([{ time: "2026-09-24T12:00:00.000Z", uvi: 2.5 }]);
  });
});

describe("DWD parser", () => {
  const json = {
    forecast_day: "2026-09-24",
    content: [{ city: "München", forecast: { today: 4, tomorrow: 3, dayafter_to: 3 } }],
  };
  it("matches German station names, accent-insensitive", () => {
    const munich = CITIES.find((c) => c.slug === "munich")!;
    expect(parseDwd(json, munich)?.[0]).toEqual({ date: "2026-09-24", max: 4 });
  });
  it("returns null when the city isn't a DWD station", () => {
    const paris = CITIES.find((c) => c.slug === "paris")!;
    expect(parseDwd(json, paris)).toBeNull();
  });
});
