import { NextResponse } from "next/server";
import { getCity } from "@/lib/config/cities";
import { getCityUv } from "@/lib/service";

export const revalidate = 900;

/** GET /api/uv/:city — full detail incl. hourly curves and 3–6 day outlook. */
export async function GET(_req: Request, ctx: { params: Promise<{ city: string }> }) {
  const { city: slug } = await ctx.params;
  const city = getCity(slug);
  if (!city) return NextResponse.json({ error: `Unknown city "${slug}"` }, { status: 404 });
  return NextResponse.json(await getCityUv(city), {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
  });
}
