"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { ArrowUpRight, BookOpen, ScanLine } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { usePopupState } from "./fx/usePopupMotion";
import { Modal } from "./ui/Modal";

interface Brief {
  title: string;
  summary: string;
  technical: string;
  example: string;
  category: string;
}
const Show = createContext<((item: Brief, from: HTMLElement) => void) | null>(null);

/** A single mounted sheet per page, not a listener/dialog for every guide entry. */
export function InfoCards({ children }: { children: ReactNode }) {
  const { value, show, opener, source, isOpen, closing, dismiss, finish } = usePopupState<Brief>();
  return (
    <Show.Provider value={show}>
      {children}
      <Modal
        open={isOpen}
        closing={closing}
        onClose={dismiss}
        onExited={finish}
        source={source}
        returnFocus={opener}
        title={value?.title ?? "Подробнее"}
        maxWidth="max-w-lg"
      >
        {value && (
          <div className="info-brief">
            <span className="report-stamp">
              <span>
                <BookOpen size={15} />
                {value.category}
              </span>
            </span>
            <p className="brief-lead">{value.summary}</p>
            <section>
              <h3>Как это работает</h3>
              <p>{value.technical}</p>
            </section>
            <LiquidGlass as="section" className="brief-example">
              <h3>
                <ScanLine size={16} /> Наглядный пример
              </h3>
              <p>{value.example}</p>
            </LiquidGlass>
          </div>
        )}
      </Modal>
    </Show.Provider>
  );
}

/** Text is selectable and sibling links are independent. Only the capsule is an invoker. */
export function InfoButton({ brief, onRead }: { brief: Brief; onRead?: () => void }) {
  const show = useContext(Show);
  return (
    <LiquidGlass
      as="button"
      island
      shape="pill"
      className="info-more"
      type="button"
      aria-haspopup="dialog"
      aria-label={`Подробнее: ${brief.title}`}
      onClick={(e) => {
        show?.(brief, e.currentTarget);
        onRead?.();
      }}
    >
      Подробнее <ArrowUpRight size={15} aria-hidden="true" />
    </LiquidGlass>
  );
}
