"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { ArrowUpRight, LoaderCircle, MessageCircle, Send, Square, Trash2, X } from "lucide-react";
import Link from "@/components/RouteLink";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { PopupSource } from "./fx/popupGeometry";
import { useHeaderAnchor } from "./fx/useHeaderAnchor";
import { guardKeys } from "./fx/dialogKeys";
import { usePopupMotion } from "@/components/fx/usePopupMotion";
import { RiskLevelBadge } from "@/components/Badges";
import { apiUrl } from "@/lib/api-base";
import { calculatorDraft } from "@/lib/storage/calculator-draft";
import { assistantBuild } from "@/lib/assistant/context";
import { ASSISTANT_UNAVAILABLE, CONTEXT_ANSWER, CONTEXT_TURNS, MAX_ANSWER, MAX_QUESTION, isAdminCommand, truncateQuestion, streamLines, type AssistantEvent } from "@/lib/assistant/protocol";
import { KNOWLEDGE_BASE, knowledgeHref } from "@/lib/knowledge-base";
import { makeId } from "@/lib/models/common";
import { storage } from "@/lib/storage/adapter";
import styles from "./AiAssistant.module.css";

const ENDPOINT = apiUrl("assistant");
const HISTORY_KEY = "rf.assistant.history";
const HISTORY_LIMIT = 24;
const HISTORY_SIZE = 256000;
const SUGGESTIONS = ["Почему игра дёргается при повороте мыши?", "Как выбрать gc.buffer под мою память?", "Rust завис на Done"];
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
  const draft = pathname === "/benchmark" ? calculatorDraft() : undefined;
  if (draft) return assistantBuild(draft.input);
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

export default function AiAssistant({ isOpen, closing, onExited, onClose, source, anchor }: {
  anchor: React.RefObject<HTMLButtonElement | null>;
  source: React.RefObject<PopupSource>; isOpen: boolean; closing: boolean; onExited: () => void; onClose: (refocus?: boolean) => void;
}) {
  const pathname = usePathname();
  const open = isOpen && !closing;
  const dock = useRef<HTMLDivElement>(null);
  useHeaderAnchor(anchor, dock, "left", open, source);
  const panelRef = usePopupMotion<HTMLElement>(isOpen, closing, onExited, source, anchor);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<Turn[]>(() => readHistory() ?? []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [unavailable, setUnavailable] = useState(false);
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
    if (panelRef.current) return guardKeys(panelRef.current, onClose);
  }, [open, onClose, panelRef]);

  useEffect(() => {
    if (!open || !log.current) return;
    if (unavailable) log.current.scrollTop = 0;
    else if (follow.current) log.current.scrollTop = log.current.scrollHeight;
  }, [open, history, draft, unavailable]);

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
      if (!response.ok) throw new Error();
      const status = await response.json() as { configured?: boolean; admin?: boolean };
      if (controller.signal.aborted) return;
      setUnavailable(status?.configured === false);
      setAdmin(status?.admin === true);
    }).catch(() => { if (!controller.signal.aborted) setUnavailable(true); });
    update();
    window.addEventListener("rustflow:admin-change", update);
    return () => { controller.abort(); window.removeEventListener("rustflow:admin-change", update); };
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

  async function ask(question: string, suggestion = false) {
    const raw = question.trim();
    if (isAdminCommand(raw)) { await runCommand(raw); return; }
    const text = truncateQuestion(raw);
    if (!text || request.current || commandBusy) return;
    setCommandMessage(null);
    setUnavailable(false); // An explicit send also retries a previously unavailable provider.
    const base = readHistory() ?? history;
    const recent = base.filter((turn) => turn.answer).slice(-CONTEXT_TURNS).map(({ question, answer }) => (
      { question, answer: answer.slice(0, CONTEXT_ANSWER) }
    ));
    const turn: Turn = { id: makeId("question"), question: text, answer: "", entryId: null };
    const controller = new AbortController();
    request.current = controller;
    follow.current = true;
    setDraft({ ...turn, status: "streaming" });
    setQuery(suggestion ? text : "");
    input.current?.focus({ preventScroll: true });

    let error = NETWORK_ERROR;
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST", headers: requestHeaders(), signal: controller.signal, redirect: "error",
        body: JSON.stringify({ question: text, history: recent, build: selectedBuild(pathname) }),
      });
      if (!response.ok) {
        if ((response.status === 503 || response.status === 502) && request.current === controller) {
          setUnavailable(true);
          setQuery(text);
          setDraft(null);
          return;
        }
        error = await responseError(response);
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
      if (suggestion) setQuery((value) => value === text ? "" : value);
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

  if (!isOpen) return null;
  const messages = draft ? [...history, draft] : history;
  return createPortal(<>
    <div aria-hidden="true" className="assistant-scrim" onClick={() => onClose()} data-open={open ? "" : undefined} />
    <div ref={dock} data-header-slot="left" className={styles.dock} data-rf-assistant={open ? "open" : "closing"} inert={!open} aria-hidden={!open || undefined}>
      <LiquidGlass as="section" ref={panelRef} className={`glass rf-dialog-surface ${styles.panel}`} id={panelId} role="dialog" aria-modal={open || undefined} aria-labelledby={titleId} data-open={open ? "" : undefined}>
        <div className={styles.chatScroll}>
        <header className={styles.header}>
          <span className={styles.mark} aria-hidden="true"><MessageCircle /></span>
          <div className={styles.identity}>
            <h2 id={titleId} ref={title} tabIndex={-1}>ИИ-ассистент RustFlow</h2>
            <p>{admin ? <span className={styles.adminBadge}>ADMIN</span> : "ИИ-помощник по Rust"}</p>
          </div>
          {messages.length > 0 && <LiquidGlass as="button" shape="pill" type="button" className={`lg-surface ${styles.iconButton}`} onClick={clear}
            aria-label="Очистить историю чата" title="Очистить историю"><Trash2 aria-hidden="true" /></LiquidGlass>}
          <LiquidGlass as="button" shape="pill" type="button" className={`lg-surface ${styles.iconButton}`} onClick={() => onClose()}
            aria-label="Свернуть RustFlow Assistant" title="Свернуть чат"><X aria-hidden="true" /></LiquidGlass>
        </header>
        <div ref={log} className={styles.log} role="log" aria-label="История чата" aria-busy={pending || commandBusy}
          onScroll={(event) => {
            const node = event.currentTarget;
            follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 36;
          }}>
          {unavailable && <LiquidGlass as="p" className={`lg-surface ${styles.answer} ${styles.configuration}`} role="status">
            {ASSISTANT_UNAVAILABLE} <Link href="/benchmark#build-config" className={styles.link} onNavigate={() => onClose(false)}>Перейти в Сборку ↗</Link>
          </LiquidGlass>}
          {messages.length === 0 ? (
            <div className={styles.welcome}>
              <p className={`rubric ${styles.kicker}`}>Помощь с настройкой Rust</p>
              <p>Опишите один симптом своими словами — например, что происходит у большой базы. Если знаете, добавьте модель ПК. Не присылайте пароли или ключи.</p>
              <div className={styles.suggestions} aria-label="Примеры вопросов">
                {SUGGESTIONS.map((text) => <LiquidGlass as="button" shape="pill" key={text} type="button" className="lg-surface" disabled={commandBusy} onClick={() => void ask(text, true)}>{text}</LiquidGlass>)}
              </div>
            </div>
          ) : (
            <ol className={styles.messages}>
              {messages.map((turn, index) => {
                const live = turn === draft ? draft : null;
                const { id, question, answer, entryId } = turn;
                const entry = entryId && !live ? ENTRIES.get(entryId) : undefined;
                return <li key={`${id}-${index}`} className={styles.turn}>
                  <LiquidGlass as="p" className={`lg-surface ${styles.question}`}><span className="sr-only">Вы: </span>{question}</LiquidGlass>
                  <LiquidGlass className={`lg-surface ${styles.answer}`}>
                    {answer && <p className={styles.answerText}>{answer}</p>}
                    {!answer && !live && <p className={styles.note}>Ответ из предыдущей версии не сохранён.</p>}
                    {live?.status === "streaming" && <p className={styles.loading}><LoaderCircle aria-hidden="true" />
                      {answer ? "Ответ поступает…" : "Готовлю ответ…"}
                    </p>}
                    {live?.status === "stopped" && <p className={styles.note}>Ответ остановлен.</p>}
                    {live?.status === "failed" && <p className={styles.note} role="status">{live.message}</p>}
                    {entry && <div className={styles.topic}>
                      <Link href={knowledgeHref(entry.id)} prefetch={false} onNavigate={() => onClose(false)} className={styles.link}>
                        К инструкции: {entry.title} <ArrowUpRight aria-hidden="true" />
                      </Link>
                      {entry.risk === "caution" && <RiskLevelBadge level="caution" />}
                    </div>}
                  </LiquidGlass>
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
              disabled={!query.trim() || commandBusy}>
              <Send aria-hidden="true" />
            </button>
          )}
          {commandMessage && <p role="status" className={styles.commandStatus}>{commandMessage}</p>}
          <p id={`${panelId}-privacy`} className={styles.disclosure}>
            В API модели отправляются вопрос, недавние сообщения и параметры сборки. История хранится в браузере.
          </p>
        </form>
        </div>
      </LiquidGlass>
    </div>
  </>, document.body);
}
