"use client";

import { useMemo, useSyncExternalStore } from "react";
import { storage } from "@/lib/storage/adapter";
import type { ExtensionKey } from "@/lib/storage/extension-state";

export const ACHIEVEMENTS = [
  { id: "build", title: "Паспорт железа", description: "Сохранить сборку в «Сборке».", xp: 40 },
  { id: "tweaks", title: "Первые изменения", description: "Отметить три твика из безопасной категории.", xp: 40 },
  { id: "quiz", title: "Разбор мифов", description: "Закончить «Миф или правда».", xp: 30 },
  { id: "quiz-perfect", title: "Мифы разоблачены", description: "Ответить правильно на все вопросы.", xp: 30 },
] as const;

export type AchievementId = typeof ACHIEVEMENTS[number]["id"];
// Keep XP already earned from retired tools, without showing those achievements as available.
const ARCHIVED_REWARDS = [{ id: "roulette", xp: 20 }, { id: "plan-complete", xp: 70 }, { id: "measurement", xp: 40 }, { id: "lab", xp: 60 }] as const;
const REWARDS = [...ACHIEVEMENTS, ...ARCHIVED_REWARDS];
export function progressXp(earned: Progress["earned"]): number {
  return REWARDS.reduce((sum, item) => sum + (earned.includes(item.id) ? item.xp : 0), 0);
}

export const XP_PER_LEVEL = 100;
export const QUIZ_LENGTH = 6;

interface Progress {
  earned: (typeof REWARDS[number]["id"])[];
  quizBest: number | null;
}

const serverValue = () => undefined;

export function useAddonValue<T>(key: ExtensionKey, decode: (value: unknown) => T): T {
  const value = useSyncExternalStore(storage.addons.subscribe, () => storage.addons.getSnapshot()[key], serverValue);
  return useMemo(() => decode(value), [value, decode]);
}

function readProgress(value: unknown): Progress {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<Progress>;
  return {
    earned: REWARDS.filter((item) => Array.isArray(raw.earned) && raw.earned.includes(item.id)).map((item) => item.id),
    quizBest: typeof raw.quizBest === "number" && Number.isInteger(raw.quizBest) &&
      raw.quizBest >= 0 && raw.quizBest <= QUIZ_LENGTH ? raw.quizBest : null,
  };
}

export const useProgress = () => useAddonValue("progress", readProgress);

export function grantAchievements(ids: readonly AchievementId[], quizScore?: number) {
  storage.addons.update("progress", readProgress, (current) => {
    const added = ids.filter((id) => !current.earned.includes(id));
    const best = quizScore === undefined ? current.quizBest : Math.max(quizScore, current.quizBest ?? 0);
    return added.length === 0 && best === current.quizBest
      ? current
      : { earned: [...current.earned, ...new Set(added)], quizBest: best };
  });
}
