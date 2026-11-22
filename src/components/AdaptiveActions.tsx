"use client";

import { isTauri } from "@tauri-apps/api/core";
import { Check, Download, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IS_DESKTOP_APP } from "@/lib/config";
import {
  getSystemBridge,
  initSystemBridge,
  type DriverSelection,
  type SystemResult,
  type TweakPlan,
} from "@/services/systemBridge";

type Action = TweakPlan | ({ kind: "driver" } & DriverSelection);

const subscribeNoop = () => () => {};

function useIsTauri() {
  return useSyncExternalStore(
    subscribeNoop,
    () => isTauri(),
    () => false,
  );
}

function outcomeMessage(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "message" in value) {
    const msg = (value as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim().length > 0) {
      return msg;
    }
  }
  return fallback;
}

/** В веб-версии рендерит исходный контент, в десктопе — нативные кнопки. */
export default function AdaptiveActions({ action, children }: { action: Action; children: ReactNode }) {
  return IS_DESKTOP_APP ? <NativeActions action={action} /> : children;
}

function NativeActions({ action }: { action: Action }) {
  const tauri = useIsTauri();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const driver = action.kind === "driver";

  useEffect(() => {
    initSystemBridge();
  }, []);

  async function run(mode: "primary" | "native-pack" | "rollback" = "primary") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");

    let result: SystemResult<unknown>;
    try {
      const host = getSystemBridge();
      if (mode === "rollback") {
        result =
          action.kind === "pack" && tauri && !host.executeTweakPlan
            ? { status: "unavailable" }
            : await host.rollbackChanges();
      } else if (mode === "native-pack" && action.kind === "pack") {
        result = host.executeTweakPlan
          ? await host.executeTweakPlan(action)
          : await host.applyTweaks({ ...action, execution: "native" });
      } else if (action.kind === "driver") {
        result = await host.installCleanDriver({ family: action.family, model: action.model });
      } else {
        result = await host.applyTweaks(action);
      }

      switch (result.status) {
        case "ok": {
          if (mode === "rollback") {
            setMessage(outcomeMessage(result.value, "Изменения отменены."));
          } else if (driver) {
            setMessage(outcomeMessage(result.value, "Драйвер установлен."));
          } else if (action.kind === "pack" && tauri && mode === "primary") {
            setMessage(
              "Пакет сохранён. Запрошено открытие Проводника с выделением README.txt: прочитайте инструкцию и создайте снимки перед ручным применением. Твики не запускались.",
            );
          } else {
            setMessage(outcomeMessage(result.value, "Настройки применены."));
          }
          break;
        }
        case "unavailable":
          setMessage("Системный модуль пока не подключён. Изменений на ПК нет.");
          break;
        case "cancelled":
          setMessage("Операция отменена.");
          break;
        case "error":
          setMessage(
            result.message ||
              (action.kind === "pack" && tauri && mode === "primary"
                ? "Не удалось сохранить пакет или открыть Проводник. Проверьте папку RustFlow_Tweaks на Рабочем столе."
                : "Системный модуль вернул ошибку. Проверьте состояние ПК перед повтором."),
          );
          break;
        default:
          setMessage(
            action.kind === "pack" && tauri && mode === "primary"
              ? "Не удалось сохранить пакет или открыть Проводник. Проверьте папку RustFlow_Tweaks на Рабочем столе."
              : "Системный модуль не подтвердил выполнение. Проверьте состояние ПК перед повтором.",
          );
      }
    } catch {
      setMessage("Не удалось получить подтверждение от системного модуля.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="native-actions" aria-busy={busy}>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run("primary")}>
        {driver ? <Download aria-hidden="true" /> : <Check aria-hidden="true" />}
        {driver
          ? "Установить чистый драйвер"
          : tauri
            ? action.kind === "cfg"
              ? "Применить в игру"
              : "Подготовить и открыть пакет твиков"
            : "Применить в систему"}
      </button>

      {action.kind === "pack" && tauri && (
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy}
          onClick={() => void run("native-pack")}
        >
          <ShieldCheck aria-hidden="true" /> Применить в систему (с бэкапом)
        </button>
      )}

      {!driver && !(action.kind === "pack" && tauri) && (
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run("rollback")}>
          <RotateCcw aria-hidden="true" /> Откатить изменения
        </button>
      )}

      {action.kind === "pack" && tauri && (
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run("rollback")}>
          <RotateCcw aria-hidden="true" /> Откатить системный пакет
        </button>
      )}

      <span className="native-action-status" role="status">
        {busy ? "Ожидаем ответа системного модуля…" : message}
      </span>
    </div>
  );
}
