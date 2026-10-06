import { NextResponse } from "next/server";
import { getAllCitiesUv } from "@/lib/service";

export const revalidate = 900; // 15 min; upstream caches are longer

/** GET /api/uv — all cities, consensus + per-source summary (no hourly arrays). */
export async function GET() {
  const data = await getAllCitiesUv();
  const slim = data.map(({ city, consensus, readings, outlook, generatedAt }) => ({
    city,
    consensus,
    outlook,
    generatedAt,
    sources: readings.map(({ provider, status, kind, todayMax, current, error }) => ({
      provider, status, kind, todayMax, current, ...(error ? { error } : {}),
    })),
  }));
  return NextResponse.json(slim, {
    headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
  });
}
