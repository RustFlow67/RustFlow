"use client";
import { Heart } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};
export default function VoteButton({ slug }: { slug: string; initialLikes: number; initialLiked: boolean }) {
  const initial = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(`shift:helpful:${slug}`) === "1"; } catch { return false; }
  }, () => false);
  const [choice, setChoice] = useState<boolean | null>(null);
  const liked = choice ?? initial;
  function toggle() {
    const next = !liked;
    setChoice(next);
    try { localStorage.setItem(`shift:helpful:${slug}`, next ? "1" : "0"); } catch { /* session-only */ }
  }
  return <button type="button" className="btn btn-lg" onClick={toggle} aria-pressed={liked} title="Личная отметка на этом устройстве">
    <Heart aria-hidden="true" fill={liked ? "currentColor" : "none"} />
    <span>{liked ? "Помогло" : "Мне помогло"}</span>
  </button>;
}
