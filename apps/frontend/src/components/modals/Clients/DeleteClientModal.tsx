/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState } from "react";
import BaseModal from "../BaseModal";
import type { Client } from "../../../utils/types/client.type";

type DeleteClientModalProps = {
    open: boolean;
    client: Client | null;
    onClose: () => void;
    onDelete: (id: string) => Promise<void>;
};

const DeleteClientModal: React.FC<DeleteClientModalProps> = ({
    open,
    client,
    onClose,
    onDelete,
}) => {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = useCallback(async () => {
        if (!client?.id || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await onDelete(client.id);
            onClose();
        } catch (e: any) {
            setError(e?.message ?? "Failed to delete client. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }, [client?.id, onDelete, onClose, submitting]);

    if (!open) return null;

    return (
        <BaseModal
            confirmModal
            confirmModalSize="sm"
            title="Delete client"
            primaryActionLabel={submitting ? "Deleting..." : "Delete"}
            primaryActionDisabled={submitting}
            onPrimaryAction={handleConfirm}
            secondaryActionLabel="Cancel"
            secondaryActionDisabled={submitting}
            onSecondaryAction={onClose}
            showCancel
        >
            <p className="text-sm text-neutral-700">
                Are you sure you want to delete{" "}
                <strong>{client?.name ?? "this"}</strong> client?
            </p>
            {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}
        </BaseModal>
    );
};

export default DeleteClientModal;
