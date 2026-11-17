import {
  AppWindow,
  Cpu,
  Gamepad2,
  MemoryStick,
  Monitor,
  ShieldCheck,
  Terminal,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { TWEAK_GROUP_BY_ID, type TweakGroupId } from "@/lib/models/tweak";
import { CATEGORY_BY_ID } from "@/lib/tweaks/meta";
import type { CategoryId } from "@/lib/tweaks/types";

const CAT_ICONS: Record<CategoryId, LucideIcon> = {
  prep: ShieldCheck,
  windows: AppWindow,
  gpu: Monitor,
  game: Gamepad2,
  network: Wifi,
};

const GROUP_ICONS: Record<TweakGroupId, LucideIcon> = {
  "cpu-windows": Cpu,
  gpu: Monitor,
  "ram-ssd": MemoryStick,
  network: Wifi,
  "rust-settings": Gamepad2,
  "launch-options": Terminal,
};

export default function CategoryIcon({
  id,
  group,
  size = "md",
}: {
  id?: CategoryId;
  group?: TweakGroupId;
  size?: "sm" | "md";
}) {
  if (group) {
    const meta = TWEAK_GROUP_BY_ID[group];
    const Icon = GROUP_ICONS[group];
    return (
      <span
        className={`icon-tile ${size === "sm" ? "icon-tile-sm" : ""}`}
        style={{ "--c1": meta.from, "--c2": meta.to } as CSSProperties}
      >
        <Icon aria-hidden="true" />
      </span>
    );
  }
  const cat = id ?? "windows";
  const meta = CATEGORY_BY_ID[cat];
  const Icon = CAT_ICONS[cat];
  return (
    <span
      className={`icon-tile ${size === "sm" ? "icon-tile-sm" : ""}`}
      style={{ "--c1": meta.from, "--c2": meta.to } as CSSProperties}
    >
      <Icon aria-hidden="true" />
    </span>
  );
}
