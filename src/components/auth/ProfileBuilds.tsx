"use client";

import { ChevronDown, Gauge, Trash2 } from "lucide-react";
import { useState } from "react";
import Link from "@/components/RouteLink";
import { Badge } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatBuildResolution } from "@/lib/models/build-resolution";
import { useRustFlowStore } from "@/lib/storage/useStore";

export default function ProfileBuilds({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { state, storage } = useRustFlowStore();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);
  const builds = state?.builds ?? [];
  return <>
    <details className="profile-local">
      <summary>Мои сохранённые сборки <ChevronDown aria-hidden="true" /></summary>
      <p className="mb-2 text-xs text-ink-3">Копии на этом устройстве. Удаление копии не меняет сборку аккаунта.</p>
      {!builds.length ? <p className="well p-2.5 text-sm text-ink-2">В браузере пока нет сохранённых сборок.</p> : <ul className="space-y-2">
        {builds.map(({ id, input }) => <li key={id} className="well flex items-center gap-1.5 p-2.5">
          <Link href={`/benchmark?saved=${encodeURIComponent(id)}#build-config`} className="flex min-w-0 flex-1 items-center gap-2" onNavigate={() => {
            storage.setActiveBuild(id);
            onNavigate();
          }}>
            <Gauge size={17} className="flex-none text-accent-hi" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block wrap-anywhere text-sm font-bold">{input.name}</span>
              <span className="block text-xs text-ink-3">{input.ramGb} ГБ · {input.ramMhz} МТ/с CL{input.ramCl} · {formatBuildResolution(input)}</span>
              {state?.activeBuildId === id && <Badge tone="safe" className="mt-1">Активна</Badge>}
            </span>
          </Link>
          <button type="button" className="btn btn-sm btn-icon flex-none" aria-label={`Удалить сборку «${input.name}»`}
            onClick={() => setDeleting(id)}><Trash2 aria-hidden="true" /></button>
        </li>)}
      </ul>}
    </details>
    <ConfirmDialog open={open && deleting !== null} onClose={() => setDeleting(null)}
      title="Удалить сохранённую сборку?" description="Удалится только копия в этом браузере. Сборка аккаунта и отмеченные твики сохранятся."
      confirmLabel="Удалить" onConfirm={() => {
        if (!open || !deleting) return;
        storage.deleteBuild(deleting);
        toast({ title: "Копия сборки удалена", tone: "info" });
      }} />
  </>;
}
