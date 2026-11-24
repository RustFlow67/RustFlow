import LiquidGlass from "@/components/LiquidGlass";
import { Sparkles } from "lucide-react";

/** Both reports are opened by the same glass control, including its focus box. */
export default function SummaryButton({
  show,
  disabled = false,
}: {
  show?: (from: HTMLButtonElement) => void;
  disabled?: boolean;
}) {
  return (
    <LiquidGlass
      as="button"
      island
      shape="pill"
      type="button"
      className="btn summary-trigger"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-label="Посмотреть сводку"
      onClick={(e) => show?.(e.currentTarget)}
    >
      Посмотреть сводку <Sparkles aria-hidden="true" />
    </LiquidGlass>
  );
}
