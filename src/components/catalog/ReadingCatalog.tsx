"use client";
import LiquidGlass from "@/components/LiquidGlass";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { ReadingGroup, ReadingEntry } from "@/lib/catalog/reading";
import { matches, tokens, READING_SORTS, type ReadingSort } from "@/lib/catalog/ranking";
import { InfoButton, InfoCards } from "../InfoCards";
import { GuideContents } from "../GuideNavigation";
import { RiskLevelBadge } from "../Badges";
import Link from "../RouteLink";
import AccordionBody from "../ui/AccordionBody";
import LiquidSelect from "../LiquidSelect";
import CatalogBar from "./CatalogBar";
import { usePopularity } from "./usePopularity";

export default function ReadingCatalog({
  section,
  groups,
  shortcuts,
  label = "Мифы и EAC",
}: {
  section: "guide" | "faq";
  groups: ReadingGroup[];
  shortcuts?: ReactNode;
  label?: string;
}) {
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState<ReadingSort>("important"),
    [tag, setTag] = useState("Все");
  const [expanded, expand] = useState<string | null>(null);
  const { counts, record, source } = usePopularity(section, sort === "popular");
  const words = tokens(query),
    isGuide = section === "guide",
    flat = !!words.length || sort !== "important";
  const entries = groups.flatMap((g) =>
    g.entries.filter((e) =>
      matches(
        words,
        `${g.title} ${e.category} ${e.title} ${e.keywords ?? ""} ${e.summary ?? ""} ${e.text} ${e.code ?? ""} ${e.example} ${e.note ?? ""} ${e.badge ?? ""}`,
      ),
    ),
  );
  if (sort === "az") entries.sort((a, b) => a.title.localeCompare(b.title, "ru", { numeric: true }));
  if (sort === "popular") entries.sort((a, b) => (counts[b.key] ?? 0) - (counts[a.key] ?? 0));
  const pendingAnchor = useRef<string | null>(null);
  // Scroll after the grouped anchors have actually committed. A scheduled RAF
  // in the flat-view listener could fire after a different route had mounted.
  useLayoutEffect(() => {
    if (!flat && pendingAnchor.current) {
      document.getElementById(pendingAnchor.current)?.scrollIntoView({ block: "start" });
      pendingAnchor.current = null;
    }
  }, [flat]);
  useEffect(() => {
    if (!flat) return;
    function reveal(hash: string) {
      const id = hash.slice(1);
      if (!groups.some((g) => g.id === id || g.entries.some((e) => e.anchor === id))) return;
      pendingAnchor.current = id;
      setQuery("");
      setSort("important");
    }
    const click = (e: MouseEvent) => {
      const link = e.target instanceof Element && e.target.closest<HTMLAnchorElement>('a[href^="#"]');
      if (link) reveal(link.hash);
    };
    const hash = () => reveal(location.hash);
    window.addEventListener("hashchange", hash);
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("hashchange", hash);
      document.removeEventListener("click", click);
    };
  }, [flat, groups]);
  function card(e: ReadingEntry) {
    if (e.answer) {
      const open = expanded === e.key;
      return (
        <LiquidGlass as="article" key={e.key} className="glass reading-answer" data-reading={e.key}>
          <h3>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`answer-${e.key}`}
              onClick={() => {
                expand(open ? null : e.key);
                if (!open) record(e.key);
              }}
            >
              <span>
                <small className="rubric">{e.category}</small>
                <strong>{e.title}</strong>
              </span>
              <ChevronDown size={17} />
            </button>
          </h3>
          <AccordionBody open={open} id={`answer-${e.key}`}>
            <div className="reading-copy">
              {e.answer.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {e.href && (
                <Link className="link" href={e.href}>
                  {e.link} ↗
                </Link>
              )}
            </div>
          </AccordionBody>
        </LiquidGlass>
      );
    }
    return (
      <LiquidGlass as="article" key={e.key} id={e.anchor} className="tile info-card reading-card" data-reading={e.key}>
        <div className="reading-badges">
          {e.risk && <RiskLevelBadge level={e.risk} />}
          <small className="rubric">{e.badge ?? e.category}</small>
        </div>
        <h3>{e.title}</h3>
        <p>{e.text}</p>
        {e.code && <LiquidGlass as="code" className={`well reading-code ${e.warning ? "line-through" : ""}`}>{e.code}</LiquidGlass>}
        {e.alternative && (
          <p>
            <b>Как правильно: </b>
            {e.alternative}
          </p>
        )}
        {e.note && <p>{e.note}</p>}
        <InfoButton
          brief={{
            title: e.title,
            category: e.category,
            summary: e.summary ?? e.badge ?? e.category,
            technical: e.text,
            example: e.example,
          }}
          onRead={() => record(e.key)}
        />
        {e.href && (
          <Link className="link" href={e.href}>
            {e.link} <ArrowUpRight size={14} />
          </Link>
        )}
      </LiquidGlass>
    );
  }
  return (
    <InfoCards>
      <div className="reading-library">
        <CatalogBar
          label={label}
          query={query}
          onQuery={setQuery}
          sort={sort}
          onSort={setSort}
          options={READING_SORTS}
          hint={sort === "popular" ? source : "Поиск по названиям, командам и пояснениям."}
        />
        {shortcuts}
        {flat ? (
          <section aria-label="Результаты поиска">
            <p className="catalog-hint mb-3" aria-live="polite">
              Найдено: {entries.length}
            </p>
            <div className="reading-grid">{entries.map(card)}</div>
            {!entries.length && (
              <button className="btn mt-3" onClick={() => setQuery("")}>
                Сбросить поиск
              </button>
            )}
          </section>
        ) : (
          <>
            <div className={isGuide ? "guide-layout" : ""}>
              {isGuide && <GuideContents sections={groups.map(({ id, title }) => ({ id, title }))} />}
              <div className="reading-library">
                {groups.map((g) => (
                  <LiquidGlass as="section"
                    key={g.id}
                    id={g.id}
                    data-guide-section={isGuide ? "" : undefined}
                    className="glass reading-group"
                  >
                    <small className="rubric">{g.kicker}</small>
                    <h2 className="headline">{g.title}</h2>
                    <p>{g.lead}</p>
                    {g.id === "faq" && (
                      <LiquidSelect
                        className="mb-3 max-w-xs"
                        label="Тема вопроса"
                        value={tag}
                        options={["Все", ...new Set(g.entries.map((e) => e.category))].map((v) => ({
                          value: v,
                          label: v,
                        }))}
                        onChange={setTag}
                      />
                    )}
                    <div className="reading-grid">
                      {g.entries
                        .filter((e) => g.id !== "faq" || tag === "Все" || e.category === tag)
                        .map(card)}
                    </div>
                  </LiquidGlass>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </InfoCards>
  );
}
