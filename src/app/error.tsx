"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, type CSSProperties } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="glass pop-in max-w-lg p-8 text-center sm:p-12" role="alert">
        <span className="icon-tile mx-auto" style={{ "--c1": "#ffd60a", "--c2": "#ff9f0a" } as CSSProperties}>
          <TriangleAlert aria-hidden="true" />
        </span>
        <h1 className="headline mt-6 text-2xl">Страница не загрузилась</h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
          Что-то пошло не так на нашей стороне. Попробуйте ещё раз — обычно это помогает.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={reset}>
            <RefreshCw aria-hidden="true" />
            Попробовать снова
          </button>
          <Link href="/" className="btn">
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
