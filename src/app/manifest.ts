import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RustFlow — Твикер, Бенчмарк /10 и Настройка Rust",
    short_name: "RustFlow",
    description:
      "Оценка сборки /10 под Rust, библиотека проверенных твиков и мифов, пресеты железа, журнал FPS и полная настройка системы в стиле Liquid Glass iOS 26.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#050609",
    theme_color: "#ff8e4f",
    lang: "ru",
    categories: ["utilities", "games", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Оценка сборки /10",
        short_name: "Сборка /10",
        url: "/benchmark",
        description: "Рассчитать балл ПК под Rust и ожидаемый FPS",
      },
      {
        name: "Библиотека твиков",
        short_name: "Твики",
        url: "/tweaks",
        description: "Проверенные твики Windows и Rust с инструкциями и файлами",
      },
      {
        name: "Полная настройка",
        short_name: "Сетап",
        url: "/setup",
        description: "Пошаговый чек-лист настройки системы и ZIP-пакет",
      },
      {
        name: "Журнал замеров",
        short_name: "Журнал",
        url: "/journal",
        description: "Таблица FPS до/после с авторасчётом дельты %",
      },
    ],
  };
}
