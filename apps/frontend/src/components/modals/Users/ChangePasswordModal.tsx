/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useMemo, useState } from "react";
import BaseModal from "../BaseModal";

type ChangePasswordModalProps = {
    open: boolean;
    forceChange?: boolean;
    onClose: () => void;
    onChangePassword: (payload: {
        currentPassword: string;
        newPassword: string;
    }) => Promise<void>;
};

const passwordMinLength = 8;

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
    open,
    forceChange,
    onClose,
    onChangePassword,
}) => {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const passwordError = useMemo(() => {
        if (!newPassword) return null;
        if (newPassword.length < passwordMinLength) {
            return `Password must be at least ${passwordMinLength} characters long.`;
        }
        const hasNumber = /\d/.test(newPassword);
        const hasLetter = /[a-zA-Z]/.test(newPassword);
        if (!hasNumber || !hasLetter) {
            return "Password must contain at least one letter and one number.";
        }
        return null;
    }, [newPassword]);

    const confirmError = useMemo(() => {
        if (!newPassword || !confirmNewPassword) return null;
        if (newPassword !== confirmNewPassword) return "Passwords do not match.";
        return null;
    }, [newPassword, confirmNewPassword]);

    const isFormValid =
        !!currentPassword &&
        !!newPassword &&
        !!confirmNewPassword &&
        !passwordError &&
        !confirmError;

    const handleSubmit = useCallback(async () => {
        if (!isFormValid || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await onChangePassword({
                currentPassword,
                newPassword,
            });
            onClose();
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
        } catch (e: any) {
            setError(
                e?.message ??
                "Failed to change password. Please verify your current password and try again."
            );
        } finally {
            setSubmitting(false);
        }
    }, [
        isFormValid,
        submitting,
        onChangePassword,
        currentPassword,
        newPassword,
        onClose,
    ]);

    if (!open) return null;
    console.log(forceChange)
    return (
        <BaseModal
            title="Change password"
            primaryActionLabel={submitting ? "Saving..." : "Save password"}
            primaryActionDisabled={!isFormValid || submitting}
            onPrimaryAction={handleSubmit}
            secondaryActionLabel={!forceChange ? "Cancel" : undefined}
            secondaryActionDisabled={submitting}
            onSecondaryAction={!forceChange ? onClose : undefined}
            onHide={!forceChange ? onClose : undefined}
            disableBackdrop={forceChange}
            showCancel={!forceChange}
            className="max-w-lg"
        >
            <div className="space-y-4">
                {forceChange && <p className="text-sm text-neutral-600">
                    Please update your password to continue.
                </p>}

                <div className="space-y-1">
                    <label className="text-sm font-medium text-neutral-800">
                        Current password
                    </label>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
                        disabled={submitting}
                        autoComplete="current-password"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium text-neutral-800">
                        New password
                    </label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
                        disabled={submitting}
                        autoComplete="new-password"
                    />
                    {passwordError ? (
                        <p className="text-xs text-red-500 mt-1">{passwordError}</p>
                    ) : (
                        <p className="text-xs text-neutral-400 mt-1">
                            At least 8 characters, 1 letter and 1 number.
                        </p>
                    )}
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium text-neutral-800">
                        Confirm new password
                    </label>
                    <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
                        disabled={submitting}
                        autoComplete="new-password"
                    />
                    {confirmError && (
                        <p className="text-xs text-red-500 mt-1">{confirmError}</p>
                    )}
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}
            </div>
        </BaseModal>
    );
};

export default ChangePasswordModal;
