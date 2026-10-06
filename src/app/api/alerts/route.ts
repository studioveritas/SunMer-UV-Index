import { NextResponse } from "next/server";
import { getCity } from "@/lib/config/cities";
import { deleteSub, pushConfigured, saveSub } from "@/lib/alerts";
import { storeIsPersistent } from "@/lib/store";

export const dynamic = "force-dynamic";

/** POST /api/alerts  { subscription, city, threshold, skin? } — subscribe or update. */
export async function POST(req: Request) {
  if (!pushConfigured()) return NextResponse.json({ error: "Alerts are not set up on this server yet." }, { status: 503 });
  const body = await req.json().catch(() => null);
  const endpoint = body?.subscription?.endpoint;
  const threshold = Number(body?.threshold);
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "Missing push subscription." }, { status: 400 });
  }
  if (!getCity(body.city)) return NextResponse.json({ error: "Unknown city." }, { status: 400 });
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 15) {
    return NextResponse.json({ error: "Threshold must be between 1 and 15." }, { status: 400 });
  }
  const skin = [1, 2, 3, 4, 5, 6].includes(body.skin) ? body.skin : undefined;
  const sub = await saveSub({ subscription: body.subscription, city: body.city, threshold, skin });
  return NextResponse.json({ ok: true, id: sub.id, persistent: storeIsPersistent });
}

/** DELETE /api/alerts  { endpoint } — unsubscribe. */
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  await deleteSub(body.endpoint);
  return NextResponse.json({ ok: true });
}
