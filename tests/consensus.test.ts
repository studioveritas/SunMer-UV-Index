import { describe, expect, it } from "vitest";
import { buildConsensus } from "@/lib/consensus";
import type { UvReading } from "@/lib/types";

const r = (provider: any, kind: UvReading["kind"], todayMax: number | null, status: UvReading["status"] = "ok"): UvReading => ({
  provider, kind, todayMax, status, resolution: "hourly", current: null, daily: [], hourly: [], fetchedAt: "",
});

describe("consensus", () => {
  it("never averages clear-sky with cloud-adjusted", () => {
    const c = buildConsensus([
      r("met-office", "cloud-adjusted", 2.0),
      r("cams", "cloud-adjusted", 2.4),
      r("knmi-temis", "clear-sky", 4.1),
      r("met-norway", "clear-sky", 4.3),
    ]);
    expect(c.headlineKind).toBe("cloud-adjusted");
    expect(c.todayMax).toBe(2.2);
    expect(c.clearSky.median).toBe(4.2);
    expect(c.cloudEffect).toBe(2);
    expect(c.category).toBe("low");
    expect(c.confidence).toBe("high");
  });

  it("falls back to clear-sky when no cloud-adjusted source reports", () => {
    const c = buildConsensus([r("knmi-temis", "clear-sky", 6.2), r("met-office", "cloud-adjusted", null, "error")]);
    expect(c.headlineKind).toBe("clear-sky");
    expect(c.category).toBe("high");
    expect(c.confidence).toBe("low");
  });

  it("flags disagreement", () => {
    const c = buildConsensus([
      r("met-office", "cloud-adjusted", 2), r("cams", "cloud-adjusted", 7), r("dwd", "cloud-adjusted", 3),
    ]);
    expect(c.confidence).toBe("low");
  });

  it("reports none when nothing is available", () => {
    expect(buildConsensus([]).confidence).toBe("none");
  });
});
