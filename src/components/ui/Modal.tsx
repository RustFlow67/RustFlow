"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { AlertTriangle, X } from "lucide-react";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { usePopupMotion, type PopupOrigin } from "@/components/fx/usePopupMotion";
import type { PopupSource } from "../fx/popupGeometry";
import { useHeaderAnchor } from "../fx/useHeaderAnchor";
import { dialogControls, guardKeys } from "../fx/dialogKeys";

const subscribeMounted = () => () => {};
const isClient = () => true;
const isServer = () => false;

type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Controlled exits keep the owner's open flag true until onExited. */
  closing?: boolean;
  onExited?: () => void;
  title: string;
  description?: string;
  maxWidth?: string;
  variant?: "profile" | "studio" | "brand";
  source?: RefObject<PopupSource>;
  id?: string;
  anchor?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

export function Modal({ open, ...props }: ModalProps) {
  const mounted = useSyncExternalStore(subscribeMounted, isClient, isServer);
  // Legacy callers close by setting open=false directly (save, confirm,
  // cancel). Retain their surface, too, until the same inert exit completes.
  const [retained, retain] = useState(open);
  if (open && !retained) retain(true);
  return retained && mounted ? (
    <OpenModal
      {...props}
      closing={!open || props.closing}
      onExited={() => {
        retain(false);
        props.onExited?.();
      }}
    />
  ) : null;
}

function OpenModal({
  onClose,
  closing,
  onExited,
  title,
  description,
  maxWidth = "max-w-xl",
  variant,
  id,
  anchor,
  source,
  returnFocus,
  initialFocus,
  children,
}: Omit<ModalProps, "open"> & { onExited: () => void }) {
  const isProfile = variant === "profile";
  const active = !closing;
  const backdropRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const edge = isProfile ? "right" : "left";
  useHeaderAnchor(anchor, slotRef, edge, active, source);
  const panelRef = usePopupMotion<HTMLDivElement>(true, !active, onExited, source, anchor);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!active || !panel || !backdrop) return;
    const previous = returnFocus?.current ?? document.activeElement;
    (initialFocus?.current ?? dialogControls(panel)[0])?.focus({ preventScroll: true });
    const releaseKeys = guardKeys(panel, () => onCloseRef.current());
    return () => {
      releaseKeys();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active, returnFocus, initialFocus, panelRef]);

  return createPortal(
    <div
      ref={backdropRef}
      className={`modal-backdrop${anchor ? " header-backdrop" : ""}${variant ? ` ${variant}-backdrop` : ""}`}
      data-rf-modal=""
      data-open={active ? "" : undefined}
      inert={!active}
      aria-hidden={!active || undefined}
      onClick={(event) => {
        // A portaled listbox bubbles through React but is not part of this backdrop.
        const target = event.target;
        if (
          target instanceof Node &&
          event.currentTarget.contains(target) &&
          !panelRef.current?.contains(target)
        )
          onClose();
      }}
    >
      <div ref={slotRef} data-header-slot={anchor ? edge : undefined} className={`relative w-full min-w-0 ${maxWidth}`}>
        <LiquidGlass
          ref={panelRef}
          id={id}
          role="dialog"
          aria-modal={active || undefined}
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          data-open={active ? "" : undefined}
          className={`modal-panel rf-dialog-surface ${variant ? `${variant}-panel` : "max-h-[calc(100dvh-2rem)]"}`}
        >
          <div className={`dialog-scroll ${variant ? "p-4" : "p-5 sm:p-7"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className={`${isProfile ? "profile-heading" : "text-xl"} font-bold leading-snug tracking-tight text-ink`}
                >
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1.5 text-sm leading-relaxed text-ink-2">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn btn-icon !h-9 !w-9 flex-none"
                onClick={onClose}
                aria-label="Закрыть окно"
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className={isProfile ? "mt-3" : "mt-5"}>{children}</div>
          </div>
        </LiquidGlass>
      </div>
    </div>,
    document.body,
  );
}

/** Диалог подтверждения опасных или необратимых действий. */
export function ConfirmDialog({
  source, returnFocus,
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
} & PopupOrigin) {
  return (
    <Modal source={source} returnFocus={returnFocus} open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <LiquidGlass className="well flex items-start gap-3 p-4">
        <AlertTriangle
          className={`mt-0.5 h-5 w-5 flex-none ${danger ? "text-danger" : "text-warn"}`}
          aria-hidden="true"
        />
        <p className="text-sm leading-relaxed text-ink-2">{description}</p>
      </LiquidGlass>
      <div className="mt-5 flex flex-wrap justify-end gap-2.5">
        <button type="button" className="btn btn-sm" onClick={onClose}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
