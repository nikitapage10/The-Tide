import type { Metadata, Viewport } from "next";
// Self-hosted font files (bundled at build time; no external font service at runtime).
import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import { GlyphTrail } from "@/components/home/GlyphTrail";
import { ScrollReset } from "@/components/shell/ScrollReset";

export const metadata: Metadata = {
  title: { default: "The Tide", template: "%s · The Tide" },
  description: "Private worldbuilding, storytelling and creative project dashboard.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#050506", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ScrollReset />
        {children}
        {/* Site-wide, decorative, never takes input: pointer glyphs and a fine film grain. */}
        <GlyphTrail className="pointer-events-none fixed inset-0 z-[70] h-screen w-screen" />
        <div aria-hidden="true" className="film-grain" />
      </body>
    </html>
  );
}
