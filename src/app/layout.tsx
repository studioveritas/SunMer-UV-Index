import type { Metadata, Viewport } from "next";
import "@fontsource/jost/300.css";
import "@fontsource/jost/400.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/ibm-plex-mono/300.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import "./vibrant.css";
import { LookSwitch } from "./components/LookSwitch";
import { PROVIDERS } from "@/lib/providers";
import { knmiObservedMeta } from "@/lib/providers/knmiObserved";
import { demoMode } from "@/lib/demo";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "UV Europe",
  description: "Today's UV across European cities, cross-checked across national weather services.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "UV Europe", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#C4CFEA", width: "device-width", initialScale: 1 };

/**
 * Design trial. Order of precedence, decided before first paint (no flash):
 *   1. ?look=classic|vibrant in the URL (share a link to force a look)
 *   2. the look this browser was already given (kept, so a tester stays in one arm)
 *   3. NEXT_PUBLIC_LOOK: "classic" | "vibrant" | "split" (random 50/50, then kept)
 * The chosen look is on <html data-look> and window.uvLook for analytics.
 */
const DEFAULT_LOOK = process.env.NEXT_PUBLIC_LOOK ?? "split";
const lookScript = `(function(){try{var d=${JSON.stringify(DEFAULT_LOOK)},k="uv:look",ok=["classic","vibrant"];
var q=new URLSearchParams(location.search).get("look");var s=null;try{s=localStorage.getItem(k)}catch(e){}
var l=ok.indexOf(q)>-1?q:ok.indexOf(s)>-1?s:d==="split"?(Math.random()<.5?"classic":"vibrant"):(ok.indexOf(d)>-1?d:"classic");
try{localStorage.setItem(k,l)}catch(e){}document.documentElement.dataset.look=l;window.uvLook=l;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-look="classic" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: lookScript }} />
      </head>
      <body>
        <div className="field-clip" aria-hidden="true">
          <span className="field" />
          <span className="field-low" />
        </div>
        {children}
        <footer>
          <p>{[...PROVIDERS.map((p) => p.meta.attribution), knmiObservedMeta.attribution, "Ground measurements: RIVM/opendata"].join(". ")}.</p>
          {demoMode && <p>Demo data. Synthetic values for design review, not real UV.</p>}
          <p>UV levels follow the WHO Global Solar UV Index. Forecasts and estimates, not medical advice. <LookSwitch /></p>
        </footer>
      </body>
    </html>
  );
}
