import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/providers";
import { getCity } from "@/lib/config/cities";

export const dynamic = "force-dynamic";

/** GET /api/health — live probe of every configured source against Amsterdam. */
export async function GET() {
  const city = getCity("amsterdam")!;
  const results = await Promise.all(
    PROVIDERS.map(async (p) => {
      if (!p.isConfigured()) return { provider: p.meta.id, status: "not_configured" };
      if (!p.covers(city)) return { provider: p.meta.id, status: "not_covered" };
      const r = await p.fetchCity(city);
      return { provider: p.meta.id, status: r.status, todayMax: r.todayMax, error: r.error };
    }),
  );
  const ok = results.filter((r) => r.status === "ok").length;
  return NextResponse.json({ ok, total: results.length, results }, { status: ok >= 2 ? 200 : 503 });
}
