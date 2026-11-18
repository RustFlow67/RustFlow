"use client";

import LiquidSelect from "@/components/LiquidSelect";

import { Copy, Download, Link2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { decodeBuildCode, encodeBuildCode } from "@/lib/addons/build-code";
import { copyText } from "@/lib/addons/share-text";
import { evaluateBuild10, isValidBuildInput, QUICK_SAMPLE_BUILDS } from "@/lib/models/build";
import { formatBuildResolution } from "@/lib/models/build-resolution";
import { useRustFlowStore } from "@/lib/storage/useStore";
import { useAccount } from "@/components/auth/AccountProvider";
import ProfileGate from "@/components/auth/ProfileGate";
import { useToast } from "@/components/ui/Toast";
import BuildRadar from "./BuildRadar";
import Panel from "./Panel";
import styles from "./addons.module.css";

const locationSnapshot = () => window.location.href;
const serverLocation = () => "";
const REFERENCE = "reference";
function subscribeLocation(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
  };
}

export default function BuildShare() {
  const href = useSyncExternalStore(subscribeLocation, locationSnapshot, serverLocation);
  const location = href ? new URL(href) : null;
  const hash = location?.hash ?? "";
  const isSharedLink = hash.startsWith("#b=");
  const incoming = isSharedLink ? decodeBuildCode(hash.slice(3)) : null;
  const evaluation = incoming && evaluateBuild10(incoming);
  const { state, storage } = useRustFlowStore();
  const { session } = useAccount();
  const user = session?.user;
  const { toast } = useToast();
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const builds = (user ? state?.builds ?? [] : []).filter((item) => item && isValidBuildInput(item.input));
  const active = builds.find((item) => item.id === state?.activeBuildId) ?? builds[0];
  const activeCode = active ? encodeBuildCode(active.input) : null;
  const link = location && activeCode ? `${location.origin}/benchmark#b=${activeCode}` : "";
  const incomingCode = incoming ? encodeBuildCode(incoming) : null;
  const duplicate = incomingCode !== null && builds.some((item) => encodeBuildCode(item.input) === incomingCode);
  const chosen = comparisonId === REFERENCE ? undefined : builds.find(({ id }) => id === comparisonId) ?? active;
  const sample = QUICK_SAMPLE_BUILDS[0];

  useEffect(() => {
    if (isSharedLink) document.getElementById("share")?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [hash, isSharedLink]);

  async function copy() {
    if (!link) return;
    const copied = await copyText(link);
    toast({ title: copied ? "Ссылка на сборку скопирована" : "Скопируйте ссылку из поля вручную", tone: copied ? "success" : "info" });
  }

  function importBuild() {
    if (!user || !incoming || duplicate) return;
    setComparisonId(chosen?.id ?? REFERENCE);
    if (storage.saveBuild(incoming)) toast({ title: "Импортирована отдельная активная сборка" });
  }

  return <Panel id="share" title="Ссылка на сборку" kicker="Поделиться и сравнить" icon={<Link2 />}
    description="В #b=… записаны только компоненты и настройки сборки. Название профиля, ID владельца и отметки не передаются.">
    {link ? <div className={`${styles.inset} ${styles.spaced}`}>
      <label className={styles.label}>Ссылка на активную сборку
        <input className={styles.input} readOnly value={link} onFocus={(event) => event.target.select()} />
      </label>
      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={copy}><Copy aria-hidden="true" />Скопировать ссылку</button>
      </div>
    </div> : user ? <p className={styles.muted}>Чтобы создать ссылку, сохраните сборку в форме выше.</p>
      : <p className={styles.muted}>Войдите в профиль и сохраните сборку, чтобы создать ссылку.</p>}
    {isSharedLink && !incoming && <p className={`${styles.feedback} ${styles.alert}`} role="status">
      Не удалось прочитать сборку: ссылка повреждена или имеет неподдерживаемую версию. Ваши данные не изменились.
    </p>}
    {incoming && evaluation && <div className={`${styles.inset} ${styles.spaced}`}>
      <div className={styles.row}>
        <div className={styles.spaced}>
          <h3 className="font-bold">Сборка из ссылки</h3>
          <p>{evaluation.cpuName} + {evaluation.gpuName}</p>
          <p className={styles.muted}>{incoming.ramGb} ГБ ОЗУ · {incoming.ramMhz} МТ/с CL{incoming.ramCl} · {formatBuildResolution(incoming)}</p>
        </div>
        <strong className={styles.metric}>{evaluation.score10.toFixed(1)} / 10</strong>
      </div>
      <div className={styles.actions}>
        <LiquidSelect label="Сравнить с" value={chosen?.id ?? REFERENCE} onChange={setComparisonId} className="flex-1"
          options={[{ value: REFERENCE, label: "Пример: Ryzen 5 5600X + RTX 5060" }, ...builds.map((item) => ({
            value: item.id, label: item.input.name + (item.id === active?.id ? " (активная)" : ""),
          }))]} />
        <ProfileGate action="Импортировать как активную">
          <button type="button" disabled={duplicate} className={`${styles.action} ${styles.primary} self-end`} onClick={importBuild}>
            <Download aria-hidden="true" />{duplicate ? "Уже в моих сборках" : "Импортировать как активную"}
          </button>
        </ProfileGate>
      </div>
      <p className={styles.muted}>Открытие ссылки ничего не сохраняет. Импорт добавит отдельную активную сборку. Радар использует расчётные баллы, а не замеры.</p>
      <BuildRadar builds={[
        { id: "from-link", input: incoming },
        chosen ? { id: chosen.id, input: chosen.input } : { id: REFERENCE, input: sample.input, label: `Пример: ${sample.label}` },
      ]} />
    </div>}
  </Panel>;
}
