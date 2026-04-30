/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState } from "react";
import BaseModal from "../BaseModal";
import type { OfficeUser } from "../../../utils/types/office.type";
import { useOffices } from "../../../hooks/useOffice";

type DisableUserFromOfficeModalProps = {
  open: boolean;
  officeId: string | undefined;
  user: OfficeUser | null;                 
  onClose: () => void;
  onRemoved?: (userId: string) => void;
};

const DisableUserFromOfficeModal: React.FC<DisableUserFromOfficeModalProps> = ({
  open,
  officeId,
  user,
  onClose,
  onRemoved,
}) => {
  const { removeUsers } = useOffices({ autoload: false });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    // eslint-disable-next-line no-debugger
    debugger;
    if (!open || !officeId || !user?._id || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await removeUsers(officeId, user._id);
      onRemoved?.(user._id);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to remove the user from this office. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [open, officeId, user?._id, removeUsers, onRemoved, onClose, submitting]);

  if (!open) return null;

  return (
    <BaseModal
      confirmModal
      confirmModalSize="sm"
      title="Remove from office"
      primaryActionLabel={submitting ? "Removing..." : "Remove"}
      primaryActionDisabled={submitting}
      onPrimaryAction={handleConfirm}
      secondaryActionLabel="Cancel"
      secondaryActionDisabled={submitting}
      onSecondaryAction={onClose}
      showCancel
    >
      <p className="text-sm text-neutral-700">
        Are you sure you want to disable
        <strong> {user?.name || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || user?.email || "this user"}</strong>{" "}
        from this office?
        <br />
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </BaseModal>
  );
};

export default DisableUserFromOfficeModal;
