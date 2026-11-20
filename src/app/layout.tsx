import { SitePlan, SystemPlanProvider } from "@/components/catalog/SystemPlan";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import { TWEAKS_LITE } from "@/lib/tweaks";
import type { Metadata, Viewport } from "next";
import { Unbounded } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import "./glass.css";
import "./report.css";
import "./finishes.css";
import "./standard.css";
import "./workspace.css";
import "./island.css";
import { APPEARANCE_BOOT } from "@/lib/appearance-boot";
import { GlassAppearance } from "@/components/GlassAppearance";
import VelocityFilters from "@/components/fx/VelocityFilters";
import BlobWallpaper from "@/components/BlobWallpaper";
import LiquidGlassFilters from "@/components/fx/LiquidGlassFilters";
import { AccountProvider } from "@/components/auth/AccountProvider";
import Effects from "@/components/Effects";
import PaletteMount from "@/components/addons/PaletteMount";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import DesktopTitlebar from "@/components/DesktopTitlebar";
import PwaRegistration from "@/components/PwaRegistration";
import { RouteScroll, RouteSurface } from "@/components/RouteLink";
import { ToastProvider } from "@/components/ui/Toast";

const display = Unbounded({
  // Load the display faces when a heading needs them; prefetched Dock routes
  // shouldn't issue speculative font preloads for both alphabets.
  subsets: ["cyrillic", "latin"], weight: ["700", "800", "900"], display: "swap", preload: false, variable: "--font-unbounded",
});

const title = "RustFlow: сборка, твики и пресеты для Rust";
const description = "Оцените сборку под Rust, сравните пресеты по FPS и 1% low и соберите ZIP с настройками и откатом. Дорожная карта, драйверы, Windows и безопасность EAC.";

function siteOrigin() {
  try {
    const config = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
    if (["http:", "https:"].includes(config.protocol)) return new URL(config.origin);
  } catch { /* No public deployment URL provided. */ }
  return new URL("https://rustflow.app");
}

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: { default: title, template: "%s · RustFlow" },
  description,
  applicationName: "RustFlow",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "RustFlow", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", locale: "ru_RU", siteName: "RustFlow", title, description },
  twitter: { card: "summary", title, description },
  icons: { icon: "/icon.svg", apple: "/icons/rustflow-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#090605" },
  ],
  colorScheme: "dark light",
};

// Only identifiers, matching dimensions and selection eligibility enter the
// shared client context. The full instructions and ZIP files stay off that path.
const planIndex={
  presets:HARDWARE_PRESETS.map(({title,slug,cpuId,gpuId,ramGb,resolution})=>({title,slug,cpuId,gpuId,ramGb,resolution})),
  steps:TWEAKS_LITE.map(({slug,riskLevel,evidence,excludeFromPack,windowsVersion})=>({slug,riskLevel,evidence,excludeFromPack,windowsVersion})),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ru" className={display.variable} data-material="amber" data-theme="dark" data-motion="full" suppressHydrationWarning>
    <head>
      <link rel="preload" href="/fonts/inter-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
    </head>
    <body className="antialiased">
      <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT }} />
      <a href="#main-content" className="skip-link">Перейти к содержимому</a>
      <DesktopTitlebar />
      <VelocityFilters />
      <LiquidGlassFilters />
      <BlobWallpaper />
      <ToastProvider>
        <AccountProvider>
          <GlassAppearance><SystemPlanProvider index={planIndex}><RouteScroll>
            <Nav />
            <main id="main-content" tabIndex={-1} className="rf-main mx-auto w-full max-w-6xl px-3.5 outline-none sm:px-6">
              <div className="rf-depth-slot"><div className="rf-depth-plane"><RouteSurface>{children}<SitePlan/></RouteSurface></div></div>
            </main>
            <Footer />
            <PaletteMount />
          </RouteScroll></SystemPlanProvider></GlassAppearance>
        </AccountProvider>
      </ToastProvider>
      <Effects />
      <PwaRegistration />
    </body>
  </html>;
}
