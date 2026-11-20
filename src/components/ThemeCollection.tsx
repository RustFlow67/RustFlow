"use client";
import LiquidGlass from "@/components/LiquidGlass";
import { Check, Crown, LockKeyhole } from "lucide-react";
import type { CSSProperties } from "react";
import { MATERIALS } from "@/lib/materials";
import { useAccount } from "./auth/AccountProvider";
import { openPlayerProfile } from "./auth/ProfileGate";
import { useAppearance } from "./GlassAppearance";
import { useLiquidLens } from "./fx/useLiquidLens";
import ProTeaser from "./ProTeaser";
export default function ThemeCollection() {
  const { id, select } = useAppearance();
  const unlocked = Boolean(useAccount().session?.user);
  const { list, lens } = useLiquidLens(
    MATERIALS.findIndex((m) => m.id === id),
    MATERIALS.length,
    { continuous: true },
  );
  return (
    <>
      <div ref={list} className="material-grid" role="group" aria-label="Темы оформления">
        <LiquidGlass as="span" shape="pill" ref={lens} className="lens liquid-lens" aria-hidden="true" />
        {MATERIALS.map((m, i) => (
          <LiquidGlass as="button"
            key={m.id}
            type="button"
            className="material-tile"
            style={{ "--sample": m.swatch } as CSSProperties}
            data-liquid-item=""
            aria-pressed={m.id === id}
            aria-haspopup={m.vip && !unlocked ? "dialog" : undefined}
            aria-label={`${m.name} (${m.finish})${m.vip && !unlocked ? " — войти для разблокировки" : ""}`}
            onClick={(e) => (m.vip && !unlocked ? openPlayerProfile(e.currentTarget) : select(m.id))}
          >
            <span className="material-strip">
              <i className="material-bead" />
              <small>{String(i + 1).padStart(2, "0")}</small>
              {m.id === id ? (
                <Check size={14} />
              ) : m.vip ? (
                unlocked ? (
                  <Crown size={13} />
                ) : (
                  <LockKeyhole size={13} />
                )
              ) : null}
            </span>
            <strong>{m.name}</strong>
            <small>{m.finish}</small>
          </LiquidGlass>
        ))}
      </div>
      {!unlocked && <ProTeaser />}
    </>
  );
}
