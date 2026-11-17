import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Backdrop from "@/components/Backdrop";
import CursorGlow from "@/components/CursorGlow";
import Effects from "@/components/Effects";
import Footer from "@/components/Footer";
import FpsLab from "@/components/FpsLab";
import Nav from "@/components/Nav";
import ParticleField from "@/components/ParticleField";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  metadataBase: new URL("https://rustflow.app"),
  title: {
    default: "RustFlow — оценка сборки /10, твики, пресеты и журнал FPS для Rust",
    template: "%s · RustFlow",
  },
  description:
    "Прозрачная оценка сборки /10 под Rust, библиотека проверенных твиков и мифов, пресеты железа с замерами, журнал FPS до/после и полная настройка Windows без риска бана EAC.",
  applicationName: "RustFlow",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "RustFlow",
    title: "RustFlow — твики, бенчмарк и настройка Rust",
    description:
      "Оценка сборки /10, библиотека твиков и мифов, пресеты железа, журнал замеров FPS и полная настройка системы.",
  },
  twitter: {
    card: "summary",
    title: "RustFlow — твики, бенчмарк и настройка Rust",
    description: "Оценка сборки /10, твики, пресеты железа и журнал FPS для Rust.",
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#050609" },
  ],
  colorScheme: "dark light",
};

/**
 * До первого кадра (без мигания темы):
 * 1) data-theme: сохранённый выбор или системная тема;
 * 2) data-motion: full/reduced по выбору пользователя или системе;
 * 3) data-js + data-chromium + data-lite (эконом-режим) как раньше;
 * 4) lab-переменные из localStorage, чтобы фон не прыгал.
 */
const BOOT = `(function(){var d=document.documentElement;try{
var theme='system';try{theme=localStorage.getItem('rustflow:theme')||'system'}catch(e0){}
var sysLight=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches;
d.setAttribute('data-theme',theme==='system'?(sysLight?'light':'dark'):theme);
try{d.style.colorScheme=d.getAttribute('data-theme')}catch(e1){}
var motion='auto';try{motion=localStorage.getItem('rustflow:motion')||'auto'}catch(e2){}
var sysReduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
d.setAttribute('data-motion',(motion==='reduced'||(motion==='auto'&&sysReduce))?'reduced':'full');
d.setAttribute('data-js','');
var nav=navigator;
try{var pref=localStorage.getItem('rustflow:lite');var save=nav.connection&&nav.connection.saveData;var lowMem=nav.deviceMemory&&nav.deviceMemory<=2;var lowCpu=nav.hardwareConcurrency&&nav.hardwareConcurrency<=2;if(pref==='1'||(pref!=='0'&&(save||lowMem||lowCpu)))d.setAttribute('data-lite','')}catch(e3){}
try{var u=nav.userAgentData;if(window.chrome||(u&&u.brands&&u.brands.some(function(b){return /Chromium/.test(b.brand)})))d.setAttribute('data-chromium','')}catch(e4){}
var labOk=false;
try{var lab=JSON.parse(localStorage.getItem('rustflow:lab:v1')||'null');if(lab&&typeof lab==='object'){labOk=true;if(isFinite(lab.blur))d.style.setProperty('--lab-blur',lab.blur+'px');if(isFinite(lab.glow))d.style.setProperty('--lab-glow',lab.glow);if(isFinite(lab.speed))d.style.setProperty('--lab-speed',lab.speed);if(isFinite(lab.layers))d.setAttribute('data-lab-layers',String(Math.round(lab.layers)));if(lab.stress)d.setAttribute('data-lab-stress','')}}catch(e5){}
if(!labOk){try{d.setAttribute('data-lab-layers','3')}catch(e6){}}
setTimeout(function(){if(!window.__rf)d.removeAttribute('data-js')},3500)}catch(fatal){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/manrope-cyrillic-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/manrope-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/unbounded-cyrillic-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body className="antialiased">
        <a href="#main-content" className="skip-link">
          Перейти к содержимому
        </a>
        <svg width="0" height="0" className="pointer-events-none absolute" aria-hidden="true" focusable="false">
          <defs>
            <filter id="lg-refract" x="-5%" y="-20%" width="110%" height="140%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.006 0.014" numOctaves="2" seed="11" result="noise" />
              <feGaussianBlur in="noise" stdDeviation="3" result="soft" />
              <feDisplacementMap
                id="lg-refract-scale"
                in="SourceGraphic"
                in2="soft"
                scale="50"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
        <ToastProvider>
          <Backdrop />
          <ParticleField />
          <CursorGlow />
          <Nav />
          <main
            id="main-content"
            tabIndex={-1}
            className="relative z-[2] mx-auto w-full max-w-6xl px-3.5 pb-10 pt-24 outline-none sm:px-6 lg:pt-28"
          >
            {children}
          </main>
          <Footer />
          <FpsLab />
        </ToastProvider>
        <Effects />
      </body>
    </html>
  );
}
