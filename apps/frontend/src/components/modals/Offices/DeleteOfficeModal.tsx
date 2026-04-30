import React, { useCallback, useState } from "react";
import BaseModal from "../BaseModal";
import type { Office } from "../../../utils/types/office.type";

type DeleteOfficeModalProps = {
  open: boolean;
  office: Office | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
};

const DeleteOfficeModal: React.FC<DeleteOfficeModalProps> = ({
  open,
  office,
  onClose,
  onDelete,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (!office?.id || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDelete(office.id);
      onClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete office. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [office?.id, onDelete, onClose, submitting]);

  if (!open) return null;

  return (
    <BaseModal
      confirmModal
      confirmModalSize="sm"
      title="Delete office"
      primaryActionLabel={submitting ? "Deleting..." : "Delete"}
      primaryActionDisabled={submitting}
      onPrimaryAction={handleConfirm}
      secondaryActionLabel="Cancel"
      secondaryActionDisabled={submitting}
      onSecondaryAction={onClose}
      showCancel
    >
      <p className="text-sm text-neutral-700">
        Are you sure you want to delete <strong>{office?.name ?? "this"}</strong> office?
      </p>
      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </BaseModal>
  );
};

export default DeleteOfficeModal;
