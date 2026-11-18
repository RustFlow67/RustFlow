import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Backdrop from "@/components/Backdrop";
import { AccountProvider } from "@/components/auth/AccountProvider";
import Effects from "@/components/Effects";
import PaletteMount from "@/components/addons/PaletteMount";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import PwaRegistration from "@/components/PwaRegistration";
import { RouteScroll } from "@/components/RouteLink";
import { ToastProvider } from "@/components/ui/Toast";

const title = "RustFlow: сборка, твики и пресеты для Rust";
const description = "Оцените сборку под Rust, сравните пресеты по FPS и 1% low и соберите ZIP с настройками и откатом. База знаний, мифы и EAC.";

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
    { media: "(prefers-color-scheme: light)", color: "#F2EFEA" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0908" },
  ],
  colorScheme: "dark light",
};

// Resolve theme and reduced motion before the first visible content.
const BOOT = `(function(){var d=document.documentElement,m=window.matchMedia;var t='system',r='auto',l=null;try{t=localStorage.getItem('rustflow:theme')||t;r=localStorage.getItem('rustflow:motion')||r;l=localStorage.getItem('rustflow:lite')}catch(e){}var theme=t==='dark'||t==='light'?t:(m&&m('(prefers-color-scheme: light)').matches?'light':'dark');d.setAttribute('data-theme',theme);d.style.colorScheme=theme;d.setAttribute('data-motion',r==='reduced'||(r!=='full'&&m&&m('(prefers-reduced-motion: reduce)').matches)?'reduced':'full');if(l==='1'||(l!=='0'&&(navigator.connection&&navigator.connection.saveData||navigator.deviceMemory&&navigator.deviceMemory<=2)))d.setAttribute('data-lite','');})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ru" suppressHydrationWarning>
    <head>
      <link rel="preload" href="/fonts/unbounded-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/fonts/unbounded-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
    </head>
    <body className="antialiased">
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <a href="#main-content" className="skip-link">Перейти к содержимому</a>
      <Backdrop />
      <ToastProvider>
        <AccountProvider>
          <RouteScroll>
            <Nav />
            <main id="main-content" tabIndex={-1} className="rf-main mx-auto w-full max-w-6xl px-3.5 outline-none sm:px-6">
              {children}
            </main>
            <Footer />
            <PaletteMount />
          </RouteScroll>
        </AccountProvider>
      </ToastProvider>
      <Effects />
      <PwaRegistration />
    </body>
  </html>;
}
