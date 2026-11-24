"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SceneKind, SceneState } from './scene';

type SceneHandle = { update: (state: SceneState) => void; dispose: () => void };

export default function WebGLScene({ kind, state = {}, className, label, fallback }: { kind: SceneKind; state?: SceneState; className: string; label?: string; fallback?: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const latest = useRef(state);
  const [failed, setFailed] = useState(false);
  useEffect(() => { latest.current = state; handle.current?.update(state); }, [state]);
  useEffect(() => {
    if (failed) return;
    let cancelled = false;
    const node = canvas.current;
    const lost = (event: Event) => { event.preventDefault(); if (!cancelled) setFailed(true); };
    node?.addEventListener('webglcontextlost', lost);
    import('./scene').then(({ createScene }) => {
      if (cancelled || !canvas.current) return;
      try { handle.current = createScene(canvas.current, kind, latest.current); canvas.current.dataset.webgl = 'ready'; }
      catch { setFailed(true); }
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; node?.removeEventListener('webglcontextlost', lost); handle.current?.dispose(); handle.current = null; };
  }, [kind, failed]);
  const interactive = kind === 'sculpture' || kind === 'balance';
  return <div className={className} data-scene={kind} data-scene-state={failed ? 'fallback' : 'active'}>
    {!failed && <canvas ref={canvas} className="webgl-canvas" role={interactive ? 'img' : undefined} aria-label={interactive ? label : undefined} aria-hidden={interactive ? undefined : true} tabIndex={interactive ? 0 : undefined} />}
    {failed && (fallback ?? <div className="webgl-fallback" aria-hidden="true" />)}
  </div>;
}
