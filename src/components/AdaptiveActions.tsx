"use client";

import { Check, RotateCcw, Download } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { IS_DESKTOP_APP } from "@/lib/config";
import { getSystemBridge, type DriverSelection, type SystemResult, type TweakPlan } from "@/services/systemBridge";

type Action = TweakPlan | ({ kind: "driver" } & DriverSelection);

/** Web children retain their original links, login gates and fallback flows. */
export default function AdaptiveActions({ action, children }: { action: Action; children: ReactNode }) {
  return IS_DESKTOP_APP ? <NativeActions action={action} /> : children;
}

function NativeActions({ action }: { action: Action }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const driver = action.kind === "driver";
  async function run(undo = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    let result: SystemResult;
    try {
      const host = getSystemBridge();
      result = undo
        ? await host.rollbackChanges()
        : action.kind === "driver"
          ? await host.installCleanDriver({ family: action.family, model: action.model })
          : await host.applyTweaks(action);
      switch (result.status) {
        case "ok":
          setMessage(undo ? "Изменения отменены." : driver ? "Драйвер установлен." : "Настройки применены.");
          break;
        case "unavailable":
          setMessage("Системный модуль пока не подключён. Изменений на ПК нет.");
          break;
        case "cancelled":
          setMessage("Операция отменена.");
          break;
        default:
          setMessage("Системный модуль не подтвердил выполнение. Проверьте состояние ПК перед повтором.");
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
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run()}>
        {driver ? <Download aria-hidden="true" /> : <Check aria-hidden="true" />}
        {driver ? "Установить чистый драйвер" : "Применить в систему"}
      </button>
      {!driver && (
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(true)}>
          <RotateCcw aria-hidden="true" /> Откатить изменения
        </button>
      )}
      <span className="native-action-status" role="status">
        {busy ? "Ожидаем ответа системного модуля…" : message}
      </span>
    </div>
  );
}
