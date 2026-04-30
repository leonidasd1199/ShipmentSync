/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState } from "react";
import BaseModal from "../BaseModal";
import type { QuotationResponse } from "../../../utils/types/quotation.type";

type AcceptQuotationModalProps = {
    open: boolean;
    quotation: QuotationResponse | null;
    onClose: () => void;
    onAccept: (id: string) => Promise<void>;
};

const AcceptQuotationModal: React.FC<AcceptQuotationModalProps> = ({
    open,
    quotation,
    onClose,
    onAccept,
}) => {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = useCallback(async () => {
        const id = (quotation as any)?.id ?? (quotation as any)?._id;
        if (!id || submitting) return;

        setSubmitting(true);
        setError(null);

        try {
            await onAccept(String(id));
            onClose();
        } catch (e: any) {
            setError(e?.message ?? "Failed to accept estimate. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }, [quotation, onAccept, onClose, submitting]);

    if (!open) return null;

    return (
        <BaseModal
            confirmModal
            confirmModalSize="sm"
            title="Accept quotation"
            primaryActionLabel={submitting ? "Accepting..." : "Accept"}
            primaryActionDisabled={submitting}
            onPrimaryAction={handleConfirm}
            secondaryActionLabel="Cancel"
            secondaryActionDisabled={submitting}
            onSecondaryAction={onClose}
            showCancel
        >
            <p className="text-sm text-neutral-700">
                Are you sure you want to accept this estimate?
            </p>

            <p className="mt-2 text-sm text-neutral-600">
                <strong>This action is final.</strong> Once a estimate is accepted,
                it cannot be reverted or modified.
            </p>

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Please make sure all details are correct before proceeding.
            </div>

            {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}
        </BaseModal>
    );
};

export default AcceptQuotationModal;
