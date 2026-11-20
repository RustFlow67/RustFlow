"use client";

import { apiUrl } from "@/lib/api-base";

import { Heart } from "lucide-react";
import { useState } from "react";

export default function VoteButton({
  slug,
  initialLikes,
  initialLiked,
}: {
  slug: string;
  initialLikes: number;
  initialLiked: boolean;
}) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [burst, setBurst] = useState(0);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(false);
    const optimistic = !liked;
    setLiked(optimistic);
    setLikes((n) => Math.max(0, n + (optimistic ? 1 : -1)));
    if (optimistic) setBurst((n) => n + 1);
    try {
      const res = await fetch(apiUrl(`tweaks/${encodeURIComponent(slug)}/vote`), { method: "POST" });
      if (!res.ok) throw new Error("vote failed");
      const data = (await res.json()) as { likes: number; liked: boolean };
      setLikes(data.likes);
      setLiked(data.liked);
    } catch {
      setLiked(!optimistic);
      setLikes((n) => Math.max(0, n + (optimistic ? -1 : 1)));
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-lg"
      onClick={toggle}
      aria-pressed={liked}
      title={error ? "Не удалось сохранить голос. Попробуйте ещё раз." : "Отметить, что твик помог"}
    >
      <Heart
        key={burst}
        className={liked ? "pop-in" : ""}
        style={liked ? { fill: "var(--accent)", color: "var(--accent)" } : undefined}
        aria-hidden="true"
      />
      <span>{liked ? "Помогло" : "Мне помогло"}</span>
      <span className="tabular-nums text-ink-2" aria-label={`Отметок: ${likes}`}>
        {likes}
      </span>
    </button>
  );
}
