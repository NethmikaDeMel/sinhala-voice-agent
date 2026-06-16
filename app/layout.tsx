/**
 * app/layout.tsx
 * Root layout — loads Inter (UI) + Noto Sans Sinhala (script) via Google Fonts.
 * Both fonts are subset to the required Unicode ranges to keep bundle size lean.
 */

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/* ── Font definitions ──────────────────────────────────────── */

// Inter: crisp UI sans-serif
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/* ── App metadata ───────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "සිංහල කටහඬ සහායකයා | Sinhala Voice Agent",
  description:
    "Real-time voice-to-voice AI assistant powered by Deepgram STT, Google Gemini, and ElevenLabs TTS — speaking and understanding natural Sinhala.",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#07080f",
  width: "device-width",
  initialScale: 1,
};

/* ── Layout component ───────────────────────────────────────── */

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="si" className={inter.variable}>
      {/*
       * We load Noto Sans Sinhala via a <link> tag in <head> rather than
       * next/font because the Google Fonts API for Noto Sinhala requires
       * the `text` parameter for subsetting — simpler as a raw link.
       */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@300;400;500;600&family=Noto+Serif+Sinhala:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
