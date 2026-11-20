"use client";
import { useEffect, useRef } from "react";

/** Give the browser time to take the Blob; release *every* URL on repeated
 * downloads or unmount. An async ZIP response cannot outlive its owner. */
export function useDownload() {
  const owner = useRef<{ timers: Map<string, number> } | null>(null);
  useEffect(() => {
    const timers = new Map<string, number>();
    owner.current = { timers };
    return () => {
      owner.current = null;
      for (const [url, id] of timers) {
        clearTimeout(id);
        URL.revokeObjectURL(url);
      }
      timers.clear();
    };
  }, []);
  return (blob: Blob, filename: string) => {
    const current = owner.current;
    if (!current) return false;
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    try {
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
    } finally {
      a.remove();
      current.timers.set(
        url,
        window.setTimeout(() => {
          current.timers.delete(url);
          URL.revokeObjectURL(url);
        }, 4000),
      );
    }
    return true;
  };
}
