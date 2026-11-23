"use client";
import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import Panel from "@/components/addons/Panel";
import styles from "@/components/addons/addons.module.css";

const cards = [
  { category: "Бинды", title: "Автобег", command: "bind q forward;sprint", text: "Заменяет назначение Q. Сохраните keys.cfg и проверьте отмену движения." },
  { category: "Бинды", title: "Автоатака и приседание", command: "bind z attack;duck", text: "Меняет клавишу Z; проверьте поведение и прежний бинд перед использованием." },
  { category: "Консоль", title: "Журнал боя", command: "combatlog", text: "Откройте журнал в F1. Не переназначайте саму консоль без резервной копии." },
  { category: "Консоль", title: "Сохранение настроек", command: "writecfg", text: "Записывает текущие настройки клиента. Перед экспериментами сделайте копию конфигов." },
  { category: "Консоль", title: "Счётчик кадров", command: "perf 1", text: "Показывает FPS. Для сравнения используйте одинаковую сцену и повторяйте замеры." },
  { category: "Rust+", title: "Умная сигнализация", text: "Разделите питание, датчик и сигнал тревоги; проверьте привязку к Rust+ на тестовом сервере и резервное питание." },
  { category: "RF", title: "Нефтяные вышки", text: "Частоты 4765 и 4768 встречаются в руководствах сообщества. Они могут измениться: проверьте соответствие событиям и правила сервера перед использованием." },
  { category: "Автоматизация", title: "Промышленная сеть", text: "Тестируйте фильтры конвейеров и Industrial Crafter небольшими партиями. Оставляйте ручной обход и запас питания." },
  { category: "Автоматизация", title: "Печи и контейнеры", text: "Проверьте фильтры входа и выхода отдельно; не соединяйте выход с собственным входом без ограничения количества." },
  { category: "Строительство", title: "Бункер и лут", text: "Проверьте открытие и закрытие в отдельной тестовой постройке. Обновления строительства могут ломать известные схемы." },
  { category: "Строительство", title: "Турели", text: "Проверьте покрытие, питание, авторизацию и дружественный огонь; оставьте пути обслуживания." },
  { category: "Фарм", title: "Маршруты и переработка", text: "Сравнивайте добычу за время и риск потери груза. Экономика и доступность переработчиков зависят от сервера и обновлений." },
];
export default function KnowledgeExplorer() {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("");
  const matches = useMemo(() => cards.filter(c => `${c.category} ${c.title} ${c.text} ${c.command ?? ""}`.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru").trim())), [query]);
  return <Panel id="knowledge" kicker="База знаний" title="Полезные знания" icon={<span aria-hidden="true" style={{fontSize:"1.3rem"}}>⊞</span>} description="Советы для проверки в игре; механики и команды могут меняться после обновлений.">
    <label className={styles.label}>Поиск<input className={styles.input} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Бинды, RF, переработка…" /></label>
    <p role="status" className={styles.muted}>{status}</p>
    <div className={styles.columns}>{matches.map(c => <article className={`${styles.inset} ${styles.spaced}`} key={c.title}>
      <span className={styles.capsule}>{c.category}</span><h3>{c.title}</h3><p className={styles.muted}>{c.text}</p>
      {c.command && <><code>{c.command}</code><button type="button" className={styles.action} onClick={() => void navigator.clipboard.writeText(c.command!).then(() => setStatus("Команда скопирована.")).catch(() => setStatus("Не удалось скопировать. Выделите команду вручную."))}><Copy aria-hidden="true" /> Копировать</button></>}
    </article>)}</div>{matches.length === 0 && <p>Ничего не найдено.</p>}
  </Panel>;
}
