"use client";
import LiquidGlass from "@/components/LiquidGlass";
import { WINDOWS_TAB_HREF } from "@/lib/tweaker-routes";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "./RouteLink";

const steps = [
  [
    "Создайте точку восстановления",
    "Введите в поиске Windows «Создание точки восстановления». Откройте защиту системы, включите её для системного диска и создайте именованную точку. Проверьте, что она появилась в списке. Это не копия личных файлов.",
    "/tweaker?tweak=restore-point",
    "Как создать точку",
  ],
  [
    "Разберите свою сборку",
    "Укажите процессор, видеокарту, объём памяти, диск и версию Windows. Посмотрите, что ограничивает время кадра на вашем разрешении. Запишите исходный FPS в игре — модель его не измеряет.",
    "/benchmark#build-config",
    "Указать комплектующие",
  ],
  [
    "Установите подходящие драйверы",
    "Сверьте модель и версию Windows, сохраните прежний установщик. Проверьте игру после установки; при стабильной работе чистая переустановка не нужна.",
    "/drivers",
    "Выбрать драйвер",
  ],
  [
    "Проверьте настройки Windows",
    "Начните с питания, Game Mode и записи в фоне. Меняйте по одному параметру. Оставьте защиту включённой и сравните результаты на одном сервере.",
    WINDOWS_TAB_HREF,
    "Открыть настройки и протокол",
  ],
  [
    "Примените client.cfg и проверьте откат",
    "client.cfg — файл настроек игры. Скопируйте его до изменений. Подберите профиль, прочтите шаги ZIP и папку Otkat. Повторите исходный маршрут: если улучшение не повторяется, верните сохранённые значения.",
    "/tweaker?auto=live",
    "Подготовить пакет",
  ],
] as const;
const KEY = "rustflow:roadmap:v1",
  CHANGE = "rustflow:roadmap-change";
let volatile = 0,
  writesBlocked = false;
function read() {
  try {
    if (writesBlocked) return volatile;
    const s = localStorage.getItem(KEY);
    return s && /^\d{1,2}$/.test(s) ? Number(s) & 31 : 0;
  } catch {
    return volatile;
  }
}
function subscribe(fn: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) fn();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE, fn);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE, fn);
  };
}
function toggle(i: number) {
  volatile = read() ^ (1 << i);
  try {
    localStorage.setItem(KEY, String(volatile));
  } catch {
    writesBlocked = true; // storage may allow reads while rejecting writes (quota/private mode)
  }
  window.dispatchEvent(new Event(CHANGE));
}
export default function Roadmap({ legacy }: { legacy: Record<string, string> }) {
  const bits = useSyncExternalStore(subscribe, read, () => 0),
    count = steps.filter((_, i) => bits & (1 << i)).length;
  const router = useRouter();
  useEffect(() => {
    const move = () => {
      const id = location.hash.slice(1);
      if (Object.hasOwn(legacy, id)) router.replace(legacy[id]);
    };
    move();
    window.addEventListener("hashchange", move);
    return () => window.removeEventListener("hashchange", move);
  }, [legacy, router]);
  return (
    <section id="roadmap" className="roadmap" aria-labelledby="roadmap-heading">
      <LiquidGlass className="glass road-progress">
        <div>
          <small className="rubric">Маршрут новичка</small>
          <h2 id="roadmap-heading">Моя дорожная карта</h2>
        </div>
        <div>
          <strong aria-live="polite">
            {count === 5 ? "Маршрут пройден" : "Выполнено"}: {count} из 5
          </strong>
          <progress value={count} max={5} aria-label="Прогресс настройки" />
        </div>
      </LiquidGlass>
      <ol>
        {steps.map(([title, text, href, cta], i) => (
          <LiquidGlass as="li" key={href} className="glass road-step" data-complete={Boolean(bits & (1 << i))}>
            <small className="rubric">ШАГ 0{i + 1}</small>
            <h3>{title}</h3>
            <p>{text}</p>
            <div>
              <Link href={href} className="btn btn-sm">
                {cta} ↗
              </Link>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(bits & (1 << i))}
                  onChange={() => toggle(i)}
                  aria-label={`Выполнено: ${title}`}
                />{" "}
                Выполнено
              </label>
            </div>
          </LiquidGlass>
        ))}
      </ol>
      <small className="text-ink-3">
        Отметки хранятся в этом браузере. Переход по ссылке не отмечает шаг автоматически.
      </small>
    </section>
  );
}
