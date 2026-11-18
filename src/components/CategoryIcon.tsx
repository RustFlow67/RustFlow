import { Cpu, Gamepad2, MemoryStick, Monitor, Terminal, Wifi } from "lucide-react";
import type { TweakGroupId } from "@/lib/models/tweak";

const ICONS = { "cpu-windows": Cpu, gpu: Monitor, "ram-ssd": MemoryStick, network: Wifi, "rust-settings": Gamepad2, "launch-options": Terminal };

export default function CategoryIcon({ group, size = "md" }: { group: TweakGroupId; size?: "sm" | "md" }) {
  const Icon = ICONS[group];
  return <span className={`icon-tile ${size === "sm" ? "icon-tile-sm" : ""}`}><Icon aria-hidden="true" /></span>;
}
