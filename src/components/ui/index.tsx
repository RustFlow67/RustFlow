"use client";

import { RefreshCw, X } from "lucide-react";
import {
  useId,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

/* ------------------------------ Card ------------------------------ */

export type CardVariant = "default" | "blur" | "accent" | "danger" | "well" | "tile";

const CARD_CLASS: Record<CardVariant, string> = {
  default: "glass",
  blur: "glass glass-blur",
  accent: "glass glass-accent",
  danger: "glass glass-danger",
  well: "well",
  tile: "tile",
};

export function Card({
  variant = "default",
  interactive = false,
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  interactive?: boolean;
}) {
  const hover = interactive ? (variant === "tile" ? "tile-hover" : "glass-hover") : "";
  return (
    <div className={`${CARD_CLASS[variant]} ${hover} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

/* ----------------------------- Button ----------------------------- */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  const vClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "danger"
        ? "btn-danger"
        : variant === "ghost"
          ? "btn-ghost"
          : "";
  const sClass =
    size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : size === "icon" ? "btn-icon" : "";

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn ${vClass} ${sClass} ${className}`.trim()}
      {...rest}
    >
      {loading && <RefreshCw className="spin-slow" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ------------------------------ Input ----------------------------- */

export function Input({
  label,
  hideLabel = false,
  hint,
  error,
  icon,
  onClear,
  fieldSize = "md",
  className = "",
  id: customId,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  onClear?: () => void;
  fieldSize?: "sm" | "md";
}) {
  const autoId = useId();
  const id = customId ?? autoId;
  const msgId = `${id}-msg`;
  const hasValue = rest.value !== undefined && String(rest.value).length > 0;

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className={hideLabel ? "sr-only" : "mb-1.5 block text-[13px] font-semibold text-ink-2"}
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className={`field ${fieldSize === "sm" ? "field-sm" : ""} ${icon ? "!pl-10" : ""} ${
            onClear && hasValue ? "!pr-10" : ""
          } ${className}`.trim()}
          {...rest}
        />
        {onClear && hasValue && !rest.disabled && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Очистить поле «${label}»`}
            className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-ink-2 hover:bg-white/20 hover:text-white"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {error ? (
        <p id={msgId} role="alert" className="mt-1.5 text-[12.5px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="mt-1.5 text-[12px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ----------------------------- Select ----------------------------- */

export function Select({
  label,
  hideLabel = false,
  hint,
  error,
  options,
  fieldSize = "md",
  className = "",
  id: customId,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  options: readonly { value: string | number; label: string }[];
  fieldSize?: "sm" | "md";
}) {
  const autoId = useId();
  const id = customId ?? autoId;
  const msgId = `${id}-msg`;

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className={hideLabel ? "sr-only" : "mb-1.5 block text-[13px] font-semibold text-ink-2"}
      >
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error || hint ? msgId : undefined}
        className={`field ${fieldSize === "sm" ? "field-sm" : ""} ${className}`.trim()}
        {...rest}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={msgId} role="alert" className="mt-1.5 text-[12.5px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="mt-1.5 text-[12px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------ Badge ----------------------------- */

export type BadgeTone =
  | "neutral"
  | "safe"
  | "caution"
  | "harmful"
  | "measured"
  | "myth"
  | "accent";

const BADGE_CLASS: Record<BadgeTone, string> = {
  neutral: "chip",
  safe: "chip chip-safe",
  caution: "chip chip-caution",
  harmful: "chip chip-harmful",
  measured: "chip chip-measured",
  myth: "chip chip-myth",
  accent: "chip chip-accent",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className = "",
  title,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={`${BADGE_CLASS[tone]} ${className}`.trim()} title={title}>
      {dot && <i className="dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ----------------------------- Switch ----------------------------- */

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" aria-hidden="true" />
    </button>
  );
}

/* ------------------------------ Meter ----------------------------- */

/** Индикатор прогресса на чистом transform: scaleX (0..100%). */
export function Meter({
  percent,
  fromColor,
  toColor,
  label,
  className = "",
}: {
  percent: number;
  fromColor?: string;
  toColor?: string;
  label?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const style: CSSProperties = {
    "--scale": String(clamped / 100),
    ...(fromColor ? { "--m1": fromColor } : {}),
    ...(toColor ? { "--m2": toColor } : {}),
  } as CSSProperties;

  return (
    <div
      className={`meter ${className}`.trim()}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(clamped) : undefined}
    >
      <i style={style} />
    </div>
  );
}

/* ---------------------------- Skeleton ---------------------------- */

export function Skeleton({ className = "h-24 w-full" }: { className?: string }) {
  return <div className={`skeleton ${className}`.trim()} aria-hidden="true" />;
}

/* --------------------------- EmptyState --------------------------- */

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass pop-in mx-auto max-w-lg p-7 text-center sm:p-9">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-ink-2">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-bold tracking-tight text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{hint}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}
