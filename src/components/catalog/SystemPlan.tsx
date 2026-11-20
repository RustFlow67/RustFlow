"use client";
import LiquidGlass from "@/components/LiquidGlass";
import { createContext, useEffect, useState, useRef, useContext, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { rememberPreset } from "../fx/presetHandoff";
import FrameTime from "../FrameTime";
import { ScanLine } from "lucide-react";
import Link from "../RouteLink";
import { useAccount } from "../auth/AccountProvider";
import { useRustFlowStore } from "@/lib/storage/useStore";
import { useCalculatorDraft } from "@/lib/storage/calculator-draft";
import { isValidBuildInput } from "@/lib/models/build";
import { formatBuildResolution } from "@/lib/models/build-resolution";
import { IS_DESKTOP_APP } from "@/lib/config";
import { getSystemBridge } from "@/services/systemBridge";
import { isWindows, type WindowsVersion } from "@/lib/models/build-settings";
import { planWindows, withHostWindows } from "@/lib/plan-windows";
import { systemPlan, systemPlanHref, type PlanIndex } from "@/lib/catalog/system-plan";

const Context = createContext<{
  plan: ReturnType<typeof systemPlan>;
  href: string;
  index: PlanIndex;
  hostWindows?: WindowsVersion;
} | null>(null);
export function SystemPlanProvider({ index, children }: { index: PlanIndex; children: ReactNode }) {
  const { state } = useRustFlowStore(),
    { session } = useAccount(),
    draft = useCalculatorDraft();
  const saved =
    state?.builds.find((b) => b.id === state.activeBuildId)?.input ??
    state?.builds[0]?.input ??
    session?.user?.build;
  const input = draft && isValidBuildInput(draft.input) ? draft.input : saved;
  const mode =
    input === draft?.input ? (draft?.mode ?? "competitive") : (input?.graphicsProfile ?? "competitive");
  const live =
    !!input &&
    (input === saved || (!!draft?.id && draft.id === state?.activeBuildId)) &&
    mode === (saved?.graphicsProfile ?? "competitive");
  const [hostWindows, setHostWindows] = useState<WindowsVersion>();
  useEffect(() => {
    if (!IS_DESKTOP_APP) return;
    let active = true;
    const read = async () => {
      const result = await getSystemBridge().readOperatingSystem();
      if (active && result.status === "ok" && isWindows(result.value.windowsVersion))
        setHostWindows(result.value.windowsVersion);
    };
    void read().catch(() => {
      /* Optional host: keep the edition unknown, never guess. */
    });
    return () => {
      active = false;
    };
  }, []);
  const value = useMemo(() => {
    const rig = input && withHostWindows(input, hostWindows);
    return {
      index,
      hostWindows,
      plan: rig ? systemPlan(rig, mode, index) : null,
      href: rig ? systemPlanHref(rig, mode, live) : "/benchmark",
    };
  }, [input, mode, live, index, hostWindows]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useSystemPlan = () => useContext(Context)!;
// Dock routes own one contextual placement each. Reference pages outside the
// Dock retain the shared plan; the calculator must never append a second card.
export function SitePlan() {
  return ["/", "/benchmark", "/presets", "/tweaker", "/guide", "/faq", "/drivers"].includes(
    usePathname(),
  ) ? null : (
    <PlanCard />
  );
}
export type MatchedPlan = NonNullable<ReturnType<typeof systemPlan>>;
export function MatchedPresetLink({ plan, primary = false }: { plan: MatchedPlan; primary?: boolean }) {
  const link = useRef<HTMLAnchorElement>(null),
    path = usePathname();
  return (
    <Link
      ref={link}
      href={`/presets?open=${encodeURIComponent(plan.best.slug)}`}
      className={`btn btn-sm ${primary ? "btn-primary" : ""}`}
      onNavigate={(e) => {
        if (path === "/presets") {
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("rustflow:matched-preset", {
              detail: { slug: plan.best.slug, from: link.current },
            }),
          );
        } else rememberPreset(plan.best.slug, link.current);
      }}
    >
      Открыть подобранный пресет ↗
    </Link>
  );
}
export function PlanActions({ plan, href }: { plan: MatchedPlan; href: string }) {
  const path = usePathname();
  return (
    <div className="plan-actions">
      <MatchedPresetLink plan={plan} />
      <Link
        href={href}
        className="btn btn-sm btn-primary"
        onNavigate={(e) => {
          if (path === "/tweaker" && location.pathname + location.search === href) {
            e.preventDefault();
            window.dispatchEvent(new Event("rustflow:reapply-plan"));
          }
        }}
      >
        Подготовить пакет в Твикере ↗
      </Link>
    </div>
  );
}
/** A single contextual strip, separate from the editable package summary. */
export function PlanStrip({ preview, frameTime = false }: { preview?: MatchedPlan; frameTime?: boolean }) {
  const active = useSystemPlan(),
    plan = preview ?? active.plan,
    href = preview ? systemPlanHref(preview.input, preview.mode, false) : active.href;
  return (
    <LiquidGlass as="section"
      className={`glass plan-strip${frameTime ? " plan-with-trace" : ""}`}
      aria-label="Автоподбор по конфигурации"
    >
      <div className="plan-strip-main">
        <div>
          <small className="rubric">
            <ScanLine size={14} />
            Автоподбор по конфигурации
          </small>
          {plan ? (
            <p>
              <strong>{plan.best.title}</strong> ·{" "}
              {[planWindows(plan.input.windowsVersion), plan.vendor.toUpperCase()]
                .filter(Boolean)
                .join(" · ")}{" "}
              · <b data-plan-count>{plan.slugs.length}</b> шагов · <code>gc.buffer {plan.gc}</code>
            </p>
          ) : (
            <p>Укажите свой ПК, чтобы увидеть ближайший пресет и подходящие шаги.</p>
          )}
        </div>
        {plan ? (
          <PlanActions plan={plan} href={href} />
        ) : (
          <Link className="btn btn-sm" href="/benchmark#build-config">
            Настроить сборку ↗
          </Link>
        )}
      </div>
      {frameTime && <FrameTime />}
    </LiquidGlass>
  );
}
export function PlanCard({ home = false, preview }: { home?: boolean; preview?: MatchedPlan }) {
  const active = useSystemPlan(),
    plan = preview ?? active.plan,
    href = preview ? systemPlanHref(preview.input, preview.mode, false) : active.href;
  const title = home ? "Автоподбор по конфигурации" : "ИИ-сводка RustFlow для вашей сборки";
  return (
    <LiquidGlass as="section" className={`glass system-plan${home ? " plan-with-trace" : ""}`} aria-label={title}>
      <div className="plan-copy">
        <small className="rubric">
          <ScanLine size={14} /> {home ? "По вашему ПК" : "Автоподбор по конфигурации"}
        </small>
        <h2>{title}</h2>
        {plan ? (
          <>
            <p>
              Ближайший пресет по CPU, GPU и разрешению: <strong>{plan.best.title}</strong>. Цель:{" "}
              {formatBuildResolution(plan.input)}.
            </p>
            <p>
              {[planWindows(plan.input.windowsVersion), plan.vendor.toUpperCase()]
                .filter(Boolean)
                .join(" · ")}{" "}
              · безопасных шагов: <b data-plan-count>{plan.slugs.length}</b>. В client.cfg:{" "}
              <code>gc.buffer {plan.gc}</code>.
            </p>
            <PlanActions plan={plan} href={href} />
            <small>Подбор отмечает шаги в пакете, но не запускает их на ПК.</small>
          </>
        ) : (
          <>
            <p>
              Укажите комплектующие и версию Windows — RustFlow подберёт ближайший пресет и обратимые шаги для
              вашего ПК.
            </p>
            <div className="plan-actions">
              <Link className="btn btn-sm" href="/benchmark#build-config">
                Настроить сборку ↗
              </Link>
              <Link className="btn btn-sm" href="/presets">
                Посмотреть готовые пресеты ↗
              </Link>
            </div>
          </>
        )}
      </div>
      {home && <FrameTime />}
    </LiquidGlass>
  );
}
