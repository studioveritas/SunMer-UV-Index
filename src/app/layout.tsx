import type { Metadata, Viewport } from "next";
import "@fontsource/jost/300.css";
import "@fontsource/jost/400.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/ibm-plex-mono/300.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import "./vibrant.css";
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

export const viewport: Viewport = { themeColor: "#FCF6F8", width: "device-width", initialScale: 1 };

/** Vibrant is the only look. Clears any classic choice remembered from the A/B trial. */
const lookScript = `(function(){try{localStorage.removeItem("uv:look")}catch(e){}document.documentElement.dataset.look="vibrant";window.uvLook="vibrant";})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-look="vibrant" suppressHydrationWarning>
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
          <p>UV levels follow the WHO Global Solar UV Index. Forecasts and estimates, not medical advice.</p>
        </footer>
      </body>
    </html>
  );
}
