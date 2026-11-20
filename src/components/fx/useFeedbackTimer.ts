"use client";
import { useEffect, useRef } from "react";
/** Clipboard/download feedback: replace pending resets and never schedule one
 * for an owner which unmounted during the clipboard permission prompt. */
export function useFeedbackTimer() {
  const clock = useRef(0),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(clock.current);
    };
  }, []);
  return (done: () => void, delay: number) => {
    if (alive.current) {
      clearTimeout(clock.current);
      clock.current = window.setTimeout(done, delay);
    }
  };
}
