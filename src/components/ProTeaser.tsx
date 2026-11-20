import LiquidGlass from "@/components/LiquidGlass";
import { Crown } from "lucide-react";
import { PRO_TEASER } from "@/lib/materials";

export default function ProTeaser() {
  return <LiquidGlass as="aside" className="pro-teaser"><Crown size={17} aria-hidden="true" /><div><strong>RUSTFLOW PRO</strong><p>{PRO_TEASER}</p></div></LiquidGlass>;
}
