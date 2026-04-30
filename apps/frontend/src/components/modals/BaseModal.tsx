import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import classNames from "classnames";
import ConfirmationModal from "./ConfirmationModal";

type Size = "sm" | "md" | "lg" | "xl";

export interface BaseModalProps {
    className?: string;
    noHeader?: boolean;
    floatingClose?: boolean;
    confirmModal?: boolean;
    title?: React.ReactNode;
    titleIcon?: React.ReactNode;
    primaryActionLabel?: React.ReactNode;
    primaryActionDisabled?: boolean;
    onPrimaryAction?: () => void;
    secondaryActionLabel?: React.ReactNode;
    secondaryActionDisabled?: boolean;
    onSecondaryAction?: () => void;
    onHide?: () => void;
    children?: React.ReactNode;
    hideModalFooter?: boolean;
    disableBackdrop?: boolean;
    showCancel?: boolean;
    confirmModalSize?: Size;
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

const Backdrop: React.FC<{ disableBackdrop?: boolean; onClick?: () => void }> = ({
    disableBackdrop,
    onClick,
}) => (
    <div
        className="fixed inset-0 z-[100] bg-black/50"
        onClick={disableBackdrop ? undefined : onClick}
    />
);

const Dialog = React.forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(
    ({ children, className }, ref) => (
        <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
        >
            <div
                className={classNames(
                    "w-full rounded-xl bg-white shadow-2xl outline-none text-neutral-900",
                    "max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-3xl",
                    "max-h-[90vh] flex flex-col",
                    className
                )}
            >
                {children}
            </div>
        </div>
    )
);
Dialog.displayName = "Dialog";

const BaseModal: React.FC<BaseModalProps> = ({
    className,
    noHeader,
    floatingClose,
    confirmModal,
    title,
    titleIcon,
    primaryActionLabel,
    primaryActionDisabled,
    onPrimaryAction,
    secondaryActionLabel,
    secondaryActionDisabled,
    onSecondaryAction,
    onHide,
    children,
    hideModalFooter,
    disableBackdrop = false,
    showCancel = true,
    confirmModalSize,
}) => {
    const portalRoot = ensurePortalRoot();
    const dialogRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape" && onHide && !disableBackdrop) onHide();
        },
        [onHide, disableBackdrop]
    );
    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        dialogRef.current?.focus?.();
    }, []);

    if (confirmModal === true) {
        return createPortal(
            <ConfirmationModal
                className={className}
                title={title}
                confirmLabel={primaryActionLabel}
                onConfirm={onPrimaryAction}
                cancelLabel={secondaryActionLabel}
                onCancel={onSecondaryAction}
                showCancel={showCancel}
                size={confirmModalSize}
            >
                {children}
            </ConfirmationModal>,
            portalRoot
        );
    }

    return createPortal(
        <>
            <Backdrop disableBackdrop={disableBackdrop} onClick={onHide} />
            <Dialog
                className={classNames(
                    noHeader ? "relative p-0" : "px-6 py-4",
                    className
                )}
                ref={dialogRef}
            >
                {!noHeader && (
                    <div className="flex shrink-0 items-start justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            {titleIcon}
                            {typeof title === "string" ? (
                                <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
                            ) : (
                                <div className="min-w-0 flex-1">{title}</div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onHide}
                            aria-label="Close"
                            className={classNames(
                                "ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                                "bg-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
                                "focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                            )}
                        >
                            <span className="text-2xl font-light leading-none">&times;</span>
                        </button>
                    </div>
                )}

                {noHeader && floatingClose && onHide && (
                    <button
                        type="button"
                        onClick={disableBackdrop ? undefined : onHide}
                        disabled={disableBackdrop}
                        aria-label="Close"
                        className={classNames(
                            "absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full",
                            "border border-neutral-200 bg-white text-neutral-600 shadow-sm",
                            "hover:bg-neutral-50 hover:text-neutral-900",
                            "focus:outline-none focus:ring-2 focus:ring-neutral-300/50",
                            "disabled:pointer-events-none disabled:opacity-40"
                        )}
                    >
                        <span className="text-xl font-light leading-none">&times;</span>
                    </button>
                )}

                <div
                    className={classNames(
                        noHeader ? "mt-0 flex min-h-0 flex-1 flex-col overflow-hidden" : "mt-4 flex-1 overflow-y-auto"
                    )}
                >
                    {children}
                </div>

                {/* Footer (fixed) */}
                {!hideModalFooter && (
                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end shrink-0">
                        {showCancel && (
                            <button
                                type="button"
                                className={classNames(
                                    "inline-flex shrink-0 items-center justify-center",
                                    "h-11 min-w-[160px] px-5",
                                    "rounded-[30px] border",
                                    "text-base font-semibold",
                                    "border-neutral-300 bg-white text-neutral-800",
                                    "hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500/50",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                                disabled={secondaryActionDisabled}
                                onClick={onSecondaryAction}
                            >
                                {secondaryActionLabel}
                            </button>
                        )}
                        <button
                            type="button"
                            className={classNames(
                                "inline-flex shrink-0 items-center justify-center",
                                "h-11 min-w-[160px] px-5",
                                "rounded-[30px] border",
                                "text-base font-semibold",
                                "border-[#00C2C7] bg-white text-black",
                                "hover:bg-[#00C2C7]/10 focus:outline-none focus:ring-2 focus:ring-[#00C2C7]/40",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "sm:ml-3"
                            )}
                            disabled={primaryActionDisabled}
                            onClick={onPrimaryAction}
                        >
                            {primaryActionLabel}
                        </button>
                    </div>
                )}
            </Dialog>
        </>,
        portalRoot
    );
};

export default BaseModal;
