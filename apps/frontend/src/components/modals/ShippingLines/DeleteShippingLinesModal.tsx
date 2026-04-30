/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState } from "react";
import BaseModal from "../BaseModal";
import type { ShippingLine } from "../../../utils/types/shipping.type";

type DeleteShippingModalProps = {
  open: boolean;
  shipping: ShippingLine | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
};

const DeleteShippingLinesModal: React.FC<DeleteShippingModalProps> = ({
  open,
  shipping,
  onClose,
  onDelete,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (!shipping?._id || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDelete(shipping._id);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete shipping line. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [shipping?._id, onDelete, onClose, submitting]);

  if (!open) return null;

  return (
    <BaseModal
      confirmModal
      confirmModalSize="sm"
      title="Delete Shipping Line"
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
        <strong>{shipping?.name ?? "this"}</strong> shipping line?
      </p>
      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </BaseModal>
  );
};

export default DeleteShippingLinesModal;
