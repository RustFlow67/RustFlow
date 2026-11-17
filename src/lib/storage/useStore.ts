"use client";

import { useSyncExternalStore } from "react";
import { storage, type PersistedState } from "./adapter";

const subscribe = (cb: () => void) => storage.subscribe(cb);
const getClientSnapshot = (): PersistedState => storage.getState();
const getServerSnapshot = (): PersistedState | null => null;

/**
 * Реактивная подписка на адаптер хранилища через useSyncExternalStore (React 19):
 * без каскадных перерисовок и с безопасным skeleton-состоянием при SSR.
 */
export function useRustFlowStore(): {
  state: PersistedState | null;
  hydrated: boolean;
  storage: typeof storage;
} {
  const state = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return { state, hydrated: state !== null, storage };
}
