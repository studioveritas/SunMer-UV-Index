import type { Metadata } from "next";
import "./globals.css";
import { PROVIDERS } from "@/lib/providers";

export const metadata: Metadata = {
  title: "UV Europe — today's UV index across European cities",
  description: "UV index for key European cities, cross-checked across national meteorological services.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer>
          <p>Data sources: {PROVIDERS.map((p) => p.meta.attribution).join(". ")}.</p>
          <p>UV categories follow the WHO Global Solar UV Index. Forecasts, not medical advice.</p>
        </footer>
      </body>
    </html>
  );
}
