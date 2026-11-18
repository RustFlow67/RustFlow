import { Activity, Cpu, FileCheck2, Flame, ShieldCheck, Undo2 } from "lucide-react";
import HomeConsole from "@/components/HomeConsole";

const REASONS = [
  { title: "Открытые файлы, безопасные для EAC", icon: ShieldCheck, copy: "Только штатные настройки Rust, Windows и драйверов. Без .exe, инжекторов и закрытых скриптов." },
  { title: "Шаг назад всегда возможен", icon: Undo2, copy: "Начните с точки восстановления. Сохраните исходный cfg и используйте .reg или инструкцию отката из ZIP." },
  { title: "Плавность важнее пикового FPS", icon: Activity, copy: "Смотрите на 1% low и время кадра, чтобы замечать просадки, которые скрывает средний FPS." },
  { title: "Рекомендации под ваш ПК", icon: Cpu, copy: "Сборка показывает узкий участок, а ИИ-ассистент помогает разобраться с настройками и просадками." },
  { title: "Мифы отделены от рабочих шагов", icon: FileCheck2, copy: "Отмечаем плацебо и вредные советы. В рекомендуемый набор такие шаги не попадают." },
  { title: "Нагрузка из реальной игры", icon: Flame, copy: "Сверяйте советы с текущим патчем. Модель учитывает L3 у X3D и разную нагрузку MODDED 2X и OFFICIAL HIGH POP." },
] as const;

export default function HomePage() {
  return <>
    <section className="rf-home-hero" aria-labelledby="home-title">
      <div className="rf-hero-copy rf-page-content">
        <h1 id="home-title" className="rf-home-title">
          <span>Rust без фризов.</span>{" "}<span>Максимум FPS.</span>{" "}<span>Ноль лишнего.</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-2 sm:text-lg">Найдите узкое место ПК и настройте Rust с готовыми пресетами, открытыми твиками и откатом.</p>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Принципы RustFlow">
          <li className="chip"><ShieldCheck aria-hidden="true" /> EAC-безопасно · без .exe</li>
          <li className="chip"><Undo2 aria-hidden="true" /> Файл отката к каждому шагу</li>
          <li className="chip"><FileCheck2 aria-hidden="true" /> Маркировка мифов и вреда</li>
        </ul>
      </div>
      <HomeConsole />
    </section>
    <section aria-labelledby="home-reasons" className="rf-home-reasons">
      <h2 id="home-reasons" className="headline rf-page-content mb-5 text-[clamp(1.15rem,3vw,1.9rem)]">Почему игроки выбирают RustFlow</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REASONS.map(({ title, icon: Icon, copy }) => <article key={title} className="glass glass-hover liquid-glass-card p-4 sm:p-5">
          <Icon className="mb-3 h-5 w-5 text-accent-hi" aria-hidden="true" />
          <h3 className="text-base font-bold">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{copy}</p>
        </article>)}
      </div>
    </section>
  </>;
}
