"use client";

import { useEffect, useState } from "react";

type Format = "story" | "post";
const LABEL: Record<Format, string> = { story: "Instagram Story", post: "Instagram Post" };
const SIZE: Record<Format, string> = { story: "1080 × 1920", post: "1080 × 1350" };

/**
 * Download today's UV for a city as a PNG, sized for Instagram.
 * Public: no login. On phones the share sheet opens (save to Photos or
 * post straight to Instagram); elsewhere the file downloads.
 */
export function CardDownload({ slug, cityName, compact = false, kind = "day" }: { slug: string; cityName: string; compact?: boolean; kind?: "day" | "week" }) {
  const [look, setLook] = useState("vibrant");
  const [busy, setBusy] = useState<Format | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => setLook("vibrant"), []);

  const url = (f: Format, dl = false) => `/api/card/${slug}?format=${f}&look=${look}${kind === "week" ? "&kind=week" : ""}${dl ? "&download=1" : ""}`;

  async function get(f: Format) {
    setBusy(f);
    setMsg("");
    try {
      const res = await fetch(url(f));
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const date = new Intl.DateTimeFormat("en-CA").format(new Date());
      const file = new File([blob], `uv-${slug}-${date}-${kind === "week" ? "week-" : ""}${f}.png`, { type: "image/png" });
      const touch = matchMedia("(pointer: coarse)").matches;
      if (touch && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: kind === "week" ? `UV in ${cityName} this week` : `UV in ${cityName} today` });
        setMsg("Saved. Post it from your Photos or Instagram.");
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        setMsg(`Downloaded ${file.name}.`);
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setMsg("Couldn't make the image. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card-dl">
      {!compact && (
        <div className="card-previews">
          {(["story", "post"] as Format[]).map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f} src={url(f)} alt={`${LABEL[f]} preview for ${cityName}`} className={`card-preview ${f}`} loading="lazy" />
          ))}
        </div>
      )}
      <div className="card-buttons">
        {(["story", "post"] as Format[]).map((f) => (
          <button key={f} className="action" onClick={() => get(f)} disabled={busy !== null}>
            {busy === f ? "Making image" : compact ? `${kind === "week" ? "Week " : ""}${f === "story" ? "Story" : "Post"}` : `Download ${kind === "week" ? "week " : ""}${LABEL[f]}`}
          </button>
        ))}
      </div>
      {!compact && <p className="note">PNG, {SIZE.story} for Stories, {SIZE.post} for feed posts. Free to post: please keep the source line.</p>}
      {msg && <p className="note" role="status">{msg}</p>}
      {/* No-JS fallback */}
      <noscript><a href={url("story", true)}>Download Story</a> · <a href={url("post", true)}>Download Post</a></noscript>
    </div>
  );
}
