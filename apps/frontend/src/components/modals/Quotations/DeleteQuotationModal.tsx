/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState } from "react";
import BaseModal from "../BaseModal";
import type { QuotationResponse } from "../../../utils/types/quotation.type";

type DeleteQuotationModalProps = {
  open: boolean;
  quotation: QuotationResponse | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
};

const DeleteQuotationModal: React.FC<DeleteQuotationModalProps> = ({
  open,
  quotation,
  onClose,
  onDelete,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    const id = (quotation as any)?.id ?? (quotation as any)?._id;
    if (!id || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await onDelete(String(id));
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete quotation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [quotation, onDelete, onClose, submitting]);

  if (!open) return null;

  return (
    <BaseModal
      confirmModal
      confirmModalSize="sm"
      title="Delete quotation"
      primaryActionLabel={submitting ? "Deleting..." : "Delete"}
      primaryActionDisabled={submitting}
      onPrimaryAction={handleConfirm}
      secondaryActionLabel="Cancel"
      secondaryActionDisabled={submitting}
      onSecondaryAction={onClose}
      showCancel
    >
      <p className="text-sm text-neutral-700">
        Are you sure you want to delete this quotation?
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </BaseModal>
  );
};

export default DeleteQuotationModal;
