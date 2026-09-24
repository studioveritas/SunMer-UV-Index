import type { City, ProviderMeta, UvReading } from "../types";

export interface Provider {
  meta: ProviderMeta;
  /** Return false if credentials/config are missing — the provider is skipped, not failed. */
  isConfigured(): boolean;
  /** Return false if this source does not cover the city (e.g. a national-only feed). */
  covers(city: City): boolean;
  fetchCity(city: City): Promise<UvReading>;
}

const TIMEOUT_MS = 10_000;

/**
 * fetch() with a timeout and Next.js data-cache revalidation, so upstream
 * services are called at most once per revalidate window per URL,
 * regardless of traffic. This is what keeps us inside free-tier quotas.
 */
export async function cachedFetch(
  url: string,
  revalidateMinutes: number,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: revalidateMinutes * 60 },
  } as RequestInit);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} from ${new URL(url).host}`);
  }
  return res;
}

export function emptyReading(
  meta: ProviderMeta,
  status: UvReading["status"],
  error?: string,
): UvReading {
  return {
    provider: meta.id,
    status,
    kind: meta.kind,
    resolution: meta.resolution,
    current: null,
    todayMax: null,
    daily: [],
    hourly: [],
    fetchedAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
