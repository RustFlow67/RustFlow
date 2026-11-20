"use client";

import { useSyncExternalStore } from "react";
import type { BuildInput } from "@/lib/models/build";
import type { GraphicsProfileId } from "@/lib/graphics-profiles";

/** A preset preview can differ from the active saved record. Publishing a
 * draft is not a save. An incomplete draft must never overwrite a good build. */
interface Draft { input: BuildInput; mode: GraphicsProfileId; id?: string }
let current: Draft | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const calculatorDraft = () => current;
export const useCalculatorDraft = () => useSyncExternalStore(subscribe,calculatorDraft,() => undefined);
export function publishDraft(draft: Draft) {
  current = draft; emit();
  return () => { if (current === draft) { current = undefined; emit(); } };
}
