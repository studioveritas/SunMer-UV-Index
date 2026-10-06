import { NextResponse } from "next/server";
import { runAlerts } from "@/lib/alerts";
import { recordForecasts } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/alerts — called by Vercel Cron (or any scheduler).
 * Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when
 * CRON_SECRET is set; external schedulers must send the same header.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  // The morning run also records each service's forecast for Bilthoven,
  // so the ground-truth scoreboard can score it against RIVM tomorrow.
  const recorded = await recordForecasts().catch((e) => `error: ${e instanceof Error ? e.message : e}`);
  return NextResponse.json({ ...(await runAlerts()), forecastsRecorded: recorded });
}
