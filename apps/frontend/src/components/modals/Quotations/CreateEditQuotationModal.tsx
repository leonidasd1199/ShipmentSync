export type QuotationAgentHelper = {
  _id: string;
  name: string;
  shippingLineId: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import classNames from "classnames";
import { Calendar } from "primereact/calendar";
import { Trash2, ChevronDown } from "lucide-react";

import BaseModal from "../BaseModal";
import { useQuotationHelpers } from "../../../hooks/useQuotationsHelpers";
import type {
  CreateQuotationDto,
  UpdateQuotationDto,
  QuotationResponse,
} from "../../../utils/types/quotation.type";
import { TransitTypeEnum, QuotationStatusEnum } from "../../../utils/constants";
import { useAuthStore } from "../../../stores/auth.store";

type Mode = "create" | "edit";

type QuotationItemForm = {
  type: "cargo" | "custom";
  description: string;
  price: string;
  notes: string;
  transitType: TransitTypeEnum | "";
};

type CreateEditQuotationModalProps = {
  open: boolean;
  onClose: () => void;
  mode?: Mode;
  quotation?: QuotationResponse | null;
  createQuotation?: (dto: CreateQuotationDto) => Promise<QuotationResponse>;
  updateQuotation?: (id: string, dto: UpdateQuotationDto) => Promise<QuotationResponse>;
  onSaved?: (quotation?: QuotationResponse | void) => void;
  className?: string;
};

const CreateEditQuotationModal: React.FC<CreateEditQuotationModalProps> = ({
  open,
  onClose,
  mode = "create",
  quotation = null,
  createQuotation = async () => {
    return {} as QuotationResponse;
  },
  updateQuotation = async () => {
    return {} as QuotationResponse;
  },
  onSaved,
  className,
}) => {
  const isEdit = mode === "edit";

  const { user: currentUser } = useAuthStore();
  const companyId =
    (currentUser as any)?.company?._id ??
    (currentUser as any)?.company?.id ??
    null;

  const {
    clients,
    shippingLines,
    agents,
    isLoading: helpersLoading,
    refresh: refreshHelpers,
  } = useQuotationHelpers({ autoload: true });

  const [clientId, setClientId] = useState<string>("");
  const [shippingLineId, setShippingLineId] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");

  const [items, setItems] = useState<QuotationItemForm[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [validUntil, setValidUntil] = useState<Date | null>(null);
  const [summarize, setSummarize] = useState<boolean>(true);
  const [status, setStatus] = useState<QuotationStatusEnum>(
    QuotationStatusEnum.Draft
  );

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const originalStatus: QuotationStatusEnum = useMemo(() => {
    if (!isEdit || !quotation) return QuotationStatusEnum.Draft;
    return ((quotation as any).status as QuotationStatusEnum) ?? QuotationStatusEnum.Draft;
  }, [isEdit, quotation]);

  const isApprovedReadOnly = isEdit && originalStatus === QuotationStatusEnum.Accepted;

  useEffect(() => {
    if (open) {
      void refreshHelpers();
    }
  }, [open, refreshHelpers]);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setSubmitting(false);

    if (isEdit && quotation) {
      setClientId((quotation.client as any)?._id ?? quotation.clientId ?? "");
      setShippingLineId(
        (quotation.shippingLine as any)?._id ?? quotation.shippingLineId ?? ""
      );
      setAgentId(
        (quotation.agent as any)?._id ?? quotation.agentId ?? ""
      );
      setNotes(quotation.notes ?? "");
      setSummarize(Boolean(quotation.summarize));
      setStatus(
        ((quotation as any).status as QuotationStatusEnum) ??
        QuotationStatusEnum.Draft
      );

      const vu =
        quotation.validUntil instanceof Date
          ? quotation.validUntil
          : quotation.validUntil
            ? new Date(quotation.validUntil)
            : null;
      setValidUntil(vu && !Number.isNaN(vu.getTime()) ? vu : null);

      const mappedItems: QuotationItemForm[] = (quotation.items ?? []).map(
        (it: any) => ({
          type: it.type ?? "cargo",
          description: it.description ?? "",
          price:
            typeof it.price === "number"
              ? String(it.price)
              : it.price ?? "",
          notes: it.notes ?? "",
          transitType: (it.transitType as TransitTypeEnum) ?? "",
        })
      );
      setItems(
        mappedItems.length > 0
          ? mappedItems
          : [
            {
              type: "cargo",
              description: "",
              price: "",
              notes: "",
              transitType: "" as TransitTypeEnum | "",
            },
          ]
      );
    } else {
      setClientId("");
      setShippingLineId("");
      setAgentId("");
      setNotes("");
      setSummarize(true);
      setStatus(QuotationStatusEnum.Draft);
      setValidUntil(null);
      setItems([
        {
          type: "cargo",
          description: "",
          price: "",
          notes: "",
          transitType: "" as TransitTypeEnum | "",
        },
      ]);
    }
  }, [isEdit, quotation, open]);

  const inputBase =
    "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300";

  const selectBase =
    "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300";

  const itemInputBase = inputBase + " text-[12px] py-2.5";
  const itemSelectBase =
    selectBase + " text-[12px] py-2.5 pr-8 appearance-none";

  // opciones de status basadas en el status original
  const statusOptions = useMemo(() => {
    if (!isEdit) {
      // nuevas cotizaciones siempre empiezan en Draft
      return [QuotationStatusEnum.Draft];
    }

    switch (originalStatus) {
      case QuotationStatusEnum.Draft:
        // de draft solo puede ir a sent
        return [QuotationStatusEnum.Draft, QuotationStatusEnum.Sent];
      case QuotationStatusEnum.Sent:
        // de sent solo puede ir a accepted o rejected
        return [
          QuotationStatusEnum.Sent,
          QuotationStatusEnum.Accepted,
          QuotationStatusEnum.Rejected,
        ];
      case QuotationStatusEnum.Rejected:
        // de rejected puede volver a draft o accepted
        return [
          QuotationStatusEnum.Rejected,
          QuotationStatusEnum.Draft,
          QuotationStatusEnum.Accepted,
        ];
      case QuotationStatusEnum.Accepted:
        // aceptada ya no se puede mover
        return [QuotationStatusEnum.Accepted];
      default:
        return [originalStatus];
    }
  }, [isEdit, originalStatus]);

  const handleItemChange = (
    index: number,
    field: keyof QuotationItemForm,
    value: string
  ) => {
    if (isApprovedReadOnly) return;

    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? ({
            ...it,
            [field]:
              field === "type"
                ? (value as "cargo" | "custom")
                : field === "transitType"
                  ? (value as TransitTypeEnum | "")
                  : value,
          } as QuotationItemForm)
          : it
      )
    );
  };

  const handleAddItem = () => {
    if (isApprovedReadOnly) return;

    setItems((prev) => [
      ...prev,
      {
        type: "cargo",
        description: "",
        price: "",
        notes: "",
        transitType: "" as TransitTypeEnum | "",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (isApprovedReadOnly) return;

    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): string | null => {
    if (!companyId) {
      return "No company associated to current user.";
    }
    if (!clientId) return "Client is required.";
    if (!shippingLineId) return "Shipping line is required.";
    if (!validUntil) return "Valid until date is required.";

    if (Number.isNaN(validUntil.getTime())) {
      return "Valid until date is not valid.";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const vuDate = new Date(validUntil.getTime());
    vuDate.setHours(0, 0, 0, 0);

    if (vuDate < today) {
      return "Valid until date cannot be in the past.";
    }

    if (!items.length) return "At least one item is required.";

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.description.trim()) {
        return `Item #${i + 1}: description is required.`;
      }
      const priceNum = parseFloat(it.price.replace(",", "."));
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        return `Item #${i + 1}: price must be a positive number.`;
      }
      if (it.type === "cargo" && !it.transitType) {
        return `Item #${i + 1}: transit type is required for cargo items.`;
      }
    }

    if (!isEdit && status !== QuotationStatusEnum.Draft) {
      return "New quotations must start in Draft status.";
    }

    if (isEdit && status === QuotationStatusEnum.Expired) {
      return "Status cannot be set to Expired manually.";
    }

    return null;
  };

  const handlePrimary = useCallback(async () => {
    if (submitting || isApprovedReadOnly) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!companyId) {
      setError("No company associated to current user.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const parsedItems = items.map((it) => {
        const priceNum = parseFloat(it.price.replace(",", "."));
        return {
          type: it.type,
          description: it.description.trim(),
          price: priceNum,
          notes: it.notes.trim() || undefined,
          transitType:
            it.type === "cargo" && it.transitType
              ? (it.transitType as any)
              : undefined,
        };
      });

      if (!validUntil) {
        throw new Error("Valid until date is required.");
      }

      if (isEdit && quotation) {
        const dto: UpdateQuotationDto = {
          clientId,
          companyId,
          shippingLineId,
          agentId: agentId || undefined,
          items: parsedItems as any,
          notes: notes.trim() || undefined,
          validUntil: validUntil.toISOString(),
          summarize,
          status,
        };

        const id = (quotation as any).id ?? (quotation as any)._id;
        const updated = await updateQuotation(String(id), dto);
        onSaved?.(updated);
        onClose();
      } else {
        const dto: CreateQuotationDto = {
          clientId,
          companyId,
          shippingLineId,
          agentId: agentId || undefined,
          items: parsedItems as any,
          notes: notes.trim() || undefined,
          validUntil: validUntil.toISOString(),
          summarize,
          status: QuotationStatusEnum.Draft,
        };

        const created = await createQuotation(dto);
        onSaved?.(created);
        onClose();
      }
    } catch (e: any) {
      setError(
        e?.response?.data?.message ??
        e?.message ??
        "Operation failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    isEdit,
    quotation,
    clientId,
    companyId,
    shippingLineId,
    agentId,
    items,
    notes,
    validUntil,
    summarize,
    status,
    createQuotation,
    updateQuotation,
    onSaved,
    onClose,
    submitting,
    isApprovedReadOnly,
  ]);

  const filteredAgents = useMemo(
    () =>
      agents.filter((a: any) =>
        shippingLineId ? a.shippingLineId === shippingLineId : true
      ),
    [agents, shippingLineId]
  );

  const primaryLabel = submitting
    ? isEdit
      ? "Saving..."
      : "Creating..."
    : isEdit
      ? "Save"
      : "Create";

  const primaryDisabled = submitting || helpersLoading || isApprovedReadOnly;


  if (!open) return null;

  return (
    <BaseModal
      className={classNames("px-6 py-5 max-w-3xl", className)}
      title={isEdit ? "Edit Estimate" : "Add Estimate"}
      primaryActionLabel={primaryLabel}
      primaryActionDisabled={primaryDisabled}
      onPrimaryAction={handlePrimary}
      secondaryActionLabel="Cancel"
      secondaryActionDisabled={submitting}
      onSecondaryAction={onClose}
      onHide={onClose}
      hideModalFooter={false}
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          handlePrimary();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-800">
              Client <span className="text-red-600">*</span>
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={selectBase}
              disabled={isApprovedReadOnly}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.clientName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-800">
              Supplier <span className="text-red-600">*</span>
            </label>
            <select
              value={shippingLineId}
              onChange={(e) => {
                const newShippingLineId = e.target.value;
                setShippingLineId(newShippingLineId);

                if (agentId) {
                  const currentAgent = (agents as any[]).find(
                    (a) => a._id === agentId
                  ) as QuotationAgentHelper | undefined;
                  if (
                    currentAgent &&
                    currentAgent.shippingLineId !== newShippingLineId
                  ) {
                    setAgentId("");
                  }
                }
              }}
              className={selectBase}
              disabled={isApprovedReadOnly}
            >
              <option value="">Select shipping line</option>
              {shippingLines.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-800">
              Agent
            </label>
            <select
              value={agentId}
              onChange={(e) => {
                const newAgentId = e.target.value;
                setAgentId(newAgentId);

                if (newAgentId) {
                  const agent = (agents as any[]).find(
                    (a) => a._id === newAgentId
                  ) as QuotationAgentHelper | undefined;
                  if (
                    agent?.shippingLineId &&
                    agent.shippingLineId !== shippingLineId
                  ) {
                    setShippingLineId(agent.shippingLineId);
                  }
                }
              }}
              className={selectBase}
              disabled={isApprovedReadOnly}
            >
              <option value="">No agent</option>
              {filteredAgents.map((a: any) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">
              Items <span className="text-red-600">*</span>
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isApprovedReadOnly}
            >
              + Add item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-neutral-200 bg-white p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-700">
                    Item #{index + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 disabled:text-neutral-300 disabled:border-neutral-200 disabled:bg-white disabled:cursor-default"
                      title="Remove item"
                      aria-label="Remove item"
                      disabled={isApprovedReadOnly}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-neutral-700">
                      Type
                    </label>
                    <div className="relative">
                      <select
                        value={item.type}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "type",
                            e.target.value as "cargo" | "custom"
                          )
                        }
                        className={itemSelectBase}
                        disabled={isApprovedReadOnly}
                      >
                        <option value="cargo">Charge</option>
                        <option value="custom">Custom</option>
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                        <ChevronDown size={14} className="text-neutral-500" />
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-xs font-medium text-neutral-700">
                      Description
                    </label>
                    <input
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(index, "description", e.target.value)
                      }
                      maxLength={40}
                      className={itemInputBase}
                      disabled={isApprovedReadOnly}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-neutral-700">
                      Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(e) =>
                        handleItemChange(index, "price", e.target.value)
                      }
                      placeholder="0.00"
                      className={itemInputBase}
                      disabled={isApprovedReadOnly}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-neutral-700">
                      Transit type
                    </label>
                    <div className="relative">
                      <select
                        value={item.transitType}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "transitType",
                            e.target.value
                          )
                        }
                        className={itemSelectBase}
                        disabled={
                          isApprovedReadOnly || item.type !== "cargo"
                        }
                      >
                        <option value="">Select type</option>
                        <option value={TransitTypeEnum.Air}>Air</option>
                        <option value={TransitTypeEnum.Land}>Land</option>
                        <option value={TransitTypeEnum.Maritime}>Maritime</option>
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                        <ChevronDown size={14} className="text-neutral-500" />
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-neutral-700">
                      Item notes
                    </label>
                    <input
                      value={item.notes}
                      onChange={(e) =>
                        handleItemChange(index, "notes", e.target.value)
                      }
                      placeholder="Notes (optional)"
                      maxLength={50}
                      className={itemInputBase}
                      disabled={isApprovedReadOnly}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-800">
              General notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Notes about this quotation (optional)"
              className={classNames(
                inputBase,
                "resize-none align-top h-full"
              )}
              disabled={isApprovedReadOnly}
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Valid until <span className="text-red-600">*</span>
              </label>
              <Calendar
                value={validUntil}
                onChange={(e) =>
                  setValidUntil((e.value as Date | null) ?? null)
                }
                showIcon
                minDate={new Date()}
                className="w-full quotation-datepicker"
                panelClassName="quotation-datepicker-panel"
                disabled={isApprovedReadOnly}
                dateFormat="dd/mm/yy"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="summarize"
                type="checkbox"
                checked={summarize}
                onChange={(e) => setSummarize(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
                disabled={isApprovedReadOnly}
              />
              <label
                htmlFor="summarize"
                className="text-sm text-neutral-800 select-none"
              >
                Summarize items (calculate totals)
              </label>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Status {isEdit && <span className="text-red-600">*</span>}
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as QuotationStatusEnum)
                }
                className={selectBase}
                disabled={!isEdit || isApprovedReadOnly}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              {!isEdit && (
                <p className="mt-1 text-xs text-neutral-500">
                  New quotations always start as <strong>Draft</strong>.
                </p>
              )}
            </div>
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

export default CreateEditQuotationModal;
