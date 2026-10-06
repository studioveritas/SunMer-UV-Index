import { NextResponse } from "next/server";
import { runAlerts } from "@/lib/alerts";

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
  return NextResponse.json(await runAlerts());
}
