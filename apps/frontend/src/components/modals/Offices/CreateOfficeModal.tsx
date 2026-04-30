import React, { useMemo, useState, useCallback, useEffect } from "react";
import classNames from "classnames";
import BaseModal from "../BaseModal";
import { useAuthStore } from "../../../stores/auth.store";
import type {
  CreateOfficeDto,
  UpdateOfficeDto,
  Office,
  OfficeAddress,
  OfficeType,
  OfficeInvoicing,
} from "../../../utils/types/office.type";

type Mode = "create" | "edit";

type ModalTab = "general" | "invoicing";

type CreateOfficeModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (office?: Office | void) => void;
  createOffice?: (dto: CreateOfficeDto) => Promise<Office>;
  mode?: Mode;
  office?: Office | null;
  updateOffice?: (id: string, dto: UpdateOfficeDto) => Promise<Office>;
  className?: string;
};

const PHONE_REGEX = /^[+\d()\s-]*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OFFICE_TYPES = [
  { value: "headquarters", label: "Headquarters" },
  { value: "warehouse", label: "Warehouse" },
  { value: "operations", label: "Operations" },
  { value: "distribution", label: "Distribution" },
  { value: "hub", label: "Hub" },
  { value: "branch", label: "Branch" },
] as const;

const emptyInvoicingForm = () => ({
  cai: "",
  ein: "",
  email: "",
  street: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
  rangeFrom: "",
  rangeTo: "",
});

type InvoicingFormState = ReturnType<typeof emptyInvoicingForm>;

function formatApiError(e: unknown): string {
  const err = e as {
    message?: string;
    response?: { data?: { message?: string | string[] } | string };
  };
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  if (d && typeof d === "object" && "message" in d) {
    const m = (d as { message: string | string[] }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join("; ");
  }
  return err?.message ?? "Operation failed. Please try again.";
}

function validateInvoicingForm(inv: InvoicingFormState, office: Office | null): string | null {
  if (!inv.ein.trim()) return "EIN is required.";
  if (!inv.email.trim()) return "Invoicing email is required.";
  if (!EMAIL_REGEX.test(inv.email.trim())) return "Enter a valid invoicing email.";
  const street = inv.street.trim();
  const city = inv.city.trim();
  const state = inv.state.trim();
  const zip = inv.zipCode.trim();
  const country = inv.country.trim();
  if (!street || !city || !state || !zip || !country) {
    return "Complete all invoicing address fields.";
  }
  const fromStr = inv.rangeFrom.trim();
  const toStr = inv.rangeTo.trim();
  if (!fromStr || !toStr) return "Invoice range From and To are required.";
  const from = Number(fromStr);
  const to = Number(toStr);
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return "Invoice range must be whole numbers.";
  }
  if (from < 1 || to < 1) return "Invoice range must be at least 1.";
  if (from > to) return "Invoice range: From must be less than or equal to To.";

  const lastUsed = office?.invoicing?.lastUsedInvoiceNumber;
  const hasIssued = lastUsed != null && lastUsed >= 1;
  if (hasIssued) {
    const minFrom = lastUsed + 1;
    if (from < minFrom) {
      return `Invoices have already been generated within this range. Start at ${minFrom} or higher.`;
    }
    if (to < lastUsed) {
      return "Invoices have already been generated within this range. Upper bound cannot be below the last issued number.";
    }
    const prevTo = office?.invoicing?.invoiceRange?.to;
    if (prevTo != null && to < prevTo) {
      return "Invoices have already been generated within this range. You can only extend the upper bound forward.";
    }
  }

  return null;
}

function buildInvoicingPayload(inv: InvoicingFormState): OfficeInvoicing {
  return {
    cai: inv.cai.trim() || undefined,
    ein: inv.ein.trim(),
    email: inv.email.trim(),
    address: {
      street: inv.street.trim(),
      city: inv.city.trim(),
      state: inv.state.trim(),
      zipCode: inv.zipCode.trim(),
      country: inv.country.trim(),
    },
    invoiceRange: {
      from: Number(inv.rangeFrom.trim()),
      to: Number(inv.rangeTo.trim()),
    },
  };
}

const CreateOfficeModal: React.FC<CreateOfficeModalProps> = ({
  open,
  onClose,
  onSaved,
  createOffice = () => {
    return Promise.resolve({} as Office);
  },
  mode = "create",
  office = null,
  updateOffice = () => {
    return Promise.resolve({} as Office);
  },
  className,
}) => {
  const isEdit = mode === "edit";
  const { user } = useAuthStore();
  const defaultCompanyId = useMemo(() => user?.company?.id ?? "", [user]);

  const [modalTab, setModalTab] = useState<ModalTab>("general");
  const [name, setName] = useState("");
  const [address, setAddress] = useState<OfficeAddress>({
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<string>("headquarters");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState<string>("");
  const [invoicingForm, setInvoicingForm] = useState<InvoicingFormState>(emptyInvoicingForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setModalTab("general");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (isEdit && office && open) {
      setName(office.name ?? "");
      setAddress({
        street: office.address?.street ?? "",
        city: office.address?.city ?? "",
        state: office.address?.state ?? "",
        zipCode: office.address?.zipCode ?? "",
        country: office.address?.country ?? "",
      });
      setPhone(office.phone ?? "");
      setEmail(office.email ?? "");
      setType((office as Office)?.type ?? "headquarters");
      setDescription((office as Office)?.description ?? "");
      const inv = office.invoicing;
      setInvoicingForm({
        cai: inv?.cai ?? "",
        ein: inv?.ein ?? "",
        email: inv?.email ?? "",
        street: inv?.address?.street ?? "",
        city: inv?.address?.city ?? "",
        state: inv?.address?.state ?? "",
        zipCode: inv?.address?.zipCode ?? "",
        country: inv?.address?.country ?? "",
        rangeFrom:
          inv?.invoiceRange?.from != null ? String(inv.invoiceRange.from) : "",
        rangeTo: inv?.invoiceRange?.to != null ? String(inv.invoiceRange.to) : "",
      });
      setError(null);
      setSubmitting(false);
    }
    if (!open && !isEdit) {
      setName("");
      setAddress({ street: "", city: "", state: "", zipCode: "", country: "" });
      setPhone("");
      setEmail("");
      setType("headquarters");
      setDescription("");
      setInvoicingForm(emptyInvoicingForm());
      setError(null);
      setSubmitting(false);
    }
  }, [isEdit, office, open]);

  const invoicingError = useMemo(
    () => validateInvoicingForm(invoicingForm, office),
    [invoicingForm, office],
  );

  const lastUsed = office?.invoicing?.lastUsedInvoiceNumber;
  const hasIssuedInvoices = lastUsed != null && lastUsed >= 1;

  const canSubmitCreate =
    !isEdit &&
    name.trim().length > 0 &&
    !!defaultCompanyId &&
    !!type &&
    email.trim().length > 0 &&
    EMAIL_REGEX.test(email.trim()) &&
    !invoicingError &&
    !submitting;

  const canSubmitEdit =
    isEdit &&
    name.trim().length > 0 &&
    !!type &&
    (email.trim().length === 0 || EMAIL_REGEX.test(email.trim())) &&
    !invoicingError &&
    !submitting;

  const canSubmit = isEdit ? canSubmitEdit : canSubmitCreate;

  const handleAddressChange = (key: keyof OfficeAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [key]: value }));
  };

  const handleInvoicingChange = (key: keyof InvoicingFormState, value: string) => {
    setInvoicingForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePhoneChange = (val: string) => {
    if (PHONE_REGEX.test(val)) setPhone(val);
  };

  const handlePrimary = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const invoicingPayload = buildInvoicingPayload(invoicingForm);

      if (isEdit) {
        const dto: UpdateOfficeDto = {
          name: name.trim(),
          address: Object.values(address).some((v) => v?.trim()) ? address : undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          type: type as OfficeType,
          description: description.trim() || undefined,
          invoicing: invoicingPayload,
        };
        if (office?.id) {
          const updated = await updateOffice(office.id, dto);
          onSaved?.(updated);
        }
      } else {
        const dto: CreateOfficeDto = {
          name: name.trim(),
          companyId: defaultCompanyId,
          email: email.trim(),
          address: Object.values(address).some((v) => v?.trim()) ? address : undefined,
          phone: phone.trim() || undefined,
          type: type as OfficeType,
          description: description.trim() || undefined,
          invoicing: invoicingPayload,
        };
        const created = await createOffice(dto);

        onSaved?.(created);
        setName("");
        setAddress({ street: "", city: "", state: "", zipCode: "", country: "" });
        setPhone("");
        setEmail("");
        setType("headquarters");
        setDescription("");
        setInvoicingForm(emptyInvoicingForm());
      }
      onClose();
    } catch (e: unknown) {
      setError(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    address,
    canSubmit,
    createOffice,
    defaultCompanyId,
    invoicingForm,
    isEdit,
    name,
    office?.id,
    onClose,
    onSaved,
    phone,
    updateOffice,
    type,
    description,
    email,
  ]);

  if (!open) return null;

  const inputBase =
    "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300";

  const tabBtn = (tab: ModalTab, label: string) => (
    <button
      key={tab}
      type="button"
      role="tab"
      aria-selected={modalTab === tab}
      onClick={() => setModalTab(tab)}
      className={classNames(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        modalTab === tab
          ? "bg-white text-neutral-900 shadow-sm"
          : "text-neutral-600 hover:text-neutral-900",
      )}
    >
      {label}
    </button>
  );

  return (
    <BaseModal
      className={classNames("px-6 py-5", className)}
      title={isEdit ? "Edit Office" : "Create Office"}
      primaryActionLabel={
        submitting ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save" : "Create"
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
          void handlePrimary();
        }}
      >
        <div
          role="tablist"
          aria-label="Office sections"
          className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1"
        >
          {tabBtn("general", "General")}
          {tabBtn("invoicing", "Invoicing")}
        </div>

        {modalTab === "general" && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Headquarters"
                maxLength={50}
                autoComplete="organization"
                className={inputBase}
              />
              <div className="mt-1 text-xs text-neutral-500">{name.length}/50</div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Type <span className="text-red-600">*</span>
              </label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputBase}>
                {OFFICE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">Phone</label>
              <input
                type="tel"
                inputMode="tel"
                pattern="[+\d()\s-]*"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+1 (555) 555-5555"
                maxLength={30}
                className={inputBase}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Email {isEdit ? null : <span className="text-red-600">*</span>}
              </label>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="office@company.com"
                maxLength={120}
                className={inputBase}
                pattern={EMAIL_REGEX.source}
                title="Enter a valid email (e.g. name@domain.com)"
                autoComplete="email"
                required={!isEdit}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes about this office..."
                maxLength={300}
                rows={3}
                className={classNames(inputBase, "resize-y")}
              />
              <div className="mt-1 text-xs text-neutral-500">{description.length}/300</div>
            </div>

            <fieldset className="rounded-lg border border-neutral-200 p-3">
              <legend className="px-1 text-sm font-semibold text-neutral-700">Address</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  placeholder="Street"
                  value={address.street}
                  onChange={(e) => handleAddressChange("street", e.target.value)}
                  maxLength={30}
                  className={inputBase}
                />
                <input
                  placeholder="City"
                  value={address.city}
                  onChange={(e) => handleAddressChange("city", e.target.value)}
                  maxLength={30}
                  className={inputBase}
                />
                <input
                  placeholder="State"
                  value={address.state}
                  onChange={(e) => handleAddressChange("state", e.target.value)}
                  maxLength={30}
                  className={inputBase}
                />
                <input
                  placeholder="Zip Code"
                  value={address.zipCode}
                  onChange={(e) => handleAddressChange("zipCode", e.target.value)}
                  maxLength={30}
                  className={inputBase}
                />
                <input
                  placeholder="Country"
                  value={address.country}
                  onChange={(e) => handleAddressChange("country", e.target.value)}
                  maxLength={30}
                  className={inputBase}
                />
              </div>
            </fieldset>
          </>
        )}

        {modalTab === "invoicing" && (
          <div className="space-y-4">
            {hasIssuedInvoices && (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                role="status"
              >
                Invoices have already been generated within this range (last used:{" "}
                <span className="font-medium">{lastUsed}</span>). The next range must start at{" "}
                <span className="font-medium">{lastUsed! + 1}</span> or higher, and you can only
                extend the upper bound forward.
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                CAI <span className="text-neutral-400 font-normal">(optional)</span>
              </label>
              <input
                value={invoicingForm.cai}
                onChange={(e) => handleInvoicingChange("cai", e.target.value)}
                placeholder="Number of impressions of authorization"
                maxLength={64}
                className={inputBase}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                EIN <span className="text-red-600">*</span>
              </label>
              <input
                value={invoicingForm.ein}
                onChange={(e) => handleInvoicingChange("ein", e.target.value)}
                placeholder="12-3456789"
                maxLength={32}
                className={inputBase}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Invoicing email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                inputMode="email"
                value={invoicingForm.email}
                onChange={(e) => handleInvoicingChange("email", e.target.value)}
                placeholder="billing@company.com"
                maxLength={120}
                className={inputBase}
                autoComplete="email"
              />
            </div>

            <fieldset className="rounded-lg border border-neutral-200 p-3">
              <legend className="px-1 text-sm font-semibold text-neutral-700">
                Invoicing address <span className="text-red-600">*</span>
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  placeholder="Street"
                  value={invoicingForm.street}
                  onChange={(e) => handleInvoicingChange("street", e.target.value)}
                  maxLength={200}
                  className={inputBase}
                />
                <input
                  placeholder="City"
                  value={invoicingForm.city}
                  onChange={(e) => handleInvoicingChange("city", e.target.value)}
                  maxLength={100}
                  className={inputBase}
                />
                <input
                  placeholder="State"
                  value={invoicingForm.state}
                  onChange={(e) => handleInvoicingChange("state", e.target.value)}
                  maxLength={100}
                  className={inputBase}
                />
                <input
                  placeholder="Zip code"
                  value={invoicingForm.zipCode}
                  onChange={(e) => handleInvoicingChange("zipCode", e.target.value)}
                  maxLength={30}
                  className={inputBase}
                />
                <input
                  placeholder="Country"
                  value={invoicingForm.country}
                  onChange={(e) => handleInvoicingChange("country", e.target.value)}
                  maxLength={100}
                  className={classNames(inputBase, "sm:col-span-2")}
                />
              </div>
            </fieldset>

            <fieldset className="rounded-lg border border-neutral-200 p-3">
              <legend className="px-1 text-sm font-semibold text-neutral-700">
                Invoice range <span className="text-red-600">*</span>
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">From</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={invoicingForm.rangeFrom}
                    onChange={(e) => handleInvoicingChange("rangeFrom", e.target.value)}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">To</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={invoicingForm.rangeTo}
                    onChange={(e) => handleInvoicingChange("rangeTo", e.target.value)}
                    className={inputBase}
                  />
                </div>
              </div>
            </fieldset>

            {invoicingError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {invoicingError}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </BaseModal>
  );
};

export default CreateOfficeModal;
