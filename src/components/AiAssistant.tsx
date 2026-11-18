"use client";

import { ArrowUpRight, LoaderCircle, MessageCircle, Send, Square, Trash2, X } from "lucide-react";
import Link from "@/components/RouteLink";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { RiskLevelBadge } from "@/components/Badges";
import { apiUrl } from "@/lib/api-base";
import { assistantBuild, currentAssistantBuild } from "@/lib/assistant/context";
import { CONTEXT_ANSWER, CONTEXT_TURNS, MAX_ANSWER, MAX_QUESTION, isAdminCommand, truncateQuestion, streamLines, type AssistantEvent } from "@/lib/assistant/protocol";
import { KNOWLEDGE_BASE, knowledgeHref } from "@/lib/knowledge-base";
import { makeId } from "@/lib/models/common";
import { storage } from "@/lib/storage/adapter";
import styles from "./AiAssistant.module.css";

const ENDPOINT = apiUrl("assistant");
const HISTORY_KEY = "rf.assistant.history";
const HISTORY_LIMIT = 24;
const HISTORY_SIZE = 256000;
const SUGGESTIONS = ["gc.buffer", "Просадки при повороте мыши", "Rust завис на Done"];
const ENTRIES = new Map(KNOWLEDGE_BASE.map((entry) => [entry.id, entry]));
const NETWORK_ERROR = "Связь с помощником прервалась. Попробуйте ещё раз.";
type Turn = { id: string; question: string; answer: string; entryId: string | null };
type Draft = Turn & { status: "streaming" | "failed" | "stopped"; message?: string };

function readHistory(): Turn[] | null {
  let raw;
  try { raw = window.localStorage.getItem(HISTORY_KEY); } catch { return null; }
  if (!raw || raw.length > HISTORY_SIZE) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-HISTORY_LIMIT).flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const { id, question, answer, entryId } = item as Partial<Turn>;
      if (typeof id !== "string" || typeof question !== "string" || !question.trim() || isAdminCommand(question)) return [];
      return [{ id: id.slice(0, 64), question: truncateQuestion(question),
        answer: typeof answer === "string" ? answer.slice(0, MAX_ANSWER) : "",
        entryId: typeof entryId === "string" && ENTRIES.has(entryId) ? entryId : null }];
    });
  } catch { return []; }
}

function saveTurn(turn: Turn, fallback: Turn[]): Turn[] {
  let next = [...(readHistory() ?? fallback), turn].slice(-HISTORY_LIMIT);
  let json = JSON.stringify(next);
  while (json.length > HISTORY_SIZE && next.length > 1) {
    next = next.slice(1);
    json = JSON.stringify(next);
  }
  try { window.localStorage.setItem(HISTORY_KEY, json); } catch { /* Keep chat usable without storage. */ }
  return next;
}

function selectedBuild(pathname: string | null) {
  const draft = pathname === "/benchmark" ? currentAssistantBuild() : undefined;
  if (draft !== undefined) return draft;
  const { builds, activeBuildId } = storage.getState();
  const active = assistantBuild(builds.find((record) => record?.id === activeBuildId)?.input);
  if (active) return active;
  for (const record of builds) {
    const saved = assistantBuild(record?.input);
    if (saved) return saved;
  }
  return null;
}

async function responseError(response: Response) {
  const json = await response.json().catch(() => null) as { error?: unknown } | null;
  return typeof json?.error === "string" ? json.error : NETWORK_ERROR;
}

export default function AiAssistant({ open, onClose }: {
  open: boolean; onClose: (refocus?: boolean) => void;
}) {
  const pathname = usePathname();
  const dock = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<Turn[]>(() => readHistory() ?? []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const panelId = "rustflow-assistant-dialog";
  const titleId = useId();
  const pending = draft?.status === "streaming";
  const commandReady = isAdminCommand(query);
  const isSecret = /^\s*\/admin\s/i.test(query);

  function requestHeaders() {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (self !== top && location.protocol === "https:") headers.set("X-RustFlow-Embedded", "1");
    return headers;
  }

  useLayoutEffect(() => {
    if (!open) return;
    const focus = window.matchMedia("(pointer: coarse)").matches ? title.current : input.current;
    focus?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function escape(event: KeyboardEvent) {
      // A modal above the modeless assistant gets Escape first.
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || document.querySelector("[data-rf-modal]")) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !log.current) return;
    if (configurationError) log.current.scrollTop = 0;
    else if (follow.current) log.current.scrollTop = log.current.scrollHeight;
  }, [open, history, draft, configurationError]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== HISTORY_KEY && event.key !== null) return;
      const next = readHistory();
      if (next) setHistory(next);
      if (event.newValue === null) {
        request.current?.abort();
        request.current = null;
        setDraft(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      request.current?.abort();
      request.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    follow.current = true;
    // Check configuration without sending a prompt, history or build.
    const update = () => void fetch(ENDPOINT, { signal: controller.signal, cache: "no-store", redirect: "error" }).then(async (response) => {
      if (!response.ok) return;
      const status = await response.json() as { configured?: boolean; error?: unknown; admin?: boolean };
      if (controller.signal.aborted) return;
      setConfigurationError(status?.configured === false && typeof status.error === "string" ? status.error : null);
      setAdmin(status?.admin === true);
    }).catch(() => { /* Submit will show a network error if still offline. */ });
    update();
    window.addEventListener("rustflow:admin-change", update);
    return () => { controller.abort(); window.removeEventListener("rustflow:admin-change", update); };
  }, [open]);

  useEffect(() => {
    const node = dock.current;
    const viewport = window.visualViewport;
    if (!open || !node || !viewport) return;
    // Keep the composer above the on-screen keyboard without changing the site's viewport.
    const fit = () => {
      node.style.setProperty("--assistant-height", `${viewport.height}px`);
      node.style.setProperty("--assistant-top", `${viewport.offsetTop}px`);
      node.style.setProperty("--assistant-keyboard", `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
    };
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    fit();
    return () => {
      viewport.removeEventListener("resize", fit);
      viewport.removeEventListener("scroll", fit);
    };
  }, [open]);

  async function runCommand(text: string) {
    // Credential commands never enter a displayed turn, the browser history, or the model context.
    if (request.current || commandBusy) return;
    setQuery("");
    setCommandBusy(true);
    setCommandMessage(null);
    try {
      const endpoint = new URL(ENDPOINT, location.href);
      if (endpoint.origin !== location.origin || (location.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname))) {
        setCommandMessage("Команда ADMIN доступна через HTTPS или на localhost.");
        return;
      }
      const response = await fetch(endpoint, { method: "POST", headers: requestHeaders(), redirect: "error", cache: "no-store",
        signal: AbortSignal.timeout(8000), body: JSON.stringify({ question: text }) });
      if (!response.ok) { setCommandMessage(await responseError(response)); return; }
      const status = await response.json() as { admin?: boolean; message?: string };
      setAdmin(status.admin === true);
      setCommandMessage(status.message ?? "Готово.");
      window.dispatchEvent(new Event("rustflow:admin-change"));
    } catch { setCommandMessage(NETWORK_ERROR); }
    finally { setCommandBusy(false); }
  }

  async function ask(question: string) {
    const raw = question.trim();
    if (isAdminCommand(raw)) { await runCommand(raw); return; }
    const text = truncateQuestion(raw);
    if (!text || request.current || commandBusy || configurationError) return;
    setCommandMessage(null);
    const base = readHistory() ?? history;
    const recent = base.filter((turn) => turn.answer).slice(-CONTEXT_TURNS).map(({ question, answer }) => (
      { question, answer: answer.slice(0, CONTEXT_ANSWER) }
    ));
    const turn: Turn = { id: makeId("question"), question: text, answer: "", entryId: null };
    const controller = new AbortController();
    request.current = controller;
    follow.current = true;
    setDraft({ ...turn, status: "streaming" });
    setQuery("");
    input.current?.focus({ preventScroll: true });

    let error = NETWORK_ERROR;
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST", headers: requestHeaders(), signal: controller.signal, redirect: "error",
        body: JSON.stringify({ question: text, history: recent, build: selectedBuild(pathname) }),
      });
      if (!response.ok) {
        error = await responseError(response);
        if (response.status === 503 && request.current === controller) {
          setConfigurationError(error);
          setQuery(text);
          setDraft(null);
          return;
        }
        throw new Error();
      }
      if (!response.body || !response.headers.get("content-type")?.includes("application/x-ndjson")) throw new Error();
      let complete = false;
      for await (const line of streamLines(response.body)) {
        if (request.current !== controller) return;
        if (!line.trim()) continue;
        const event = JSON.parse(line) as AssistantEvent;
        if (event.type === "context") turn.entryId = event.entryId;
        if (event.type === "delta" && typeof event.text === "string") {
          turn.answer = (turn.answer + event.text).slice(0, MAX_ANSWER);
          setDraft({ ...turn, status: "streaming" });
        }
        if (event.type === "error") { error = event.message; throw new Error(); }
        if (event.type === "done") { complete = true; break; }
      }
      if (request.current !== controller) return;
      if (!complete || !turn.answer.trim()) throw new Error();
      setHistory(saveTurn(turn, base));
      setDraft(null);
    } catch {
      if (request.current === controller) {
        setDraft({ ...turn, status: "failed", message: error });
        setQuery((value) => value || text);
      }
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  function stop() {
    request.current?.abort();
    request.current = null;
    setDraft((turn) => turn?.status === "streaming" ? { ...turn, status: "stopped" } : turn);
    input.current?.focus({ preventScroll: true });
  }

  function clear() {
    request.current?.abort();
    request.current = null;
    setDraft(null);
    setHistory([]);
    try { window.localStorage.removeItem(HISTORY_KEY); } catch { /* Storage may be unavailable. */ }
    input.current?.focus({ preventScroll: true });
  }

  if (!open) return null;
  const messages = draft ? [...history, draft] : history;
  return (
    <div ref={dock} className={styles.dock} data-rf-assistant="open">
      <section className={`glass rf-popup-motion ${styles.panel}`} id={panelId} role="dialog" aria-labelledby={titleId} data-open="">
        <header className={styles.header}>
          <span className={styles.mark} aria-hidden="true"><MessageCircle /></span>
          <div className={styles.identity}>
            <h2 id={titleId} ref={title} tabIndex={-1}>ИИ-ассистент RustFlow</h2>
            <p>{admin ? <span className={styles.adminBadge}>ADMIN</span> : "ИИ-помощник по Rust"}</p>
          </div>
          {messages.length > 0 && <button type="button" className={styles.iconButton} onClick={clear}
            aria-label="Очистить историю чата" title="Очистить историю"><Trash2 aria-hidden="true" /></button>}
          <button type="button" className={styles.iconButton} onClick={() => onClose()}
            aria-label="Свернуть RustFlow Assistant" title="Свернуть чат"><X aria-hidden="true" /></button>
        </header>
        <div ref={log} className={styles.log} role="log" aria-label="История чата" aria-busy={pending || commandBusy}
          onScroll={(event) => {
            const node = event.currentTarget;
            follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 36;
          }}>
          {configurationError && <p className={`${styles.answer} ${styles.configuration}`} role="status">
            {configurationError} <Link href="/guide" className={styles.link} onNavigate={() => onClose(false)}>Открыть базу знаний</Link>
          </p>}
          {messages.length === 0 ? (
            <div className={styles.welcome}>
              <p className={styles.kicker}>Помощь с настройкой Rust</p>
              <p>Спросите о Windows, настройках игры, драйверах, биндах или ошибке.</p>
              <div className={styles.suggestions} aria-label="Примеры вопросов">
                {SUGGESTIONS.map((text) => <button key={text} type="button" disabled={Boolean(configurationError)} onClick={() => void ask(text)}>{text}</button>)}
              </div>
            </div>
          ) : (
            <ol className={styles.messages}>
              {messages.map((turn, index) => {
                const live = turn === draft ? draft : null;
                const { id, question, answer, entryId } = turn;
                const entry = entryId && !live ? ENTRIES.get(entryId) : undefined;
                return <li key={`${id}-${index}`} className={styles.turn}>
                  <p className={styles.question}><span className="sr-only">Вы: </span>{question}</p>
                  <div className={styles.answer}>
                    {answer && <p className={styles.answerText}>{answer}</p>}
                    {!answer && !live && <p className={styles.note}>Ответ из предыдущей версии не сохранён.</p>}
                    {live?.status === "streaming" && <p className={styles.loading}><LoaderCircle aria-hidden="true" />
                      {answer ? "Ответ поступает…" : "Готовлю ответ…"}
                    </p>}
                    {live?.status === "stopped" && <p className={styles.note}>Ответ остановлен.</p>}
                    {live?.status === "failed" && <p className={styles.note} role="status">{live.message}</p>}
                    {entry && <div className={styles.topic}>
                      <Link href={knowledgeHref(entry.id)} prefetch={false} onNavigate={() => onClose(false)} className={styles.link}>
                        В базе знаний: {entry.title} <ArrowUpRight aria-hidden="true" />
                      </Link>
                      {entry.risk === "caution" && <RiskLevelBadge level="caution" />}
                    </div>}
                  </div>
                </li>;
              })}
            </ol>
          )}
        </div>
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void ask(query); }}>
          <span className="sr-only" role="status">{pending ? "ИИ-помощник готовит ответ" : ""}</span>
          <label htmlFor={`${panelId}-query`} className="sr-only">Вопрос помощнику</label>
          <input ref={input} id={`${panelId}-query`} type={isSecret ? "password" : "text"} autoComplete="off" spellCheck={!isSecret} enterKeyHint="send"
            value={query} maxLength={MAX_QUESTION} placeholder="Например: Rust завис на Done"
            aria-describedby={`${panelId}-privacy`}
            onChange={(event) => setQuery(event.target.value)} />
          {pending ? (
            <button type="button" className={`btn ${styles.send}`} aria-label="Остановить ответ" onClick={stop}>
              <Square aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" className={`btn btn-primary ${styles.send}`} aria-label="Отправить вопрос"
              disabled={!query.trim() || commandBusy || Boolean(configurationError && !commandReady)}>
              <Send aria-hidden="true" />
            </button>
          )}
          {commandMessage && <p role="status" className={styles.commandStatus}>{commandMessage}</p>}
          <p id={`${panelId}-privacy`} className={styles.disclosure}>
            В API модели отправляются вопрос, недавние сообщения и параметры сборки. История хранится в браузере.
          </p>
        </form>
      </section>
    </div>
  );
}
