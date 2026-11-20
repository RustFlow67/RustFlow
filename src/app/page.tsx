import LiquidGlass from "@/components/LiquidGlass";
import Link from "@/components/RouteLink";
import { PlanCard } from "@/components/catalog/SystemPlan";
import { Activity, Cpu, FileCheck2, Flame, ShieldCheck, Undo2 } from "lucide-react";
import { DockIntro } from "@/components/DockIntro";
import { InfoButton, InfoCards } from "@/components/InfoCards";

const REASONS = [
  {
    title: "Открытые файлы без вмешательства в игру",
    icon: ShieldCheck,
    summary: "Только штатные настройки Rust, Windows и драйверов. Без .exe, инжекторов и закрытых скриптов.",
    technical:
      "Клиент сам читает команды из client.cfg. Профиль драйвера применяется через его панель управления, а не через вмешательство в процесс игры. Расширение текстового файла само по себе не делает его безопасным: до применения проверьте каждую строку.",
    example:
      "Откройте client.cfg из ZIP в Блокноте и найдите graphics.drawdistance. Команда задаёт дальность отрисовки клиента, а не меняет файлы античита. Правила игры определяет разработчик.",
  },
  {
    title: "Шаг назад всегда возможен",
    icon: Undo2,
    summary:
      "Сохраните исходные настройки: отменять изменения удобнее по одному, чем переустанавливать игру.",
    technical:
      "Перед изменением скопируйте client.cfg; для параметров Windows сохраните исходные значения и создайте точку восстановления. Инструкция в папке Otkat относится к выбранному шагу. Сброс к умолчаниям не всегда совпадает с вашей прежней настройкой.",
    example:
      "После замены cfg пропали привычные настройки графики? Закройте Rust, верните свою копию client.cfg и повторите тот же маршрут. Драйвер при этом менять не нужно.",
  },
  {
    title: "Плавность важнее пикового FPS",
    icon: Activity,
    summary: "1% low — скорость в самых медленных кадрах. Она показывает рывки, которые можно пропустить, глядя только на средний FPS.",
    technical:
      "Игра выводит кадры с разными интервалами. Короткий всплеск FPS почти незаметен, а один долгий кадр задерживает новую картинку. Запись времени каждого кадра показывает паузы, которые не видны на среднем FPS.",
    example:
      "При 100 FPS ровный кадр занимает около 10 мс. Если у ворот базы один кадр занял 50 мс, вы заметите паузу, даже когда счётчик в углу снова показывает 100.",
  },
  {
    title: "Рекомендации под ваш ПК",
    icon: Cpu,
    summary: "Подбирайте изменение под то, что ограничивает именно вашу сборку и сцену.",
    technical:
      "Калькулятор сравнивает время подготовки кадра процессором и предел отрисовки GPU. Разрешение сильнее нагружает графику, толпа и застройка — главный поток. Модель учитывает память и накопитель, но не видит ваши температуры или лимиты питания.",
    example:
      "Снизьте разрешение на том же сервере. Рост FPS указывает на нагрузку GPU; если в застройке кадров столько же, проверьте загрузку главного потока и 1% low, прежде чем менять видеокарту.",
  },
  {
    title: "Мифы отделены от рабочих шагов",
    icon: FileCheck2,
    summary: "Маркировка подсказывает, где есть проверяемый эффект, а где — риск или совпадение.",
    technical:
      "Меняйте одну настройку за раз и повторяйте замер в одинаковых условиях. Улучшение одного прогона может объясняться прогревом кэша или изменением онлайна. Не отключайте защиту Windows ради неподтверждённого выигрыша.",
    example:
      "Смена DNS может ускорить поиск адреса при подключении. Она не меняет маршрут уже идущих игровых пакетов — поэтому не обещает меньший пинг во время боя.",
  },
  {
    title: "Нагрузка из реальной игры",
    icon: Flame,
    summary: "Берег, монумент и рейд — разные задачи. Сравнивайте конфиги там, где действительно играете.",
    technical:
      "У большой базы клиент обрабатывает больше объектов, а при движении подгружает ресурсы с диска в память. Серверный тик и сетевые задержки — отдельные величины: замена CPU не исправляет перегруженный сервер.",
    example:
      "Запишите 60 секунд пути вдоль берега, затем такой же отрезок у монумента. Сравнивайте каждый маршрут с его собственной записью после изменения, а не берег «до» с рейдом «после».",
  },
] as const;

const STEPS = [
  {
    tab: "Сборка",
    title: "Укажите свой ПК",
    body: "Выберите процессор, видеокарту, память, диск и Windows. Посмотрите, что ограничивает FPS.",
    href: "/benchmark#build-config",
    cta: "Указать комплектующие",
  },
  {
    tab: "Пресеты",
    title: "Скачайте готовый конфиг",
    body: "Сравните близкие сборки и сохраните client.cfg с подходящей графикой. Сначала сделайте копию своего файла.",
    href: "/presets",
    cta: "Выбрать пресет",
  },
  {
    tab: "Твикер",
    title: "Примените обратимые твики",
    body: "Твик — изменение одной настройки. Подготовьте пакет и применяйте шаги по одному. После каждого сравнивайте ту же сцену; инструкции по откату внутри.",
    href: "/tweaker",
    cta: "Перейти к твикам",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <DockIntro href="/" />
      <PlanCard home />
      <section aria-labelledby="home-steps" className="home-journey">
        <h2 id="home-steps" className="headline mb-4 text-[clamp(1.25rem,3vw,1.9rem)]">
          Как настроить Rust за 3 простых шага
        </h2>
        <ol className="home-steps">
          {STEPS.map(({ tab, title, body, href, cta }, i) => (
            <li key={href}>
              <LiquidGlass as={Link} href={href} className="glass glass-hover">
                <small className="rubric">
                  0{i + 1} / {tab}
                </small>
                <h3>{title}</h3>
                <p className="text-sm leading-relaxed text-ink-2">{body}</p>
                <span>{cta} ↗</span>
              </LiquidGlass>
            </li>
          ))}
        </ol>
      </section>
      <InfoCards>
        <section aria-labelledby="home-reasons" className="rf-home-reasons">
          <h2 id="home-reasons" className="headline mb-5 text-[clamp(1.15rem,3vw,1.9rem)]">
            Почему игроки выбирают RustFlow
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REASONS.map(({ icon: Icon, ...item }, i) => (
              <LiquidGlass as="article" key={item.title} className="glass info-card reason-card p-4 sm:p-5">
                <div className="reason-meta">
                  <Icon size={21} aria-hidden="true" />
                  <small>ПРИНЦИП / 0{i + 1}</small>
                </div>
                <h3 className="text-base font-bold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{item.summary}</p>
                <InfoButton brief={{ ...item, category: `Принцип 0${i + 1} / RustFlow` }} />
              </LiquidGlass>
            ))}
          </div>
        </section>
      </InfoCards>
    </>
  );
}
