"use client";
import { useFeedbackTimer } from "./fx/useFeedbackTimer";

import { Check, Download, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

/** Кнопка скачивания файла с подтверждением и Toast-уведомлением. */
export default function DownloadButton({
  href,
  label,
  variant = "primary",
  size = "md",
  iconOnly = false,
  className = "",
}: {
  href: string;
  label: string;
  variant?: "primary" | "glass" | "revert";
  size?: "sm" | "md" | "lg";
  iconOnly?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const feedbackLater=useFeedbackTimer();
  const [done, setDone] = useState(false);
  const Icon = variant === "revert" ? RotateCcw : Download;
  const classes = [
    "btn",
    variant === "primary" ? "btn-primary" : "",
    size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "",
    iconOnly ? "btn-icon" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <a
      href={href}
      download
      className={classes}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={() => {
        setDone(true);
        feedbackLater(() => setDone(false), 2000);
        toast({
          title: variant === "revert" ? "Скачивается файл отката" : "Загрузка файла началась",
          description: "Все файлы открытые — их можно проверить в Блокноте.",
          tone: "info",
        });
      }}
    >
      {done ? <Check className="pop-in" aria-hidden="true" /> : <Icon aria-hidden="true" />}
      {!iconOnly && <span>{done ? "Скачивается" : label}</span>}
    </a>
  );
}
