/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import BaseModal from "../BaseModal";
import type { OfficeUser } from "../../../utils/types/office.type";
import type { AssignNewUserDto, UpdateUserDto } from "../../../utils/types/user.type";

type Mode = "create" | "edit";

type CreateEditUserModalProps = {
  open: boolean;
  onClose: () => void;
  mode?: Mode;
  officeId?: string;
  user?: OfficeUser | null;
  assignNewUser?: (officeId: string, user: AssignNewUserDto) => Promise<any>;
  updateUser?: (userId: string, payload: UpdateUserDto) => Promise<any>;
  onSaved?: (user?: OfficeUser | void) => void;
  className?: string;
};

const PHONE_REGEX = /^[+\d()\s-]*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CreateEditUserModal: React.FC<CreateEditUserModalProps> = ({
  open,
  onClose,
  mode = "create",
  officeId,
  user = null,
  assignNewUser = async () => {},
  updateUser = async () => {},
  onSaved,
  className,
}) => {
  const isEdit = mode === "edit";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const original = useMemo(
    () => ({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
    }),
  
    [user?._id, open]
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (isEdit && user) {
        setFirstName(user.firstName ?? "");
        setLastName(user.lastName ?? "");
        setEmail(user.email ?? "");
        setPhone(user.phone ?? "");
      } else {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
      }
      setError(null);
      setSubmitting(false);
    }
  }, [isEdit, user, open]);

  const handlePhoneChange = (val: string) => {
    if (PHONE_REGEX.test(val)) setPhone(val);
  };

  const canSubmitCreate =
    !isEdit &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    EMAIL_REGEX.test(email.trim()) &&
    !submitting;

  const dirtyDiff = useMemo(() => {
    if (!isEdit) return {};
    const diff: UpdateUserDto = {} as any;

    if (firstName.trim() !== original.firstName) diff.firstName = firstName.trim();
    if (lastName.trim() !== original.lastName) diff.lastName = lastName.trim();
    if (email.trim() !== original.email) diff.email = email.trim();
    if ((phone ?? "").trim() !== (original.phone ?? "")) {
      diff.phone = phone.trim() || undefined;
    }

    return diff;
  }, [isEdit, firstName, lastName, email, phone, original]);

  const isDirty = useMemo(() => Object.keys(dirtyDiff).length > 0, [dirtyDiff]);

  const emailValidForEdit = useMemo(() => {
    if (!isEdit) return true;
    if ("email" in dirtyDiff) {
      return EMAIL_REGEX.test((dirtyDiff.email as any ?? "").trim());
    }
    return true;
  }, [isEdit, dirtyDiff]);

  const canSubmitEdit = isEdit && isDirty && emailValidForEdit && !submitting;

  const handlePrimary = useCallback(async () => {
    if (isEdit) {
      if (!user?._id || !canSubmitEdit) return;
      setSubmitting(true);
      setError(null);
      try {
        await updateUser(String(user._id), dirtyDiff as any);
        onSaved?.();
        onClose();
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Update failed. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // CREATE MODE
    if (!canSubmitCreate || !officeId) return;
    setSubmitting(true);
    setError(null);
    try {
      const dto = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      };
      const created = await assignNewUser(officeId, dto as any);
      onSaved?.(created);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Operation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    isEdit,
    user?._id,
    canSubmitEdit,
    updateUser,
    dirtyDiff,
    onSaved,
    onClose,
    canSubmitCreate,
    officeId,
    assignNewUser,
    firstName,
    lastName,
    email,
    phone,
  ]);

  if (!open) return null;

  const inputBase =
    "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300";

  return (
    <BaseModal
      className={classNames("px-6 py-5", className)}
      title={isEdit ? "Edit User" : "Add User"}
      primaryActionLabel={
        submitting ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save" : "Create"
      }
      primaryActionDisabled={isEdit ? !canSubmitEdit : !canSubmitCreate}
      onPrimaryAction={handlePrimary}
      secondaryActionLabel="Cancel"
      secondaryActionDisabled={submitting}
      onSecondaryAction={onClose}
      onHide={onClose}
      hideModalFooter={false}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handlePrimary();
        }}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-800">
            First Name <span className="text-red-600">*</span>
          </label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="John"
            maxLength={50}
            className={inputBase}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-800">
            Last Name <span className="text-red-600">*</span>
          </label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Doe"
            maxLength={50}
            className={inputBase}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-800">
            Email <span className="text-red-600">*</span>
          </label>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            maxLength={120}
            className={inputBase}
            pattern={EMAIL_REGEX.source}
            title="Enter a valid email (e.g. name@domain.com)"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-800">Phone</label>
          <input
            type="tel"
            inputMode="tel"
            pattern="[+\\d()\\s-]*"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="+1 (555) 555-5555"
            maxLength={30}
            className={inputBase}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </BaseModal>
  );
};

export default CreateEditUserModal;
