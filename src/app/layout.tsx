import "./globals.css";
import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "MandateSeal - Approve before. Prove after.",
  description:
    "MandateSeal is a trust layer for autonomous AI agents. Pre-action mandate enforcement and post-action signed receipts.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Mono:wght@400;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <NavBar />
          <main className="min-h-[calc(100vh-9rem)]">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
