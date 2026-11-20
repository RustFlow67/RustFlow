import { DOCK_KEY } from "./dock-position";
import { ANIMATIONS, DEFAULT_ENGINE, ENGINE_KEY, MATERIALS, PUBLIC_THEME_KEY, WALLPAPERS } from "./materials";
import { LOCAL_ACCOUNT_KEY, QUICK_ID, QUICK_LOGIN } from "./auth/device-keys";

/** Runs before the wallpaper or any card is parsed. Only allowlisted cosmetic
 * values reach CSS. No cached cloud identity, permissions or OAuth tokens. */
export const APPEARANCE_BOOT = `(() => {
  const root = document.documentElement;
  const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const json = (k,max) => { try { const s = read(k); return s && s.length <= max ? JSON.parse(s) : null; } catch { return null; } };
  const dock=read(${JSON.stringify(DOCK_KEY)}); root.dataset.dock=dock==='left'?'left':'bottom';
  if(dock==='top'){try{localStorage.setItem(${JSON.stringify(DOCK_KEY)},'bottom');}catch{}}
  const base = ${JSON.stringify(MATERIALS.filter(m => !m.vip).map(m => m.id))}, vip = ${JSON.stringify(MATERIALS.filter(m => m.vip).map(m => m.id))};
  const stored = read(${JSON.stringify(PUBLIC_THEME_KEY)});
  let id = base.includes(stored) ? stored : stored === 'dark' ? 'amber' : stored === 'light' || matchMedia('(prefers-color-scheme: light)').matches ? 'pearl' : 'amber';
  const vault = json(${JSON.stringify(LOCAL_ACCOUNT_KEY)},64000), login = vault?.active;
  const device = login === ${JSON.stringify(QUICK_LOGIN)} ? ${JSON.stringify(QUICK_ID)} : typeof login === 'string' && login.length <= 254 && Array.isArray(vault.accounts) && vault.accounts.slice(0,20).some(a => a?.login === login) ? 'device:'+login : null;
  const p = (device && json(${JSON.stringify(ENGINE_KEY)} + device,1024)) || {};
  if (vip.includes(p.vip)) id = p.vip;
  const num = (v,lo,hi,fallback) => Number.isFinite(v) ? Math.min(hi,Math.max(lo,Math.round(v))) : fallback;
  root.dataset.material = id; root.dataset.theme = id === 'pearl' ? 'light' : 'dark'; root.style.colorScheme = root.dataset.theme;
  root.style.setProperty('--rf-blur', num(p.blur,8,40,${DEFAULT_ENGINE.blur}) + 'px');
  root.style.setProperty('--rf-shine', String(num(p.shine,20,100,${DEFAULT_ENGINE.shine}) / 100));
  root.dataset.engineMotion = ${JSON.stringify(ANIMATIONS.map(x => x.value))}.includes(p.motion) ? p.motion : 'standard';
  root.dataset.wallpaper = ${JSON.stringify(WALLPAPERS.map(x => x.value))}.includes(p.wallpaper) ? p.wallpaper : 'drift';
  const motion = read('rustflow:motion'), lite = read('rustflow:lite');
  root.dataset.motion = motion === 'reduced' || (motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'reduced' : 'full';
  if (lite === '1' || (lite !== '0' && (navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2)))) root.dataset.lite = '';
})();`;
