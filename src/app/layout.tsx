import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./glass.css";
import "./report.css";
import "./standard.css";
import "./workspace.css";
import "./island.css";
import "./shift.css";
import "./cinema.css";
import "./experience.css";
import "./showcase.css";
import Onboarding from "@/components/Onboarding";
import SkipLink from "@/components/SkipLink";
import { LanguageProvider } from "@/components/LanguageProvider";
import Backdrop from "@/components/Backdrop";
import PwaRegistration from "@/components/PwaRegistration";
import Effects from "@/components/Effects";
import CustomCursor from "@/components/CustomCursor";
import GlitchPulse from "@/components/GlitchPulse";
import Nav from "@/components/Nav";

const title = "SHIFT — осознанный подход к Rust";
const description = "SHIFT — независимый проект о настройках Rust, стабильности кадров и осознанном подходе к производительности.";

function siteOrigin() {
  try {
    const config = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
    if (["http:", "https:"].includes(config.protocol)) return new URL(config.origin);
  } catch { /* No public deployment URL provided. */ }
  return new URL("https://shift.invalid");
}

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: { default: title, template: "%s · SHIFT" },
  description,
  applicationName: "SHIFT",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "SHIFT", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", locale: "ru_RU", siteName: "SHIFT", title, description },
  twitter: { card: "summary", title, description },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ru" data-material="liquid" data-theme="dark" data-dock="top" data-motion="full" suppressHydrationWarning>
    <head>
      <script async src="/shift-recovery.js" />
      <link rel="preload" href="/fonts/inter-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
    </head>
    <body className="antialiased">
      <PwaRegistration />
      <Backdrop />
      <LanguageProvider><Onboarding>
        <SkipLink />
        <Nav />
        <main id="main-content" tabIndex={-1} className="rf-main w-full outline-none">{children}</main>
      </Onboarding></LanguageProvider>
      <Effects />
      <CustomCursor />
      <GlitchPulse />
    </body>
  </html>;
}
