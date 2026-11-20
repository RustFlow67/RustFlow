"use client";
import LiquidGlass from "@/components/LiquidGlass";
import { useFeedbackTimer } from "./fx/useFeedbackTimer";

import OriginDisclosure from "@/components/fx/OriginDisclosure";
import { Check, ChevronDown, Copy, FileText } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

export default function CodeBlock({
  title,
  content,
  note,
  collapsible = false,
  copyable = true,
}: {
  title: string;
  content: string;
  note?: string;
  collapsible?: boolean;
  copyable?: boolean;
}) {
  const { toast } = useToast();
  const feedbackLater=useFeedbackTimer();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(!collapsible);
  const lines = content.replace(/\n$/, "").split("\n").length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      feedbackLater(() => setCopied(false), 1800);
      toast({ title: "Скопировано в буфер обмена", description: title, tone: "success" });
    } catch {
      setCopied(false);
      toast({ title: "Не удалось скопировать", description: "Выделите текст вручную.", tone: "error" });
    }
  }

  return (
    <LiquidGlass className="well overflow-hidden" data-open={open ? "" : undefined}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          className="group flex min-w-0 items-center gap-2.5 text-left disabled:cursor-default"
          onClick={() => collapsible && setOpen((v) => !v)}
          disabled={!collapsible}
          aria-expanded={open}
        >
          <FileText className="h-4 w-4 flex-none text-accent-hi" aria-hidden="true" />
          <span className="truncate font-sans text-[13px] font-semibold text-ink">{title}</span>
          <span className="flex-none text-[12px] text-ink-3">{lines} строк</span>
          {collapsible && (
            <ChevronDown className="acc-chevron h-4 w-4 flex-none text-ink-3" aria-hidden="true" />
          )}
        </button>
        {copyable && <button
          type="button"
          className="btn btn-sm !h-9 flex-none !px-3.5 !text-[13px]"
          onClick={copy}
        >
          {copied ? (
            <Check className="pop-in text-ok" aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
          {copied ? "Скопировано" : "Копировать"}
        </button>}
      </div>
      <OriginDisclosure open={open}>
        {note && <p className="px-4 pb-3 text-[13px] leading-relaxed text-ink-2">{note}</p>}
        <div className="hairline" />
        <pre className="code max-h-[420px] overflow-auto px-4 py-4" tabIndex={0}>
          {content}
        </pre>
      </OriginDisclosure>
    </LiquidGlass>
  );
}
