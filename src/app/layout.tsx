import type { Metadata, Viewport } from "next";
import "@fontsource/jost/300.css";
import "@fontsource/jost/400.css";
import "@fontsource/roboto-mono/400.css";
import "./globals.css";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
