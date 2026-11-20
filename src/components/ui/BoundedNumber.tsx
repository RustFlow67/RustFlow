"use client";
import { useState } from "react";
import { Input } from "./index";

/** A short prefix (e.g. 3 while typing 3600) lives in the field, never in a
 * build, URL or chart. Commit a legal value on blur/Enter. No exponent notation. */
export default function BoundedNumber({
  label,
  value,
  min,
  max,
  onValue,
  onCommit,
  decimals = 0,
  optional = false,
  context,
  unit = "",
  placeholder,
}: {
  label: string;
  value: number | string;
  min: number;
  max: number;
  onValue: (value: string) => void;
  onCommit?: (value: string) => void;
  decimals?: number;
  optional?: boolean;
  context?: string;
  unit?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null),
    [note, setNote] = useState("");
  const text = draft ?? String(value),
    suffix = unit ? ` ${unit}` : "";
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const announce = (n: number) =>
    setNote(
      `${n > max ? "Максимум" : "Минимум"}${context ? ` для ${context}` : ""} — ${n > max ? max : min}${suffix}`,
    );
  function change(raw: string) {
    const s = raw.replace(",", ".");
    if (!(decimals ? new RegExp(`^\\d*(?:\\.\\d{0,${decimals}})?$`) : /^\d*$/).test(s)) {
      setNote("Введите положительное число без букв и знаков.");
      return;
    }
    setNote("");
    if (!s || s === ".") {
      setDraft(s);
      if (optional && !s) onValue("");
      return;
    }
    const n = Number(s);
    if (
      n > max ||
      (n === 0 && (!decimals || min >= 1)) ||
      // "192" is below 800 but must be allowed to become "1920". Publish
      // only legal numbers; clamp a short unfinished prefix on commit.
      (n < min && (decimals ? s.includes(".") && s.split(".")[1].length >= decimals : n * 10 > max))
    ) {
      announce(n);
      setDraft(String(clamp(n)));
      onValue(String(clamp(n)));
      return;
    }
    setDraft(s);
    if (n >= min) onValue(String(n));
  }
  function commit() {
    const n = Number(text);
    let result: string;
    if (!text || !Number.isFinite(n)) result = optional ? "" : String(value);
    else {
      result = String(clamp(n));
      if (n !== clamp(n)) announce(n);
    }
    setDraft(null);
    onValue(result);
    onCommit?.(result);
  }
  return (
    <Input
      label={label}
      type="text"
      role="spinbutton"
      inputMode={decimals ? "decimal" : "numeric"}
      autoComplete="off"
      spellCheck={false}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value !== "" ? Number(value) : undefined}
      placeholder={placeholder}
      hint={note || (context ? `${context}: ${min}–${max}${suffix}` : undefined)}
      value={text}
      onChange={(e) => change(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          change(
            String(
              clamp(
                Number(
                  ((Number(text) || min) + (e.key === "ArrowUp" ? 1 : -1) * 10 ** -decimals).toFixed(
                    decimals,
                  ),
                ),
              ),
            ),
          );
        }
      }}
    />
  );
}
