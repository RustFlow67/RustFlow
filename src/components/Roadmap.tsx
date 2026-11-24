"use client";
import LiquidGlass from "@/components/LiquidGlass";
import { WINDOWS_TAB_HREF } from "@/lib/tweaker-routes";
import { useEffect } from "react";
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
export default function Roadmap({ legacy }: { legacy: Record<string, string> }) {
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
      </LiquidGlass>
      <ol>
        {steps.map(([title, text, href, cta], i) => (
          <LiquidGlass as="li" key={href} className="glass road-step">
            <small className="rubric">ШАГ 0{i + 1}</small>
            <h3>{title}</h3>
            <p>{text}</p>
            <div>
              <Link href={href} className="btn btn-sm">
                {cta} ↗
              </Link>
            </div>
          </LiquidGlass>
        ))}
      </ol>
    </section>
  );
}
