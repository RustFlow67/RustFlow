"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "success" | "info" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: ToastAction;
}

interface ToastItem extends Required<Pick<ToastInput, "title" | "tone">> {
  id: number;
  description?: string;
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: "text-ok" },
  info: { icon: Info, className: "text-sky" },
  warning: { icon: AlertTriangle, className: "text-warn" },
  error: { icon: XCircle, className: "text-danger" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, tone = "success", durationMs = 3600 }: ToastInput) => {
      const id = ++seq.current;
      setItems((prev) => [{ id, title, description, tone }, ...prev].slice(0, 3));
      if (durationMs > 0) {
        const handle = setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, handle);
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((h) => clearTimeout(h));
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-stack"
        role="region"
        aria-label="Уведомления"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((item) => {
          const meta = TONE_ICON[item.tone];
          const Icon = meta.icon;
          return (
            <div
              key={item.id}
              className="toast-card"
              role={item.tone === "error" ? "alert" : "status"}
            >
              <Icon className={`mt-0.5 h-5 w-5 flex-none ${meta.className}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold leading-snug text-ink">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{item.description}</p>
                )}
                {item.action && (
                  <button
                    type="button"
                    className="btn btn-sm mt-2 !h-8 !px-3 !text-[12.5px]"
                    onClick={() => {
                      try {
                        item.action!.onClick();
                      } finally {
                        dismiss(item.id);
                      }
                    }}
                  >
                    {item.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/10 text-ink-2 hover:bg-white/20 hover:text-white"
                onClick={() => dismiss(item.id)}
                aria-label="Закрыть уведомление"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

const NOOP_TOAST: ToastContextValue = {
  toast: () => {},
  dismiss: () => {},
};

export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? NOOP_TOAST;
}
