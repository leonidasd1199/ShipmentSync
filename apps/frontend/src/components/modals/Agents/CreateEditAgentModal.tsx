/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import BaseModal from "../BaseModal";
import type { Agent, CreateAgentDto, UpdateAgentDto } from "../../../utils/types/agent.type";

type Mode = "create" | "edit";

type CreateEditAgentModalProps = {
  open: boolean;
  onClose: () => void;
  mode?: Mode;
  shippingLineId?: string;
  agent?: Agent | null;
  createAgent?: (dto: CreateAgentDto) => Promise<Agent>;
  updateAgent?: (agentId: string, dto: UpdateAgentDto) => Promise<Agent>;
  onSaved?: (agent?: Agent | void) => void;
  className?: string;
};

const PHONE_REGEX = /^[+\d()\s-]*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CreateEditAgentModal: React.FC<CreateEditAgentModalProps> = ({
  open,
  onClose,
  mode = "create",
  shippingLineId,
  agent = null,
  createAgent = async () => {
    return {} as Agent;
  },
  updateAgent = async () => {
    return {} as Agent;
  },
  onSaved,
  className,
}) => {
  const isEdit = mode === "edit";

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

  const [whatsapp, setWhatsapp] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [street, setStreet] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [state, setStateVal] = useState<string>("");
  const [zip, setZip] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const original = useMemo(
    () => ({
      firstName: agent?.firstName ?? "",
      lastName: agent?.lastName ?? "",
      email: agent?.email ?? "",
      phone: agent?.phone ?? "",
      whatsapp: agent?.whatsapp ?? "",
      notes: agent?.notes ?? "",
      address: {
        street: agent?.address?.street ?? "",
        city: agent?.address?.city ?? "",
        country: agent?.address?.country ?? "",
        state: agent?.address?.state ?? "",
        zip: agent?.address?.zip ?? "",
      },
    }),
    [agent?.id, open]
  );

  // load/clear values when opening
  useEffect(() => {
    if (!open) return;

    setError(null);
    setSubmitting(false);

    if (isEdit && agent) {
      setFirstName(agent.firstName ?? "");
      setLastName(agent.lastName ?? "");
      setEmail(agent.email ?? "");
      setPhone(agent.phone ?? "");
      setWhatsapp(agent.whatsapp ?? "");
      setNotes(agent.notes ?? "");

      setStreet(agent.address?.street ?? "");
      setCity(agent.address?.city ?? "");
      setCountry(agent.address?.country ?? "");
      setStateVal(agent.address?.state ?? "");
      setZip(agent.address?.zip ?? "");
    } else {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setWhatsapp("");
      setNotes("");

      setStreet("");
      setCity("");
      setCountry("");
      setStateVal("");
      setZip("");
    }
  }, [isEdit, agent, open]);

  // validations
  const handlePhoneChange = (val: string) => {
    if (PHONE_REGEX.test(val)) setPhone(val);
  };
  const handleWhatsappChange = (val: string) => {
    if (PHONE_REGEX.test(val)) setWhatsapp(val);
  };

  const createRequiredOk =
    !isEdit &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    EMAIL_REGEX.test(email.trim()) &&
    street.trim().length > 0 &&
    city.trim().length > 0 &&
    country.trim().length > 0 &&
    !submitting;

  const dirtyDiff = useMemo(() => {
    if (!isEdit) return {};
    const diff: UpdateAgentDto = {};

    if (firstName.trim() !== original.firstName) diff.firstName = firstName.trim();
    if (lastName.trim() !== original.lastName) diff.lastName = lastName.trim();

    if (email.trim() !== original.email) diff.email = email.trim();

    if ((phone ?? "").trim() !== (original.phone ?? "")) {
      diff.phone = phone.trim() || undefined;
    }
    if ((whatsapp ?? "").trim() !== (original.whatsapp ?? "")) {
      diff.whatsapp = whatsapp.trim() || undefined;
    }
    if ((notes ?? "").trim() !== (original.notes ?? "")) {
      diff.notes = notes.trim() || undefined;
    }

    const addrPartial: NonNullable<UpdateAgentDto["address"]> = {};
    if (street.trim() !== original.address.street) addrPartial.street = street.trim();
    if (city.trim() !== original.address.city) addrPartial.city = city.trim();
    if (country.trim() !== original.address.country) addrPartial.country = country.trim();
    if ((state ?? "").trim() !== (original.address.state ?? "")) addrPartial.state = state.trim() || undefined;
    if ((zip ?? "").trim() !== (original.address.zip ?? "")) addrPartial.zip = zip.trim() || undefined;

    if (Object.keys(addrPartial).length > 0) {
      diff.address = addrPartial;
    }

    return diff;
  }, [
    isEdit,
    firstName,
    lastName,
    email,
    phone,
    whatsapp,
    notes,
    street,
    city,
    country,
    state,
    zip,
    original,
  ]);

  const isDirty = useMemo(() => Object.keys(dirtyDiff).length > 0, [dirtyDiff]);

  const emailValidForEdit = useMemo(() => {
    if (!isEdit) return true;
    if ("email" in dirtyDiff) {
      return EMAIL_REGEX.test(((dirtyDiff as any).email ?? "").trim());
    }
    return true;
  }, [isEdit, dirtyDiff]);

  const canSubmitEdit = isEdit && isDirty && emailValidForEdit && !submitting;

  const handlePrimary = useCallback(async () => {
    if (isEdit) {
      if (!agent?.id && !(agent as any)?._id) return;
      if (!canSubmitEdit) return;

      setSubmitting(true);
      setError(null);
      try {
        const targetId = (agent?.id ?? (agent as any)?._id) as string;
        await updateAgent(String(targetId), dirtyDiff as UpdateAgentDto);
        onSaved?.();
        onClose();
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Update failed. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!createRequiredOk) return;

    setSubmitting(true);
    setError(null);
    try {
      const dto: CreateAgentDto = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || "",
        whatsapp: whatsapp.trim() || undefined,
        notes: notes.trim() || undefined,
        address: {
          street: street.trim(),
          city: city.trim(),
          country: country.trim(),
          state: state.trim() || undefined,
          zip: zip.trim() || undefined,
        },
        ...(shippingLineId ? { shippingLineId } : {}),
      };

      const created = await createAgent(dto);
      onSaved?.(created);
      // clear
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setWhatsapp("");
      setNotes("");
      setStreet("");
      setCity("");
      setCountry("");
      setStateVal("");
      setZip("");
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Operation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    isEdit,
    agent?.id,
    canSubmitEdit,
    updateAgent,
    dirtyDiff,
    onSaved,
    onClose,
    createRequiredOk,
    createAgent,
    firstName,
    lastName,
    email,
    phone,
    whatsapp,
    notes,
    street,
    city,
    country,
    state,
    zip,
    shippingLineId,
  ]);

  if (!open) return null;

  const inputBase =
    "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300";

  return (
    <BaseModal
      className={classNames("px-6 py-5", className)}
      title={isEdit ? "Edit Agent" : "Add Agent"}
      primaryActionLabel={
        submitting ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save" : "Create"
      }
      primaryActionDisabled={isEdit ? !canSubmitEdit : !createRequiredOk}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-800">
              First Name <span className="text-red-600">*</span>
            </label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
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
              placeholder="Last name"
              maxLength={50}
              className={inputBase}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-800">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
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
              placeholder="Phone number"
              maxLength={30}
              className={inputBase}
              autoComplete="tel"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-800">WhatsApp</label>
            <input
              type="tel"
              inputMode="tel"
              pattern="[+\\d()\\s-]*"
              value={whatsapp}
              onChange={(e) => handleWhatsappChange(e.target.value)}
              placeholder="WhatsApp number"
              maxLength={30}
              className={inputBase}
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-800">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              maxLength={300}
              className={inputBase}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-800">
            Address <span className="text-red-600">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Street address"
              maxLength={120}
              className={inputBase}
              autoComplete="street-address"
              required
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              maxLength={80}
              className={inputBase}
              autoComplete="address-level2"
              required
            />
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
              maxLength={80}
              className={inputBase}
              autoComplete="country-name"
              required
            />
            <input
              value={state}
              onChange={(e) => setStateVal(e.target.value)}
              placeholder="State / Province"
              maxLength={80}
              className={inputBase}
              autoComplete="address-level1"
            />
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="ZIP / Postal Code"
              maxLength={20}
              className={inputBase}
              autoComplete="postal-code"
            />
          </div>
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

export default CreateEditAgentModal;
