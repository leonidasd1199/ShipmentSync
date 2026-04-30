import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import classNames from "classnames";

type Size = "sm" | "md" | "lg" | "xl";

export interface ConfirmationModalProps {
  showCancel?: boolean;
  size?: Size;
  onCancel?: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  onConfirm?: () => void;
  confirmLabel?: React.ReactNode;
  className?: string;
  reverseButtons?: boolean;
}

const ensurePortalRoot = () => {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
};

const Backdrop: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <div className="fixed inset-0 z-[100] bg-black/50" onClick={onClick} />
);

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  showCancel = true,
  size = "md",
  onCancel,
  title = "Confirm",
  children,
  cancelLabel = "Cancel",
  onConfirm,
  confirmLabel = "Confirm",
  className,
  reverseButtons = false,
}) => {
  const portalRoot = ensurePortalRoot();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel?.();
    },
    [onCancel]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    panelRef.current?.focus?.();
  }, []);

  const maxWidth =
    {
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-2xl",
      xl: "max-w-3xl",
    }[size] ?? "max-w-md";

  const CancelBtn = (
    <button
      type="button"
      onClick={onCancel}
      className={classNames(
        "inline-flex items-center justify-center",
        "h-10 min-w-[120px] rounded-[30px] border",
        "border-neutral-300 bg-white text-neutral-700 font-semibold text-sm",
        "hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300/50",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      {cancelLabel}
    </button>
  );

  return createPortal(
    <>
      <Backdrop onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className={classNames(
            "w-full rounded-xl bg-white p-6 shadow-2xl outline-none",
            "text-neutral-900",
            maxWidth,
            className
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className={classNames(
                "flex h-8 w-8 items-center justify-center rounded-full",
                "bg-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
                "focus:outline-none focus:ring-2 focus:ring-neutral-300/40"
              )}
            >
              <span className="text-xl leading-none font-light">&times;</span>
            </button>
          </div>

          <div className="py-2">{children}</div>

          <div className="mt-6 flex justify-end gap-3">
            {showCancel && !reverseButtons && CancelBtn}
            <button
              type="button"
              onClick={onConfirm}
              className={classNames(
                "inline-flex items-center justify-center",
                "h-10 min-w-[120px] rounded-[30px] border",
                "border-black bg-white text-black font-semibold text-sm",
                "hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-black/30",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {confirmLabel}
            </button>
            {showCancel && reverseButtons && CancelBtn}
          </div>
        </div>
      </div>
    </>,
    portalRoot
  );
};

export default ConfirmationModal;
