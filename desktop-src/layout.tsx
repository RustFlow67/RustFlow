import type { ReactNode } from 'react';
import Link from 'next/link';
import { SystemPlanProvider } from '@/components/catalog/SystemPlan';
import { HARDWARE_PRESETS } from '@/lib/models/preset';
import { TWEAKS_LITE } from '@/lib/tweaks';
import { LanguageProvider } from '@/components/LanguageProvider';
import DesktopTitlebar from '@/components/DesktopTitlebar';
import { RouteScroll, RouteSurface } from '@/components/RouteLink';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';
import './glass.css';
import './report.css';
import './standard.css';
import './workspace.css';
import './island.css';
import './shift.css';
import './cinema.css';

const index={presets:HARDWARE_PRESETS.map(({title,slug,cpuId,gpuId,ramGb,resolution})=>({title,slug,cpuId,gpuId,ramGb,resolution})),steps:TWEAKS_LITE.map(({slug,riskLevel,evidence,excludeFromPack,windowsVersion})=>({slug,riskLevel,evidence,excludeFromPack,windowsVersion}))};
export default function DesktopLayout({children}:{children:ReactNode}) {
  return <html lang="ru" data-material="liquid" data-theme="dark"><body><LanguageProvider><DesktopTitlebar/><ToastProvider><SystemPlanProvider index={index}><RouteScroll><header style={{padding:'64px 24px 0',display:'flex',gap:24}}><Link href="/">SHIFT.</Link><Link href="/benchmark/">Сборка</Link><Link href="/presets/">Пресеты</Link><Link href="/tweaker/">Твикер</Link></header><main className="rf-main"><RouteSurface>{children}</RouteSurface></main></RouteScroll></SystemPlanProvider></ToastProvider></LanguageProvider></body></html>;
}
