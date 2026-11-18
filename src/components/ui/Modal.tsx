"use client";

import { AlertTriangle, X } from "lucide-react";
import { useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPopup } from "@/components/fx/useAnchoredPopup";

const FOCUSABLE =
  ':is(a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]):not([tabindex="-1"])';

const subscribeMounted = () => () => {};
const isClient = () => true;
const isServer = () => false;

export function Modal({
  open,
  onClose,
  title,
  description,
  maxWidth = "max-w-xl",
  variant,
  id,
  returnFocus,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  maxWidth?: string;
  variant?: "profile";
  id?: string;
  returnFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const mounted = useSyncExternalStore(subscribeMounted, isClient, isServer);
  const active = mounted && open;
  const isProfile = variant === "profile";
  const { present, panelRef } = useAnchoredPopup<HTMLDivElement>(active, isProfile ? returnFocus : undefined);
  const titleId = useId();
  const descId = useId();
  const backdropRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!active || !panel || !backdrop) return;
    const previous = returnFocus?.current ?? document.activeElement;
    panel.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing ||
        Array.from(document.querySelectorAll("[data-rf-modal][data-open]")).at(-1) !== backdrop) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === "Tab") {
        const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => {
          const closed = node.closest("details:not([open])");
          return node.getClientRects().length && (!closed || (node.tagName === "SUMMARY" && node.parentElement === closed));
        });
        const first = nodes[0];
        const last = nodes.at(-1);
        if (!first || !last) return;
        const outside = !panel.contains(document.activeElement);
        if (event.shiftKey && (outside || document.activeElement === first)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (outside || document.activeElement === last)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active, returnFocus, panelRef]);

  if (!present) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className={`modal-backdrop${isProfile ? " profile-backdrop" : ""}`}
      data-rf-modal=""
      data-open={open ? "" : undefined}
      inert={!open}
      aria-hidden={!open || undefined}
      onClick={(event) => {
        // A portaled listbox bubbles through React but is not part of this backdrop.
        const target = event.target;
        if (target instanceof Node && event.currentTarget.contains(target) && !panelRef.current?.contains(target)) onClose();
      }}
    >
      <div className={`w-full min-w-0 ${maxWidth}`}>
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-modal={open || undefined}
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          data-open={open ? "" : undefined}
          className={`modal-panel overflow-y-auto ${isProfile && returnFocus ? "rf-anchored-popup" : "rf-popup-motion"} ${isProfile ? "profile-panel p-4" : "max-h-[calc(100dvh-2rem)] p-5 sm:p-7"}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className={`${isProfile ? "profile-heading" : "text-xl"} font-bold leading-snug tracking-tight text-ink`}>
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
      </div>
    </div>,
    document.body,
  );
}

/** Диалог подтверждения опасных или необратимых действий. */
export function ConfirmDialog({
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
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="well flex items-start gap-3 p-4">
        <AlertTriangle
          className={`mt-0.5 h-5 w-5 flex-none ${danger ? "text-danger" : "text-warn"}`}
          aria-hidden="true"
        />
        <p className="text-sm leading-relaxed text-ink-2">{description}</p>
      </div>
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
