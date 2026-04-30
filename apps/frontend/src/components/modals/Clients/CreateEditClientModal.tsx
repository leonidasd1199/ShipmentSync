/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState, useCallback, useEffect } from "react";
import classNames from "classnames";
import BaseModal from "../BaseModal";
import { useOffices } from "../../../hooks/useOffice";
import type {
    Client,
    CreateClientDto,
    UpdateClientDto,
    ClientAddress,
    ClientInvoiceInformation,
} from "../../../utils/types/client.type";
import { useAuthStore } from "../../../stores/auth.store";

type Mode = "create" | "edit";
type ModalTab = "basic" | "invoice";

type CreateEditClientModalProps = {
    open: boolean;
    onClose: () => void;
    onSaved?: (client?: Client | void) => void;
    mode?: Mode;
    client?: Client | null;
    createClient?: (dto: CreateClientDto) => Promise<Client>;
    updateClient?: (id: string, dto: UpdateClientDto) => Promise<Client>;
    className?: string;
};

const PHONE_REGEX = /^[+\d()\s-]*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyInvoiceInfo = (): ClientInvoiceInformation => ({
    billingAddress: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
    },
    invoiceEmail: "",
    paymentTerms: "",
    taxRegimeOrVatNumber: "",
    currency: "",
    preferredPaymentMethod: "",
});

const CreateEditClientModal: React.FC<CreateEditClientModalProps> = ({
    open,
    onClose,
    onSaved,
    mode = "create",
    client = null,
    createClient = async () => {
        throw new Error("createClient not provided");
    },
    updateClient = async () => {
        throw new Error("updateClient not provided");
    },
    className,
}) => {
    const isEdit = mode === "edit";
    const { user: currentUser } = useAuthStore();

    const { offices, isLoading: officesLoading } = useOffices({ autoload: true });
    const officeOptions = useMemo(
        () =>
            offices
                .filter((office) =>
                    currentUser?.offices?.some((userOffice) => userOffice.id === office.id),
                )
                .map((o) => ({
                    value: o.id,
                    label: o.name,
                })),
        [offices, currentUser?.offices],
    );

    const singleOffice = officeOptions.length === 1;

    const [activeTab, setActiveTab] = useState<ModalTab>("basic");
    const [name, setName] = useState<string>("");
    const [officeId, setOfficeId] = useState<string>("");
    const [contactPerson, setContactPerson] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [phone, setPhone] = useState<string>("");
    const [taxId, setTaxId] = useState<string>("");
    const [address, setAddress] = useState<ClientAddress>({
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
    });
    const [invoiceInformation, setInvoiceInformation] =
        useState<ClientInvoiceInformation>(emptyInvoiceInfo);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setActiveTab("basic");
        if (isEdit && client) {
            setName(client.name ?? "");
            setOfficeId(client.officeId ?? "");
            setContactPerson(client.contactPerson ?? "");
            setEmail(client.email ?? "");
            setPhone(client.phone ?? "");
            setTaxId(client.taxId ?? "");
            setAddress({
                street: client.address?.street ?? "",
                city: client.address?.city ?? "",
                state: client.address?.state ?? "",
                zipCode: client.address?.zipCode ?? "",
                country: client.address?.country ?? "",
            });
            setInvoiceInformation(
                client.invoiceInformation
                    ? {
                        ...client.invoiceInformation,
                        billingAddress: {
                            street: client.invoiceInformation.billingAddress?.street ?? "",
                            city: client.invoiceInformation.billingAddress?.city ?? "",
                            state: client.invoiceInformation.billingAddress?.state ?? "",
                            zipCode: client.invoiceInformation.billingAddress?.zipCode ?? "",
                            country: client.invoiceInformation.billingAddress?.country ?? "",
                        },
                    }
                    : emptyInvoiceInfo(),
            );
        } else {
            setName("");
            setContactPerson("");
            setEmail("");
            setPhone("");
            setTaxId("");
            setAddress({ street: "", city: "", state: "", zipCode: "", country: "" });
            setInvoiceInformation(emptyInvoiceInfo());
            setError(null);
            setSubmitting(false);
        }
    }, [open, isEdit, client]);

    useEffect(() => {
        if (!isEdit && singleOffice && offices[0]) {
            setOfficeId(offices[0].id);
        }
    }, [isEdit, singleOffice, offices]);

    const handleAddressChange = (key: keyof ClientAddress, value: string) => {
        setAddress((prev) => ({ ...prev, [key]: value }));
    };

    const handleInvoiceAddressChange = (
        key: keyof ClientInvoiceInformation["billingAddress"],
        value: string,
    ) => {
        setInvoiceInformation((prev) => ({
            ...prev,
            billingAddress: { ...prev.billingAddress, [key]: value },
        }));
    };

    const handlePhoneChange = (val: string) => {
        if (PHONE_REGEX.test(val)) setPhone(val);
    };

    const emailValid = email.trim().length === 0 || EMAIL_REGEX.test(email.trim());
    const hasAnyAddress = Object.values(address).some((v) => v.trim().length > 0);

    const invoiceInfoError = useMemo(() => {
        const info = invoiceInformation;
        if (!info.billingAddress.street.trim()) return "Billing street is required.";
        if (!info.billingAddress.city.trim()) return "Billing city is required.";
        if (!info.billingAddress.state.trim()) return "Billing state is required.";
        if (!info.billingAddress.zipCode.trim()) return "Billing zip code is required.";
        if (!info.billingAddress.country.trim()) return "Billing country is required.";
        if (!info.invoiceEmail.trim()) return "Invoice email is required.";
        if (!EMAIL_REGEX.test(info.invoiceEmail.trim())) return "Invoice email format is invalid.";
        if (!info.paymentTerms.trim()) return "Payment terms are required.";
        if (!info.taxRegimeOrVatNumber.trim()) return "Tax regime / VAT number is required.";
        if (!info.currency.trim()) return "Currency is required.";
        if (!info.preferredPaymentMethod.trim()) return "Preferred payment method is required.";
        return null;
    }, [invoiceInformation]);

    const canSubmitCreate =
        !isEdit &&
        name.trim().length > 0 &&
        officeId.trim().length > 0 &&
        emailValid &&
        !invoiceInfoError &&
        !submitting;

    const canSubmitEdit =
        isEdit &&
        name.trim().length > 0 &&
        officeId.trim().length > 0 &&
        emailValid &&
        !invoiceInfoError &&
        !submitting;

    const canSubmit = isEdit ? canSubmitEdit : canSubmitCreate;

    const inputBase =
        "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300";

    const handlePrimary = useCallback(async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);

        const invoicePayload: ClientInvoiceInformation = {
            billingAddress: {
                street: invoiceInformation.billingAddress.street.trim(),
                city: invoiceInformation.billingAddress.city.trim(),
                state: invoiceInformation.billingAddress.state.trim(),
                zipCode: invoiceInformation.billingAddress.zipCode.trim(),
                country: invoiceInformation.billingAddress.country.trim(),
            },
            invoiceEmail: invoiceInformation.invoiceEmail.trim(),
            paymentTerms: invoiceInformation.paymentTerms.trim(),
            taxRegimeOrVatNumber: invoiceInformation.taxRegimeOrVatNumber.trim(),
            currency: invoiceInformation.currency.trim(),
            preferredPaymentMethod: invoiceInformation.preferredPaymentMethod.trim(),
        };

        try {
            if (isEdit && client?.id) {
                const dto: UpdateClientDto = {
                    name: name.trim(),
                    officeId,
                    contactPerson: contactPerson.trim() || undefined,
                    email: email.trim() || undefined,
                    phone: phone.trim() || undefined,
                    taxId: taxId.trim() || undefined,
                    address: hasAnyAddress ? address : undefined,
                    invoiceInformation: invoicePayload,
                };
                const updated = await updateClient(client.id, dto);
                onSaved?.(updated);
            } else {
                const dto: CreateClientDto = {
                    name: name.trim(),
                    officeId,
                    contactPerson: contactPerson.trim() || undefined,
                    email: email.trim() || undefined,
                    phone: phone.trim() || undefined,
                    taxId: taxId.trim() || undefined,
                    address: hasAnyAddress ? address : undefined,
                    invoiceInformation: invoicePayload,
                };
                const created = await createClient(dto);
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
        client?.id,
        name,
        officeId,
        contactPerson,
        email,
        phone,
        taxId,
        address,
        hasAnyAddress,
        invoiceInformation,
        updateClient,
        createClient,
        onSaved,
        onClose,
    ]);

    if (!open) return null;

    return (
        <BaseModal
            className={classNames("px-6 py-5", className)}
            title={isEdit ? "Edit Client" : "Create Client"}
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
                    aria-label="Client form sections"
                    className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "basic"}
                        onClick={() => setActiveTab("basic")}
                        className={classNames(
                            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                            activeTab === "basic"
                                ? "bg-white text-neutral-900 shadow-sm"
                                : "text-neutral-600 hover:text-neutral-900",
                        )}
                    >
                        Basic Profile
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "invoice"}
                        onClick={() => setActiveTab("invoice")}
                        className={classNames(
                            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                            activeTab === "invoice"
                                ? "bg-white text-neutral-900 shadow-sm"
                                : "text-neutral-600 hover:text-neutral-900",
                        )}
                    >
                        Invoice Information
                    </button>
                </div>

                {activeTab === "basic" && (
                    <>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-800">
                                Name <span className="text-red-600">*</span>
                            </label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Acme Corporation"
                                maxLength={100}
                                className={inputBase}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-800">
                                Office <span className="text-red-600">*</span>
                            </label>
                            {officesLoading ? (
                                <div className="text-sm text-neutral-500">Loading offices...</div>
                            ) : singleOffice ? (
                                <input
                                    value={officeOptions[0]?.label ?? ""}
                                    readOnly
                                    disabled
                                    className={classNames(inputBase, "bg-neutral-100 cursor-not-allowed")}
                                />
                            ) : (
                                <select
                                    value={officeId}
                                    onChange={(e) => setOfficeId(e.target.value)}
                                    className={inputBase}
                                >
                                    <option value="" disabled>
                                        Select an office...
                                    </option>
                                    {officeOptions.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-800">
                                Contact Person
                            </label>
                            <input
                                value={contactPerson}
                                onChange={(e) => setContactPerson(e.target.value)}
                                placeholder="John Smith"
                                maxLength={80}
                                className={inputBase}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-800">Email</label>
                            <input
                                type="email"
                                inputMode="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="contact@acme.com"
                                maxLength={120}
                                className={inputBase}
                                pattern={EMAIL_REGEX.source}
                                title="Enter a valid email (e.g. name@domain.com)"
                            />
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

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-neutral-800">Tax ID</label>
                                <input
                                    value={taxId}
                                    onChange={(e) => setTaxId(e.target.value)}
                                    placeholder="TAX123456"
                                    maxLength={40}
                                    className={inputBase}
                                />
                            </div>
                        </div>
                        <fieldset className="rounded-lg border border-neutral-200 p-3">
                            <legend className="px-1 text-sm font-semibold text-neutral-700">Address</legend>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <input
                                    placeholder="Street"
                                    value={address.street}
                                    onChange={(e) => handleAddressChange("street", e.target.value)}
                                    className={inputBase}
                                />
                                <input
                                    placeholder="City"
                                    value={address.city}
                                    onChange={(e) => handleAddressChange("city", e.target.value)}
                                    className={inputBase}
                                />
                                <input
                                    placeholder="State"
                                    value={address.state}
                                    onChange={(e) => handleAddressChange("state", e.target.value)}
                                    className={inputBase}
                                />
                                <input
                                    placeholder="Zip Code"
                                    value={address.zipCode}
                                    onChange={(e) => handleAddressChange("zipCode", e.target.value)}
                                    className={inputBase}
                                />
                                <input
                                    placeholder="Country"
                                    value={address.country}
                                    onChange={(e) => handleAddressChange("country", e.target.value)}
                                    className={inputBase}
                                />
                            </div>
                        </fieldset>
                    </>
                )}

                {activeTab === "invoice" && (
                    <div className="space-y-4">
                        <fieldset className="rounded-lg border border-neutral-200 p-3">
                            <legend className="px-1 text-sm font-semibold text-neutral-700">
                                Billing Address <span className="text-red-600">*</span>
                            </legend>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <input
                                    placeholder="Street"
                                    value={invoiceInformation.billingAddress.street}
                                    onChange={(e) => handleInvoiceAddressChange("street", e.target.value)}
                                    className={inputBase}
                                />
                                <input
                                    placeholder="City"
                                    value={invoiceInformation.billingAddress.city}
                                    onChange={(e) => handleInvoiceAddressChange("city", e.target.value)}
                                    className={inputBase}
                                />
                                <input
                                    placeholder="State"
                                    value={invoiceInformation.billingAddress.state}
                                    onChange={(e) => handleInvoiceAddressChange("state", e.target.value)}
                                    className={inputBase}
                                />
                                <input
                                    placeholder="Zip Code"
                                    value={invoiceInformation.billingAddress.zipCode}
                                    onChange={(e) => handleInvoiceAddressChange("zipCode", e.target.value)}
                                    className={inputBase}
                                />
                                <input
                                    placeholder="Country"
                                    value={invoiceInformation.billingAddress.country}
                                    onChange={(e) => handleInvoiceAddressChange("country", e.target.value)}
                                    className={classNames(inputBase, "sm:col-span-2")}
                                />
                            </div>
                        </fieldset>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-800">
                                Invoice Email <span className="text-red-600">*</span>
                            </label>
                            <input
                                type="email"
                                inputMode="email"
                                value={invoiceInformation.invoiceEmail}
                                onChange={(e) =>
                                    setInvoiceInformation((prev) => ({
                                        ...prev,
                                        invoiceEmail: e.target.value,
                                    }))
                                }
                                placeholder="billing@acme.com"
                                className={inputBase}
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-800">
                                Payment Terms <span className="text-red-600">*</span>
                            </label>
                            <input
                                value={invoiceInformation.paymentTerms}
                                onChange={(e) =>
                                    setInvoiceInformation((prev) => ({
                                        ...prev,
                                        paymentTerms: e.target.value,
                                    }))
                                }
                                placeholder="Net 30"
                                className={inputBase}
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-800">
                                Tax Regime / VAT Number <span className="text-red-600">*</span>
                            </label>
                            <input
                                value={invoiceInformation.taxRegimeOrVatNumber}
                                onChange={(e) =>
                                    setInvoiceInformation((prev) => ({
                                        ...prev,
                                        taxRegimeOrVatNumber: e.target.value,
                                    }))
                                }
                                placeholder="VAT-123456"
                                className={inputBase}
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-800">
                                Currency <span className="text-red-600">*</span>
                            </label>
                            <input
                                value={invoiceInformation.currency}
                                onChange={(e) =>
                                    setInvoiceInformation((prev) => ({
                                        ...prev,
                                        currency: e.target.value,
                                    }))
                                }
                                placeholder="USD"
                                className={inputBase}
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-800">
                                Preferred Payment Method <span className="text-red-600">*</span>
                            </label>
                            <input
                                value={invoiceInformation.preferredPaymentMethod}
                                onChange={(e) =>
                                    setInvoiceInformation((prev) => ({
                                        ...prev,
                                        preferredPaymentMethod: e.target.value,
                                    }))
                                }
                                placeholder="Wire Transfer"
                                className={inputBase}
                            />
                        </div>

                        {invoiceInfoError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {invoiceInfoError}
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

export default CreateEditClientModal;
