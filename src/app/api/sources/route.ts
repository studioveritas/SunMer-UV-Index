import { NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/providers";

/** GET /api/sources — provenance, licences and attribution for every source. */
export async function GET() {
  return NextResponse.json(
    PROVIDERS.map((p) => ({ ...p.meta, configured: p.isConfigured() })),
  );
}
