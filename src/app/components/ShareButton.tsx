"use client";

import { useState } from "react";

/** Share today's sky card: native share sheet on phones, download elsewhere. */
export function ShareButton({ slug, cityName }: { slug: string; cityName: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function share() {
    setState("busy");
    try {
      const res = await fetch(`/api/card/${slug}?format=story`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const date = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `uv-${slug}-${date}.png`, { type: "image/png" });
      const text = `Today's sky over ${cityName}`;
      const url = `${location.origin}/city/${slug}`;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: text, text: `${text}. ${url}` });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      setState("done");
    } catch (e) {
      setState((e as Error)?.name === "AbortError" ? "idle" : "error");
    }
  }

  return (
    <div>
      <button className="action" onClick={share} disabled={state === "busy"}>
        {state === "busy" ? "Making your card" : "Share today's sky"}
      </button>
      {state === "done" && <p className="note" role="status">Card ready.</p>}
      {state === "error" && <p className="note" role="status">Couldn't make the card. Try again in a moment.</p>}
      <p className="note">
        A portrait card of today's sky over {cityName}.{" "}
        <a href={`/api/card/${slug}?format=square`} target="_blank" rel="noreferrer">Square version</a>.
      </p>
    </div>
  );
}
