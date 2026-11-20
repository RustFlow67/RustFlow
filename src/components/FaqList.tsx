"use client";

import LiquidGlass from "@/components/LiquidGlass";
import AccordionBody from "./ui/AccordionBody";
import { ArrowUpRight, ChevronDown, Search, SearchX } from "lucide-react";
import Link from "@/components/RouteLink";
import { useId, useMemo, useState, type CSSProperties } from "react";
import Segmented from "@/components/Segmented";
import { Button, EmptyState, Input } from "@/components/ui";
import type { FaqItem } from "@/lib/content";

export default function FaqList({ items }: { items: FaqItem[] }) {
  const prefix = useId();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("Все");
  const [open, setOpen] = useState<string | null>(items[0]?.q ?? null);

  const tags = useMemo(() => ["Все", ...Array.from(new Set(items.map((i) => i.tag)))], [items]);

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      if (tag !== "Все" && item.tag !== tag) return false;
      const haystack = `${item.q} ${item.a.join(" ")}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [items, query, tag]);

  return (
    <div>
      <LiquidGlass className="glass glass-blur relative z-10 mb-5 space-y-3.5 p-4 sm:p-5">
        <Input
          label="Поиск по вопросам FAQ"
          hideLabel
          type="search"
          placeholder="Поиск: HAGS, gc.buffer, Done, драйверы…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          icon={<Search className="h-4 w-4" />}
        />
        <Segmented
          options={tags.map((t) => ({ value: t, label: t }))}
          value={tag}
          onChange={setTag}
          ariaLabel="Тема вопроса"
          className="w-full sm:w-auto"
        />
      </LiquidGlass>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
          title="Такого вопроса не найдено"
          hint="Попробуйте другое ключевое слово или верните фильтр на «Все»."
          action={
            <Button
              variant="primary"
              onClick={() => {
                setQuery("");
                setTag("Все");
              }}
            >
              Показать все вопросы
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((item, i) => {
            const isOpen = open === item.q;
            return (
              <LiquidGlass as="li"
                key={item.q}
                className="glass"
                data-open={isOpen ? "" : undefined}
                style={{ "--r": "24px" } as CSSProperties}
              >
                <h3>
                  <button
                    type="button"
                    className="group flex w-full items-center gap-4 p-5 text-left sm:p-6"
                    aria-expanded={isOpen} aria-controls={`${prefix}-${i}`}
                    onClick={() => setOpen(isOpen ? null : item.q)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-widest text-accent-hi">
                        {item.tag}
                      </span>
                      <span className="block text-[16.5px] font-bold leading-snug tracking-tight text-ink">
                        {item.q}
                      </span>
                    </span>
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/10">
                      <ChevronDown className="acc-chevron h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                </h3>
                <AccordionBody open={isOpen} id={`${prefix}-${i}`}>
                  <div className="space-y-3 px-5 pb-6 text-[15px] leading-relaxed text-ink-2 sm:px-6">
                    {item.a.map((paragraph, j) => (
                      <p key={j}>{paragraph}</p>
                    ))}
                    {item.href && <Link href={item.href} className="inline-flex items-center gap-1.5 font-semibold text-accent-hi underline underline-offset-4">
                      К инструкции <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>}
                  </div>
                </AccordionBody>
              </LiquidGlass>
            );
          })}
        </ul>
      )}
    </div>
  );
}
