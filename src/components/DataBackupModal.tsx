"use client";

import { Check, Copy, Download, FileJson, RotateCcw, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import Segmented from "@/components/Segmented";
import { Badge, Button } from "@/components/ui";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { storage, type ImportPreview } from "@/lib/storage/adapter";
import { useRustFlowStore } from "@/lib/storage/useStore";

export type BackupTab = "export" | "import";

function useDownloadBackup() {
  const { toast } = useToast();
  return () => {
    const bundle = storage.exportBundle();
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rustflow-profile-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({
      title: "JSON-профиль скачан",
      description: `Сборок: ${bundle.builds.length}, твиков: ${bundle.appliedTweaks.length}.`,
      tone: "success",
    });
  };
}

/**
 * Модальное окно экспорта/импорта JSON:
 * «Моя сборка + применённые твики + FPS до/после + настройки Твикера».
 */
export default function DataBackupModal({
  open,
  onClose,
  tab,
  onTabChange,
}: {
  open: boolean;
  onClose: () => void;
  tab: BackupTab;
  onTabChange: (tab: BackupTab) => void;
}) {
  const { state } = useRustFlowStore();
  const { toast } = useToast();
  const handleDownloadJson = useDownloadBackup();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rawInput, setRawInput] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildsCount = state?.builds.length ?? 0;
  const appliedCount = state
    ? Object.values(state.tweaks).filter((t) => t.applied).length
    : 0;
  const measuredCount = state
    ? Object.values(state.tweaks).filter((t) => t.fpsBefore !== null && t.fpsAfter !== null).length
    : 0;
  const activeBuild = state?.builds.find((b) => b.id === state.activeBuildId) ?? state?.builds[0];

  async function handleCopyJson() {
    try {
      const json = JSON.stringify(storage.exportBundle(), null, 2);
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({ title: "JSON скопирован в буфер обмена", tone: "success" });
    } catch {
      toast({ title: "Не удалось скопировать", description: "Скачайте JSON файлом.", tone: "error" });
    }
  }

  function parseCandidate(text: string) {
    setRawInput(text);
    if (!text.trim()) {
      setImportError(null);
      setPreview(null);
      return;
    }
    const check = storage.validateImport(text);
    if (!check.ok) {
      setImportError(check.error);
      setPreview(null);
    } else {
      setImportError(null);
      setPreview(check.preview);
    }
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      parseCandidate(text);
    } catch {
      setImportError("Не удалось прочитать выбранный файл.");
      setPreview(null);
    }
  }

  function executeImport(mode: "merge" | "replace") {
    if (!open || !preview) return;
    storage.applyImport(preview.bundle, mode);
    toast({
      title: mode === "replace" ? "Профиль заменён из JSON" : "Данные объединены из JSON",
      description: `Загружено сборок: ${preview.buildsCount}, применённых твиков: ${preview.appliedCount}.`,
      tone: "success",
    });
    setRawInput("");
    setPreview(null);
    setImportError(null);
    onClose();
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Резервная копия профиля (JSON)"
        description="Копия сохранённых сборок и настроек браузера. Она не меняет сборку в аккаунте и не включает данные входа."
        maxWidth="max-w-xl"
      >
        <Segmented
          ariaLabel="Режим работы с JSON"
          value={tab}
          onChange={onTabChange}
          options={[
            { value: "export", label: "Экспорт JSON" },
            { value: "import", label: "Импорт JSON" },
          ]}
          className="w-full"
        />

        {tab === "export" ? (
          <div className="mt-5 space-y-4">
            <div className="well space-y-2.5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">Текущие данные в браузере</span>
                <Badge tone="measured">schema v1 · localStorage</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-1 text-sm sm:grid-cols-3">
                <div className="tile p-3 text-center">
                  <span className="block text-xl font-extrabold tabular-nums">{buildsCount}</span>
                  <span className="text-[12px] text-ink-3">сборок</span>
                </div>
                <div className="tile p-3 text-center">
                  <span className="block text-xl font-extrabold tabular-nums">{appliedCount}</span>
                  <span className="text-[12px] text-ink-3">применено</span>
                </div>
                <div className="tile p-3 text-center">
                  <span className="block text-xl font-extrabold tabular-nums">{measuredCount}</span>
                  <span className="text-[12px] text-ink-3">FPS в твиках</span>
                </div>
              </div>
              {activeBuild && (
                <p className="pt-1 text-[13px] text-ink-2">
                  Активная сборка: <strong className="text-ink">{activeBuild.input.name}</strong> ({activeBuild.score10}/10)
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button variant="primary" onClick={handleDownloadJson} className="flex-1">
                <Download aria-hidden="true" />
                Скачать .json
              </Button>
              <Button variant="secondary" onClick={handleCopyJson}>
                {copied ? <Check className="text-ok" aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? "Скопировано" : "Копировать"}
              </Button>
            </div>

            <div className="hairline my-2" />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-[12.5px] text-ink-3">Очистить локальное хранилище (сборки, отметки, настройки)</p>
              <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
                <RotateCcw aria-hidden="true" />
                Сбросить всё
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                tabIndex={-1}
                onChange={handleFileSelect}
              />
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload aria-hidden="true" />
                Выбрать файл .json
              </Button>
              <span className="text-[12.5px] text-ink-3">или вставьте содержимое JSON ниже</span>
            </div>

            <div>
              <label htmlFor="rf-import-json" className="mb-1.5 block text-[13px] font-semibold text-ink-2">
                Содержимое JSON
              </label>
              <textarea
                id="rf-import-json"
                className="field font-mono !text-[12.5px]"
                rows={5}
                placeholder='{"app": "RustFlow", "schemaVersion": 1, ...}'
                value={rawInput}
                aria-invalid={importError ? "true" : undefined}
                onChange={(e) => parseCandidate(e.target.value)}
              />
              {importError && (
                <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
                  {importError}
                </p>
              )}
            </div>

            {preview && (
              <div className="well space-y-2 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-ok">
                  <FileJson className="h-4 w-4" aria-hidden="true" />
                  Файл проверен и готов к импорту
                </p>
                <p className="text-[13px] text-ink-2">
                  Сборок: <strong>{preview.buildsCount}</strong> · Применённых твиков:{" "}
                  <strong>{preview.appliedCount}</strong> · Замеров FPS в карточках:{" "}
                  <strong>{preview.measuredTweaksCount}</strong>.
                </p>
                {preview.myBuildTitle && (
                  <p className="text-[12.5px] text-ink-3">Главная сборка: {preview.myBuildTitle}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2.5">
              <Button
                variant="secondary"
                disabled={!preview}
                onClick={() => executeImport("merge")}
              >
                Объединить с текущими
              </Button>
              <Button
                variant="primary"
                disabled={!preview}
                onClick={() => setConfirmReplace(true)}
              >
                Заменить полностью
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={open && confirmReplace}
        onClose={() => setConfirmReplace(false)}
        onConfirm={() => executeImport("replace")}
        title="Заменить текущие данные?"
        description="Текущие сборки, отметки «применено» и настройки Твикера в этом браузере будут полностью перезаписаны данными из выбранного JSON-файла."
        confirmLabel="Да, заменить"
      />

      <ConfirmDialog
        open={open && confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          if (!open) return;
          storage.resetAll();
          toast({ title: "Все локальные данные очищены", tone: "info" });
          onClose();
        }}
        title="Очистить все локальные данные?"
        description="Будут удалены сохранённые сборки, отметки применённых твиков, поля FPS до/после и настройки Твикера. Рекомендуем сначала скачать JSON-копию."
        confirmLabel="Удалить всё"
      />
    </>
  );
}
