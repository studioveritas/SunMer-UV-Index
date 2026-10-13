"use client";

import { useEffect, useState } from "react";

/** Post-format preview in the visitor's current look. */
export function ShareThumb({ slug, alt }: { slug: string; alt: string }) {
  const [look, setLook] = useState<string | null>(null);
  useEffect(() => setLook("vibrant"), []);
  // eslint-disable-next-line @next/next/no-img-element
  return look ? <img src={`/api/card/${slug}?format=post&look=${look}`} alt={alt} loading="lazy" /> : <div style={{ aspectRatio: "4 / 5" }} />;
}
