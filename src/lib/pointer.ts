/** Shared pointer position for cursor-driven flagship effects (single writer). */

interface PointerState {
  x: number;
  y: number;
  active: boolean;
  updatedAt: number;
}

const state: PointerState = { x: -9999, y: -9999, active: false, updatedAt: 0 };

export function setPointerPosition(x: number, y: number) {
  state.x = x;
  state.y = y;
  state.active = true;
  state.updatedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function clearPointerPosition() {
  state.active = false;
}

export function getPointerPosition(): Readonly<PointerState> {
  return state;
}
