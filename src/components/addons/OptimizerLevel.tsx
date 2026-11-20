"use client";

import { useEffect } from "react";
import { Award, Check, LockKeyhole } from "lucide-react";
import Link from "@/components/RouteLink";
import { isValidBuildInput } from "@/lib/models/build";
import { useRustFlowStore } from "@/lib/storage/useStore";
import { ACHIEVEMENTS, grantAchievements, progressXp, useProgress, XP_PER_LEVEL, type AchievementId } from "@/lib/addons/progress";
import { Meter } from "../ui";
import Panel from "./Panel";
import styles from "./addons.module.css";

/** Derive one-time rewards from the real adapter, not samples or clicks. */
export function ProgressObserver({ eligibleSlugs }: { eligibleSlugs: readonly string[] }) {
  const { state } = useRustFlowStore();
  useEffect(() => {
    if (!state) return;
    const ids: AchievementId[] = [];
    if (state.builds.some((build) => isValidBuildInput(build.input))) ids.push("build");
    if (eligibleSlugs.filter((slug) => state.tweaks[slug]?.applied).length >= 3) ids.push("tweaks");
    if (ids.length) grantAchievements(ids);
  }, [eligibleSlugs, state]);
  return null;
}

export default function OptimizerLevel() {
  const progress = useProgress();
  const xp = progressXp(progress.earned);
  const level = 1 + Math.floor(xp / XP_PER_LEVEL);
  const remainder = xp % XP_PER_LEVEL;
  const earnedCount = ACHIEVEMENTS.filter((item) => progress.earned.includes(item.id)).length;
  const completed = earnedCount === ACHIEVEMENTS.length;
  return (
    <Panel id="level" kicker="Опыт и достижения" title="Уровень оптимизатора" icon={<Award />}
      description="XP начисляется один раз за каждое достижение и остаётся в этом браузере. ">
      <div className={`${styles.inset} ${styles.spaced}`}>
        <div className={styles.row} aria-live="polite">
          <strong className={styles.metric}>Уровень {level}</strong>
          <span className={styles.pill}>{xp} XP · {earnedCount}/{ACHIEVEMENTS.length}</span>
        </div>
        <Meter percent={completed ? 100 : 100 * remainder / XP_PER_LEVEL}
          label={completed ? "Все достижения получены" : "Прогресс до следующего уровня"} />
        <p className={styles.muted}>{completed ? "Все достижения получены." : `Ещё ${XP_PER_LEVEL - remainder} XP до уровня ${level + 1}.`}</p>
      </div>
      <ul className={`${styles.metrics} ${styles.list}`} aria-label="Достижения оптимизатора">
        {ACHIEVEMENTS.map((item) => {
          const earned = progress.earned.includes(item.id);
          return (
            <li key={item.id} className={`${styles.inset} ${styles.spaced}`}>
              <span className={`${styles.pill} ${earned ? styles.success : ""}`}>
                {earned ? <Check aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
                {earned ? "Получено" : "Не получено"} · {item.xp} XP
              </span>
              <strong>{item.title}</strong>
              <p className={styles.muted}>{item.description}</p>
            </li>
          );
        })}
      </ul>
      <p className={styles.muted}>Начните со <Link className={styles.link} href="/benchmark">сборки</Link> и отмечайте применённые шаги.</p>
    </Panel>
  );
}
