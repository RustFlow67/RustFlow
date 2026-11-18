"use client";

import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { useAccount } from "./AccountProvider";

export const OPEN_PROFILE_EVENT = "rustflow:open-profile";
export const PROFILE_DIALOG_ID = "rustflow-player-profile";

export function openPlayerProfile(opener: HTMLElement) {
  window.dispatchEvent(new CustomEvent<HTMLElement>(OPEN_PROFILE_EVENT, { detail: opener }));
}

export function ProfileLock({ action, className = "" }: {
  action: string; className?: string;
}) {
  return <button type="button" className={`btn liquid-glass-btn profile-lock ${className}`} aria-haspopup="dialog"
    onClick={(event) => openPlayerProfile(event.currentTarget)}>
    <LockKeyhole aria-hidden="true" />
    <span><strong>{action}</strong><span>Доступно после входа в профиль</span></span>
  </button>;
}

export default function ProfileGate({ action, className, children }: {
  action: string; className?: string; children: ReactNode;
}) {
  const { session } = useAccount();
  return session?.user ? children : <ProfileLock action={action} className={className} />;
}
