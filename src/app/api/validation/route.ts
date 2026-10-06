import { NextResponse } from "next/server";
import { getValidation, pairSeries } from "@/lib/validation";

export const revalidate = 1800;

/** GET /api/validation[?format=csv] — today's paired readings and the forecast scoreboard. */
export async function GET(req: Request) {
  const v = await getValidation();
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const rows = pairSeries(v.ground, v.satellite).map((p) => `${p.time},${p.ground},${p.satellite}`);
    return new NextResponse(["time_utc,rivm_ground_uvi,knmi_satellite_uvi", ...rows].join("\n"), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="uv-ground-truth-${v.date}.csv"` },
    });
  }
  return NextResponse.json(v);
}
