"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import CinematicTitle from './CinematicTitle';
import ChromeSculpture from './ChromeSculpture';
import DownloadAppButton from './DownloadAppButton';
import SwipeButton from './ui/SwipeButton';
import { LanguageSwitch } from './Nav';
import { useLockBody } from '@/hooks/useLockBody';
import { useOnboardingStatus } from './Onboarding';
import { useLanguage } from './LanguageProvider';

const faq = {
  ru: [
    ['Миф 01', 'За любые оптимизаторы и конфиги банит EAC?', 'Настройки Windows и обычные переменные client.cfg не требуют внедрения в память игры. Но SHIFT не связан с Facepunch или Easy Anti-Cheat, а правила и их применение меняются. Гарантировать совместимость или отсутствие блокировки невозможно — проверяйте действующие правила перед использованием.'],
    ['Миф 02', 'Программа может увеличить FPS в два-три раза?', 'Нет универсальной прибавки. Сцена, сервер, процессор, видеокарта и память ограничивают результат. Настройка может убрать отдельные причины статтеров или задержки, но прирост не гарантирован: сравнивайте frame time и 1% low на одном маршруте.'],
    ['Миф 03', 'После твиков систему нельзя восстановить?', 'Резервные копии помогают вернуть сохранённые значения, если они были созданы до конкретной операции. Полнота отката зависит от действия, сохранности копий и прав Windows. Создавайте независимую копию и точку восстановления заранее.'],
    ['Вопрос 01', 'Какие версии Windows поддерживаются?', 'Проект ориентирован на Windows 10 и 11 x64. Нативная сборка и установщик требуют проверки на целевой системе; доступность релиза указана у кнопки скачивания.'],
    ['Вопрос 02', 'Что происходит после обновлений Rust?', 'Команды и меню игры могут измениться. Перепроверяйте настройки в F1 и сверяйтесь с актуальными правилами игры; рекомендации не являются гарантией совместимости с каждым патчем.'],
    ['Вопрос 03', 'Приложение бесплатное?', 'Этот сайт доступен бесплатно. Условия распространения десктопной сборки будут указаны вместе с опубликованным релизом.'],
  ],
  en: [
    ['Myth 01', 'Does EAC ban every optimiser and config?', 'Windows settings and ordinary client.cfg variables do not require injection into game memory. SHIFT is independent of Facepunch and Easy Anti-Cheat, and rules and enforcement can change. Compatibility and freedom from bans cannot be guaranteed; check the current rules.'],
    ['Myth 02', 'Can software double or triple FPS?', 'There is no universal gain. The scene, server, CPU, GPU and memory all limit performance. Tuning may address particular causes of stutter or latency, but results are not guaranteed: compare frame time and 1% low on the same route.'],
    ['Myth 03', 'Are tweaks impossible to undo?', 'Backups can restore values captured before a particular operation. Completeness depends on the action, intact backups and Windows permissions. Make an independent backup and restore point before changing anything.'],
    ['Question 01', 'Which Windows versions are supported?', 'The project targets Windows 10 and 11 x64. The native build and installer need verification on the target system; release availability is shown next to the download button.'],
    ['Question 02', 'What happens after Rust updates?', 'Game commands and menus can change. Recheck settings in F1 and follow the current game rules; recommendations are not guaranteed to work with every patch.'],
    ['Question 03', 'Is the app free?', 'This site is free to access. Desktop distribution terms will be listed with the published release.'],
  ],
} as const;

function Faq() {
  const {language}=useLanguage(); const en=language==='en'; const reduced=useReducedMotion();
  const [open,setOpen]=useState<number|null>(null);
  return <div className="showcase-faq-list">{faq[language].map(([tag,question,answer],i)=><div className="faq-entry" key={i}>
    {(i===0 || i===3) && <h3 className="faq-group">{i===0?(en?'01 / THE MYTHS':'01 / ГЛАВНЫЕ МИФЫ'):(en?'02 / COMMON QUESTIONS':'02 / ЧАСТЫЕ ВОПРОСЫ')}</h3>}
    <SwipeButton className="faq-question" type="button" aria-expanded={open===i} aria-controls={`answer-${i}`} onClick={()=>setOpen(open===i?null:i)}><span className="faq-number">{tag}</span><span>{question}</span><b aria-hidden="true">{open===i?'−':'+'}</b></SwipeButton>
    <AnimatePresence initial={false}>{open===i && <motion.div id={`answer-${i}`} className="faq-answer" initial={reduced?false:{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={reduced?{opacity:0}:{height:0,opacity:0}} transition={reduced?{duration:0}:{type:'spring',stiffness:240,damping:28}}><p>{answer}</p></motion.div>}</AnimatePresence>
  </div>)}</div>;
}

export default function HomeExperience() {
  const {ready,open}=useOnboardingStatus(); useLockBody(ready && !open);
  const {language}=useLanguage(); const en=language==='en';
  const [slide,setSlide]=useState(0);
  const wheelState=useRef({lockedUntil:0,lastWheel:0,delta:0,needsQuiet:false});
  const go=useCallback((index:number)=>setSlide(Math.min(3,Math.max(0,index))),[]);
  useEffect(()=>{
    const fromHash=()=>go(/^#scene-[1-4]$/.test(location.hash)?Number(location.hash.at(-1))-1:0);
    fromHash(); window.addEventListener('hashchange',fromHash);
    const jump=(e:Event)=>go((e as CustomEvent<number>).detail); window.addEventListener('shift:home-goto',jump);
    document.documentElement.setAttribute('data-home-frame','');
    return()=>{window.removeEventListener('hashchange',fromHash);window.removeEventListener('shift:home-goto',jump);document.documentElement.removeAttribute('data-home-frame');document.documentElement.removeAttribute('data-home-scene');};
  },[go]);
  useEffect(()=>{document.documentElement.dataset.homeScene=String(slide);window.dispatchEvent(new CustomEvent('shift:home-slide',{detail:slide}));},[slide]);
  useEffect(()=>{
    const state=wheelState.current; let touch:{x:number;y:number;lastY:number;scrolled:boolean}|null=null;
    function wheel(e:WheelEvent){
      if(e.ctrlKey||document.querySelector('[aria-modal="true"]'))return;
      const area=e.target instanceof Element?e.target.closest<HTMLElement>('.home-slide-scroll'):null;
      if(area && area.scrollHeight>area.clientHeight+2 && ((e.deltaY>0 && area.scrollTop+area.clientHeight<area.scrollHeight-2)||(e.deltaY<0 && area.scrollTop>2)))return;
      e.preventDefault();const now=performance.now(),quiet=now-state.lastWheel>180;state.lastWheel=now;
      if(now<state.lockedUntil){state.delta=0;return;} if(state.needsQuiet&&!quiet)return;state.needsQuiet=false;
      if(quiet||Math.sign(state.delta)!==Math.sign(e.deltaY))state.delta=0;state.delta+=e.deltaY;
      if(Math.abs(state.delta)>=45){go(slide+(state.delta>0?1:-1));state.delta=0;state.lockedUntil=now+950;state.needsQuiet=true;}
    }
    function keys(e:KeyboardEvent){if(document.querySelector('[aria-modal="true"]')||e.altKey||e.ctrlKey||e.metaKey||(e.target instanceof Element&&e.target.closest('button,a,input,textarea,select,canvas,.cinema-grab')))return;if(['ArrowDown','ArrowRight','PageDown'].includes(e.key)){e.preventDefault();go(slide+1);}if(['ArrowUp','ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();go(slide-1);}}
    function start(e:TouchEvent){if(e.touches.length!==1||document.querySelector('[aria-modal="true"]')||(e.target instanceof Element&&e.target.closest('button,a,.cinema-grab')))return;touch={x:e.touches[0].clientX,y:e.touches[0].clientY,lastY:e.touches[0].clientY,scrolled:false};}
    function move(e:TouchEvent){if(!touch||!e.touches.length)return;const area=e.target instanceof Element?e.target.closest<HTMLElement>('.home-slide-scroll'):null;const y=e.touches[0].clientY,delta=touch.lastY-y;touch.lastY=y;if(area && area.scrollHeight>area.clientHeight+2){const before=area.scrollTop;area.scrollTop+=delta;if(Math.abs(area.scrollTop-before)>0)touch.scrolled=true;}}
    function end(e:TouchEvent){if(!touch||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;if(!touch.scrolled&&Math.abs(dy)>60&&Math.abs(dy)>Math.abs(dx))go(slide+(dy<0?1:-1));touch=null;}
    window.addEventListener('wheel',wheel,{passive:false});window.addEventListener('keydown',keys);window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchmove',move,{passive:true});window.addEventListener('touchend',end,{passive:true});
    document.documentElement.dataset.homeGesturesReady='true';
    return()=>{delete document.documentElement.dataset.homeGesturesReady;window.removeEventListener('wheel',wheel);window.removeEventListener('keydown',keys);window.removeEventListener('touchstart',start);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',end);};
  },[slide,go]);
  return <div className="home-deck" data-slide={slide}>
    <section id="scene-1" className="home-slide home-hero" aria-label={en?'About Us':'О нас'} hidden={slide!==0}>
      <div className="stage-top tech-label"><span>INDEPENDENT SOFTWARE / RUST</span><span>EST. 2026</span></div><CinematicTitle/><ChromeSculpture/>
      <div className="showcase-hero-copy"><span className="showcase-index">01 / {en?'ABOUT US':'О НАС'}</span><h2>{en?<>Built by players.<br/>Driven by clarity.</>:<>Создано игроками.<br/>Для ясной игры.</>}</h2><p>{en?'SHIFT is an independent team of system engineers and Rust players. We build thoughtful tools without promises of +500% FPS. This site has no advertising, subscriptions or user-tracking telemetry.':'SHIFT — независимая команда системных инженеров и игроков в Rust. Мы создаём осмысленный софт без обещаний «+500% FPS». На сайте нет рекламы, подписок и телеметрии пользователей.'}</p><DownloadAppButton/></div>
    </section>
    <section id="scene-2" className="home-slide home-paper home-slide-scroll" aria-label={en?'About Our Project':'О нашем проекте'} hidden={slide!==1} tabIndex={0}>
      <div className="showcase-content"><span className="showcase-index">02 / {en?'THE PROJECT':'О НАШЕМ ПРОЕКТЕ'}</span><h2>{en?<>Honest.<br/><em>By design.</em></>:<>Честно.<br/><em>По делу.</em></>}</h2><p className="showcase-lead">{en?'A peak FPS number in an empty field does not tell the story of a fight. Consistent frame time and 1% low matter on busy servers, including those with 300+ players.':'Пиковый FPS в пустом поле не расскажет, что происходит в бою. На загруженных серверах, в том числе с 300+ игроками, важны стабильный Frame Time и 1% Low.'}</p><div className="showcase-columns"><div><h3>{en?'The method':'Подход'}</h3><p>{en?'We favour understandable Rust settings and standard Windows options over registry cleaners and magic switches. Verify commands after game updates.':'Понятные настройки Rust и штатные параметры Windows вместо «чистильщиков реестра» и магических переключателей. После обновлений проверяйте команды в игре.'}</p></div><div><h3>{en?'The limits':'Границы'}</h3><p>{en?'CPU performance and L3 cache can constrain crowded scenes; GPU and VRAM matter at higher resolutions. There are no miracles for weak hardware.':'В плотной сцене ограничением может стать CPU и L3-кэш; при высоком разрешении важны GPU и VRAM. Чудес для слабого железа мы не обещаем.'}</p></div></div></div>
    </section>
    <section id="scene-3" className="home-slide home-paper home-slide-scroll" aria-label={en?'About the App':'О приложении'} hidden={slide!==2} tabIndex={0}>
      <div className="showcase-content"><span className="showcase-index">03 / {en?'THE WINDOWS APP':'ПРИЛОЖЕНИЕ ДЛЯ WINDOWS'}</span><h2>{en?<>Your system.<br/><em>Your choice.</em></>:<>Ваша система.<br/><em>Ваш выбор.</em></>}</h2><p className="showcase-lead">{en?'A separate desktop direction for Windows 10 / 11 x64. The native build needs verification on Windows before release.':'Отдельное десктопное направление для Windows 10 / 11 x64. Нативную сборку необходимо проверить на Windows перед выпуском.'}</p><div className="app-features"><div><span>01</span><p><strong>{en?'Adaptive profiles':'Подбор профилей'}</strong>{en?'Graphics recommendations account for the CPU, GPU and VRAM, including 1/8, 1/4, 1/2 or Full texture resolution.':'Рекомендации графики учитывают CPU, GPU и VRAM, включая разрешение текстур 1/8, 1/4, 1/2 или Full.'}</p></div><div><span>02</span><p><strong>{en?'Monitoring':'Мониторинг'}</strong>{en?'FPS, 1% low and frame pacing require a working measurement source. An in-game native HUD is not yet verified.':'FPS, 1% Low и Frame Pace требуют источника измерений. Работа нативного HUD поверх игры пока не подтверждена.'}</p></div><div><span>03</span><p><strong>{en?'Backups and rollback':'Резервные копии и откат'}</strong>{en?'Backups are available for supported operations; completeness depends on the action and the stored snapshot.':'Резервные копии предусмотрены для поддерживаемых операций; полнота отката зависит от действия и сохранности снимка.'}</p></div></div><DownloadAppButton version/></div>
    </section>
    <section id="scene-4" className="home-slide home-final home-slide-scroll" aria-label={en?'FAQ & Myths':'FAQ и мифы'} hidden={slide!==3} tabIndex={0}>
      <div className="showcase-content showcase-faq"><span className="showcase-index">04 / {en?'FAQ & MYTHS':'FAQ И МИФЫ'}</span><h2>{en?<>Questions.<br/><em>Not promises.</em></>:<>Вопросы.<br/><em>Не обещания.</em></>}</h2><Faq/><footer className="showcase-footer"><div><strong>SHIFT.</strong><p>{en?'Independent of Facepunch and Easy Anti-Cheat.':'Независимый проект, не связан с Facepunch и Easy Anti-Cheat.'}</p></div><DownloadAppButton/><LanguageSwitch/></footer></div>
    </section>
    <nav className="home-pagination" aria-label={en?'Scene controls':'Управление сценами'}><SwipeButton type="button" onClick={()=>go(slide-1)} disabled={slide===0} aria-label={en?'Previous scene':'Предыдущая сцена'}>↑</SwipeButton><span aria-live="polite">{String(slide+1).padStart(2,'0')} / 04</span><SwipeButton type="button" onClick={()=>go(slide+1)} disabled={slide===3} aria-label={en?'Next scene':'Следующая сцена'}>↓</SwipeButton></nav>
  </div>;
}
