import { createHash } from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { store } from "./store";
import { getCity } from "./config/cities";
import { getCityUv } from "./service";
import { localDate } from "./time";
import { burnMinutes, type SkinTypeId } from "./burn";

/**
 * UV threshold alerts over Web Push.
 *
 * Two messages, each sent at most once per subscriber per day:
 *   heads-up  — in the morning, if today's forecast peak reaches the threshold
 *   now       — when UV (observed in Benelux, else forecast) crosses it
 *
 * No accounts: a subscription is a browser endpoint plus a city and threshold.
 * We store nothing else, and delete it as soon as the browser reports it gone.
 */

export interface AlertSub {
  id: string;
  subscription: PushSubscription;
  city: string;
  threshold: number;
  skin?: SkinTypeId;
  createdAt: string;
}

const SET = "alerts:subs";
export const subKey = (id: string) => `alerts:sub:${id}`;
export const idFor = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 24);

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function initPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:alerts@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export async function saveSub(input: Omit<AlertSub, "id" | "createdAt">): Promise<AlertSub> {
  const sub: AlertSub = { ...input, id: idFor(input.subscription.endpoint), createdAt: new Date().toISOString() };
  await store.set(subKey(sub.id), JSON.stringify(sub));
  await store.sadd(SET, sub.id);
  return sub;
}

export async function deleteSub(endpoint: string): Promise<void> {
  const id = idFor(endpoint);
  await store.del(subKey(id));
  await store.srem(SET, id);
}

/** Decide which message (if any) a subscriber should get right now. Pure, for testing. */
export function decideAlert(opts: {
  threshold: number;
  localHour: number;
  todayPeak: number | null;
  current: number | null;
  sentHeadsUp: boolean;
  sentNow: boolean;
}): "heads-up" | "now" | null {
  const { threshold, localHour, todayPeak, current, sentHeadsUp, sentNow } = opts;
  if (!sentNow && current !== null && current >= threshold) return "now";
  if (!sentHeadsUp && localHour >= 6 && localHour < 12 && todayPeak !== null && todayPeak >= threshold) return "heads-up";
  return null;
}

export async function runAlerts(): Promise<{ checked: number; sent: number; removed: number }> {
  if (!pushConfigured()) return { checked: 0, sent: 0, removed: 0 };
  initPush();
  const ids = await store.smembers(SET);
  const cityCache = new Map<string, Awaited<ReturnType<typeof getCityUv>>>();
  let sent = 0;
  let removed = 0;

  for (const id of ids) {
    const raw = await store.get(subKey(id));
    if (!raw) continue;
    const sub = JSON.parse(raw) as AlertSub;
    const city = getCity(sub.city);
    if (!city) continue;
    if (!cityCache.has(city.slug)) cityCache.set(city.slug, await getCityUv(city));
    const uv = cityCache.get(city.slug)!;

    const now = new Date();
    const today = localDate(now, city.tz);
    const localHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: city.tz }).format(now));
    const sentHeadsUp = Boolean(await store.get(`alerts:sent:${id}:${today}:heads-up`));
    const sentNow = Boolean(await store.get(`alerts:sent:${id}:${today}:now`));

    const kind = decideAlert({
      threshold: sub.threshold, localHour,
      todayPeak: uv.consensus.todayMax, current: uv.consensus.current,
      sentHeadsUp, sentNow,
    });
    if (!kind) continue;

    const burn = sub.skin ? burnMinutes(uv.hourlyCurve, now, sub.skin) : null;
    const body =
      kind === "now"
        ? `UV is ${uv.consensus.current} in ${city.name} right now.${burn ? ` Unprotected, your skin type burns in about ${burn} min.` : ""}`
        : `UV reaches ${uv.consensus.todayMax} in ${city.name} today. Plan shade around midday.`;

    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({ title: kind === "now" ? `UV ${uv.consensus.current}, ${city.name}` : `High UV today, ${city.name}`, body, url: `/city/${city.slug}` }),
        { TTL: 3 * 3600, urgency: kind === "now" ? "high" : "normal" },
      );
      await store.set(`alerts:sent:${id}:${today}:${kind}`, "1", 36 * 3600);
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await deleteSub(sub.subscription.endpoint);
        removed++;
      }
    }
  }
  return { checked: ids.length, sent, removed };
}
