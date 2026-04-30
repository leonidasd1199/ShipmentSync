/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState } from "react";
import BaseModal from "../BaseModal";
import type { Agent } from "../../../utils/types/agent.type";

type DeleteAgentModalProps = {
    open: boolean;
    agent: Agent | null;
    onClose: () => void;
    onDelete: (id: string) => Promise<void>;
};

const DeleteAgentModal: React.FC<DeleteAgentModalProps> = ({
    open,
    agent,
    onClose,
    onDelete,
}) => {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const agentId = (agent?.id ?? (agent as any)?._id) as string | undefined;
    const agentName = [agent?.firstName, agent?.lastName].filter(Boolean).join(" ").trim() || "this agent";

    const handleConfirm = useCallback(async () => {
        if (!agentId || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await onDelete(agentId);
            onClose();
        } catch (e: any) {
            setError(e?.message ?? "Failed to delete agent. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }, [agentId, onDelete, onClose, submitting]);

    if (!open) return null;

    return (
        <BaseModal
            confirmModal
            confirmModalSize="sm"
            title="Delete Agent"
            primaryActionLabel={submitting ? "Deleting..." : "Delete"}
            primaryActionDisabled={submitting}
            onPrimaryAction={handleConfirm}
            secondaryActionLabel="Cancel"
            secondaryActionDisabled={submitting}
            onSecondaryAction={onClose}
            showCancel
        >
            <p className="text-sm text-neutral-700">
                Are you sure you want to delete <strong>{agentName}</strong>?
            </p>
            {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}
        </BaseModal>
    );
};

export default DeleteAgentModal;
