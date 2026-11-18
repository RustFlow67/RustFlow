/** LocalStorageAdapter's owner-scoped add-on records. The v1 backup stays unchanged. */
export type ExtensionKey = "progress" | "favorites";
type Values = Readonly<Partial<Record<ExtensionKey, unknown>>>;
type Envelope = { version: 1; ownerId: string; values: Values };

export interface ExtensionState {
  getSnapshot(): Values;
  subscribe(listener: () => void): () => void;
  update<T>(key: ExtensionKey, decode: (value: unknown) => T, change: (current: T) => T): void;
  clear(): void;
}

const EMPTY: Values = Object.freeze({});
const keyFor = (ownerId: string) => `rustflow:addons:v1:${JSON.stringify(ownerId)}`;

export function createExtensionState(
  getOwnerId: () => string,
  subscribeOwner: (listener: () => void) => () => void,
): ExtensionState {
  let cache: Envelope | null = null;
  let listening = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  function read(ownerId: string): Values {
    if (cache?.ownerId === ownerId) return cache.values;
    let values = EMPTY;
    try {
      const raw = window.localStorage.getItem(keyFor(ownerId));
      if (raw && raw.length <= 32768) {
        const data = JSON.parse(raw) as Partial<Envelope> | null;
        if (data?.version === 1 && data.ownerId === ownerId && data.values &&
            typeof data.values === "object" && !Array.isArray(data.values)) values = data.values;
      }
    } catch {
      // Corrupt JSON or storage unavailable: use the same in-memory fallback as the base adapter.
    }
    cache = { version: 1, ownerId, values };
    return values;
  }

  return {
    getSnapshot: () => typeof window === "undefined" ? EMPTY : read(getOwnerId()),
    subscribe(listener) {
      listeners.add(listener);
      if (typeof window !== "undefined" && !listening) {
        listening = true;
        window.addEventListener("storage", (event) => {
          if (event.key !== null && event.key !== keyFor(getOwnerId())) return;
          cache = null;
          emit();
        });
        subscribeOwner(() => {
          if (cache && cache.ownerId !== getOwnerId()) {
            cache = null;
            emit();
          }
        });
      }
      return () => { listeners.delete(listener); };
    },
    update(key, decode, change) {
      if (typeof window === "undefined") return;
      const ownerId = getOwnerId();
      const values = read(ownerId);
      const current = decode(values[key]);
      const updated = change(current);
      if (Object.is(current, updated)) return;
      cache = { version: 1, ownerId, values: { ...values, [key]: updated } };
      try { window.localStorage.setItem(keyFor(ownerId), JSON.stringify(cache)); } catch { /* keep cache */ }
      emit();
    },
    clear() {
      if (typeof window === "undefined") return;
      const ownerId = getOwnerId();
      cache = { version: 1, ownerId, values: EMPTY };
      try { window.localStorage.removeItem(keyFor(ownerId)); } catch { /* keep cache */ }
      emit();
    },
  };
}
