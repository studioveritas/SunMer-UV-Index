/**
 * Tiny key-value store for push subscriptions.
 *
 * Production: Upstash Redis over its REST API (works on Vercel's Marketplace,
 * EU region available). No SDK needed, just fetch.
 * Development: an in-memory Map, so the flow works locally without setup.
 * In-memory data is lost on restart and is NOT shared between serverless
 * instances, so alerts in production require Redis.
 */
const URL_ = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const memory = new Map<string, string>();
const memorySets = new Map<string, Set<string>>();

export const storeIsPersistent = Boolean(URL_ && TOKEN);

async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return (await res.json()).result as T;
}

export const store = {
  async get(key: string): Promise<string | null> {
    return storeIsPersistent ? redis<string | null>("GET", key) : memory.get(key) ?? null;
  },
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (storeIsPersistent) {
      await (ttlSeconds ? redis("SET", key, value, "EX", ttlSeconds) : redis("SET", key, value));
    } else memory.set(key, value);
  },
  async del(key: string): Promise<void> {
    if (storeIsPersistent) await redis("DEL", key);
    else memory.delete(key);
  },
  async sadd(key: string, member: string): Promise<void> {
    if (storeIsPersistent) await redis("SADD", key, member);
    else (memorySets.get(key) ?? memorySets.set(key, new Set()).get(key)!).add(member);
  },
  async srem(key: string, member: string): Promise<void> {
    if (storeIsPersistent) await redis("SREM", key, member);
    else memorySets.get(key)?.delete(member);
  },
  async smembers(key: string): Promise<string[]> {
    return storeIsPersistent ? redis<string[]>("SMEMBERS", key) : [...(memorySets.get(key) ?? [])];
  },
};
