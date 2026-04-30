/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useCallback } from "react";
import classNames from "classnames";
import BaseModal from "../BaseModal";
import type {
  ShippingLine,
  CreateShippingDto,
  UpdateShippingDto,
} from "../../../utils/types/shipping.type";
import { ShippingModeEnum } from "../../../utils/constants";

type Mode = "create" | "edit";

type CreateEditShippingModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (shipping?: ShippingLine | void) => void;
  mode?: Mode;
  shipping?: ShippingLine | null;
  createShipping?: (dto: CreateShippingDto) => Promise<ShippingLine>;
  updateShipping?: (id: string, dto: UpdateShippingDto) => Promise<ShippingLine>;
  className?: string;
};

const PHONE_REGEX = /^[+\d()\s-]*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CreateEditShippingModal: React.FC<CreateEditShippingModalProps> = ({
  open,
  onClose,
  onSaved,
  mode = "create",
  shipping = null,
  createShipping = async () => {
    throw new Error("createShipping not provided");
  },
  updateShipping = async () => {
    throw new Error("updateShipping not provided");
  },
  className,
}) => {
  const isEdit = mode === "edit";

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");

  const [shippingModes, setShippingModes] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && isEdit && shipping) {
      setName(shipping.name ?? "");
      setLegalName(shipping.legalName ?? "");
      setEmail(shipping.email ?? "");
      setPhone(shipping.phone ?? "");
      setWebsite(shipping.website ?? "");
      setNotes(shipping.notes ?? "");
      setShippingModes(shipping.shippingModes ?? []);
      setError(null);
      setSubmitting(false);
    }

    if (open && !isEdit) {
      setName("");
      setLegalName("");
      setEmail("");
      setPhone("");
      setWebsite("");
      setNotes("");
      setShippingModes([]);
      setError(null);
      setSubmitting(false);
    }
  }, [open, isEdit, shipping]);

  const handlePhoneChange = (val: string) => {
    if (PHONE_REGEX.test(val)) setPhone(val);
  };

  const emailValid =
    email.trim().length === 0 || EMAIL_REGEX.test(email.trim());

  const hasAtLeastOneMode = shippingModes.length > 0;

  const canSubmitCreate =
    !isEdit &&
    name.trim().length > 0 &&
    emailValid &&
    hasAtLeastOneMode &&
    !submitting;

  const canSubmitEdit =
    isEdit &&
    name.trim().length > 0 &&
    emailValid &&
    hasAtLeastOneMode &&
    !submitting;

  const canSubmit = isEdit ? canSubmitEdit : canSubmitCreate;

  const inputBase =
    "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300";

  const handlePrimary = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && shipping?._id) {
        const dto: UpdateShippingDto = {
          name: name.trim(),
          legalName: legalName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
          notes: notes.trim() || undefined,
          shippingModes,
        };

        const updated = await updateShipping(shipping._id, dto);
        onSaved?.(updated);
      } else {
        const dto: CreateShippingDto = {
          name: name.trim(),
          legalName: legalName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
          notes: notes.trim() || undefined,
          shippingModes,
        };

        const created = await createShipping(dto);
        onSaved?.(created);
      }

      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Operation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    isEdit,
    shipping?._id,
    name,
    legalName,
    email,
    phone,
    website,
    notes,
    shippingModes,
    updateShipping,
    createShipping,
    onSaved,
    onClose,
  ]);

  if (!open) return null;

  return (
    <BaseModal
      className={classNames("px-6 py-5", className)}
      title={isEdit ? "Edit Supplier" : "Create Supplier"}
      primaryActionLabel={
        submitting
          ? isEdit
            ? "Saving..."
            : "Creating..."
          : isEdit
            ? "Save"
            : "Create"
      }
      primaryActionDisabled={!canSubmit}
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
            Name <span className="text-red-600">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className={inputBase}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-800">
            Legal name
          </label>
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            maxLength={140}
            className={inputBase}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputBase}
            placeholder="Email"
          />
          <input
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className={inputBase}
            placeholder="Phone"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-800">
            Shipping Modes <span className="text-red-600">*</span>
          </label>

          <div className="flex flex-wrap gap-2">
            {Object.values(ShippingModeEnum).map((mode) => {
              const selected = shippingModes.includes(mode);

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    if (selected) {
                      setShippingModes((prev) => prev.filter((m) => m !== mode));
                    } else {
                      setShippingModes((prev) => [...prev, mode]);
                    }
                  }}
                  className={classNames(
                    "px-3 py-1.5 rounded-md border text-sm font-medium transition-all outline-none focus:outline-none focus-visible:outline-none",
                    selected
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                  )}
                >
                  {mode.toUpperCase()}
                </button>
              );
            })}
          </div>

          {!hasAtLeastOneMode && (
            <p className="mt-1 text-xs text-red-600">
              Select at least one shipping mode
            </p>
          )}
        </div>

        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className={inputBase}
          placeholder="Website"
        />

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={600}
          className={classNames(inputBase, "min-h-[96px]")}
          placeholder="Notes"
        />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </BaseModal>
  );
};

export default CreateEditShippingModal;
