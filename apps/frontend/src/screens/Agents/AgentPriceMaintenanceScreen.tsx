import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Trash2,
  ChevronDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Ship,
  Anchor,
  Clock,
  FileText,
  Send,
  Package,
  DollarSign,
  Edit2,
  X,
  History,
  Calendar,
  Search,
} from "lucide-react";
import {
  AgentPricingService,
  type Pricelist,
  type PricelistItem,
  type PricelistItemDto,
  type SupplierListItem,
  type PricelistStatus,
  type PricelistSummary,
} from "../../services/pricing.service";

// =============================================================================
// CONSTANTS
// =============================================================================

const CHARGE_TYPES = [
  { value: "OCEAN_FREIGHT", label: "Ocean Freight" },
  { value: "DESTINATION_CHARGE", label: "Destination Charge" },
  { value: "DOC_FEE", label: "Documentation Fee" },
  { value: "OTHER", label: "Other" },
] as const;

const EQUIPMENT_TYPES = [
  { value: "20GP", label: "20GP" },
  { value: "40GP", label: "40GP" },
  { value: "40HC", label: "40HC" },
  { value: "40HQ", label: "40HQ" },
  { value: "45HC", label: "45HC" },
  { value: "LCL", label: "LCL" },
] as const;

const INCOTERMS = ["FOB", "CIF", "CFR", "EXW", "DDP", "DAP", "CPT", "CIP", "FAS"] as const;

const PRICING_UNITS = [
  { value: "PER_CONTAINER", label: "Per Container" },
  { value: "PER_SHIPMENT", label: "Per Shipment" },
  { value: "PER_KG", label: "Per Kg" },
  { value: "PER_CBM", label: "Per CBM" },
  { value: "FLAT", label: "Flat Rate" },
] as const;

const CURRENCIES = ["USD", "EUR", "CNY"] as const;


// =============================================================================
// STYLES
// =============================================================================

const inputBase =
  "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:bg-neutral-100 disabled:text-neutral-500";

const selectBase =
  "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400 transition-all disabled:bg-neutral-100 disabled:text-neutral-500";

const labelBase = "mb-1 block text-xs font-medium text-neutral-600";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getDefaultItemDto = (): PricelistItemDto => ({
  name: "",
  chargeType: "OCEAN_FREIGHT",
  incoterm: "FOB",
  equipmentType: "40HQ",
  lane: {
    originPortCode: "",
    originName: "",
    destinationPortCode: "",
    destinationName: "",
  },
  cost: 0,
  profit: 0,
  currency: "USD",
  pricingUnit: "PER_CONTAINER",
  freeTimeDays: 21,
});

const formatWeekRange = (start?: string, end?: string) => {
  if (!start) return "Current Week";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date(startDate);
  if (!end) {
    endDate.setDate(startDate.getDate() + 6);
  }
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", { ...options, year: "numeric" })}`;
};

const getStatusBadge = (status?: PricelistStatus) => {
  const styles: Record<PricelistStatus | "new", string> = {
    new: "bg-neutral-100 text-neutral-600 border-neutral-300",
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    submitted: "bg-blue-50 text-blue-700 border-blue-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    superseded: "bg-neutral-100 text-neutral-500 border-neutral-300",
  };
  const labels: Record<PricelistStatus | "new", string> = {
    new: "New",
    draft: "Draft",
    submitted: "Pending Approval",
    approved: "Approved",
    rejected: "Rejected",
    superseded: "Superseded",
  };
  const key = status || "new";
  return { style: styles[key], label: labels[key] };
};

const itemToDto = (item: PricelistItem): PricelistItemDto => ({
  name: item.name,
  chargeType: item.chargeType,
  incoterm: item.incoterm,
  equipmentType: item.equipmentType,
  lane: item.lane,
  cost: item.cost,
  profit: item.profit,
  currency: item.currency,
  pricingUnit: item.pricingUnit,
  validFrom: item.validFrom,
  validTo: item.validTo,
  freeTimeDays: item.freeTimeDays,
  transitTimeDaysMin: item.transitTimeDaysMin,
  transitTimeDaysMax: item.transitTimeDaysMax,
  carrierName: item.carrierName,
  metadata: item.metadata,
});

// =============================================================================
// SEARCHABLE PORT CODE SELECT (local, no API needed)
// =============================================================================

interface PortOption {
  code: string;
  name: string;
}

interface PortCodeSelectProps {
  value: string;
  onChange: (code: string, name: string) => void;
  options: readonly PortOption[];
  placeholder?: string;
  disabled?: boolean;
}

const PortCodeSelect: React.FC<PortCodeSelectProps> = ({ value, onChange, options, placeholder = "Search port…", disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((p) => p.code === value);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const valid = (options as PortOption[]).filter((p) => p.code && p.name);
    if (!q) return valid.slice(0, 8);
    return valid.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, options]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white cursor-pointer ${disabled ? "bg-neutral-100 cursor-not-allowed" : "hover:border-neutral-400"}`}
        onClick={() => { if (!disabled) { setOpen(true); } }}
      >
        <Search size={13} className="text-neutral-400 flex-shrink-0" />
        {open ? (
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="flex-1 outline-none bg-transparent text-neutral-900 placeholder-neutral-400 text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`flex-1 truncate ${selected ? "text-neutral-900" : "text-neutral-400"}`}>
            {selected ? `${selected.name} (${selected.code})` : placeholder}
          </span>
        )}
        {value && !open && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange("", ""); }}
            className="p-0.5 rounded hover:bg-neutral-100 outline-none focus:outline-none"
          >
            <X size={12} style={{ color: "#9CA3AF", display: "block" }} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-400">No ports found</div>
          ) : (
            filtered.map((port, i) => (
              <button
                key={`${port.code}-${i}`}
                type="button"
                onClick={() => { onChange(port.code, port.name); setOpen(false); setSearch(""); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${port.code === value ? "bg-blue-50 text-blue-700" : "text-neutral-900"}`}
                style={{ outline: "none", boxShadow: "none", border: "none", background: port.code === value ? undefined : "white" }}
              >
                <span className="font-medium">{port.name}</span>
                <span className="ml-1.5 text-xs text-neutral-400">{port.code}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// ITEM FORM MODAL
// =============================================================================

interface ItemFormModalProps {
  item: PricelistItemDto | null;
  existingId?: string;
  onSave: (item: PricelistItemDto, existingId?: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  ports: PortOption[];
}

const ItemFormModal: React.FC<ItemFormModalProps> = ({
  item,
  existingId,
  onSave,
  onClose,
  saving,
  error: externalError,
  ports,
}) => {
  const [formData, setFormData] = useState<PricelistItemDto>(
    item || getDefaultItemDto()
  );
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!existingId;

  const handleChange = (field: keyof PricelistItemDto, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleLaneChange = (field: string, code: string, name?: string) => {
    if (field === "originPortCode") {
      setFormData((prev) => ({
        ...prev,
        lane: { ...prev.lane, originPortCode: code, originName: name || "" },
      }));
    } else if (field === "destinationPortCode") {
      setFormData((prev) => ({
        ...prev,
        lane: { ...prev.lane, destinationPortCode: code, destinationName: name || "" },
      }));
    }
    setError(null);
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!formData.cost || formData.cost <= 0) {
      setError("Valid cost is required");
      return;
    }
    if (formData.chargeType === "OCEAN_FREIGHT") {
      if (!formData.lane?.originPortCode) {
        setError("Origin port is required for Ocean Freight");
        return;
      }
      if (!formData.lane?.destinationPortCode) {
        setError("Destination port is required for Ocean Freight");
        return;
      }
    }

    await onSave(formData, existingId);
  };

  const showLaneFields = formData.chargeType === "OCEAN_FREIGHT";
  const showEquipmentFields =
    formData.chargeType === "OCEAN_FREIGHT" ||
    formData.chargeType === "DESTINATION_CHARGE";
  const showTransitFields = formData.chargeType === "OCEAN_FREIGHT";

  const displayError = error || externalError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 sm:px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            {isEdit ? "Edit Item" : "Add New Item"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-50"
            style={{ outline: "none", boxShadow: "none", border: "none", background: "transparent" }}
          >
            <X size={20} style={{ color: "#6B7280", display: "block" }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {displayError && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              {displayError}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-700 flex items-center gap-2">
              <Package size={14} /> Basic Info
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelBase}>
                  Name / Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., Ocean Freight Ningbo to Puerto Cortes"
                  className={inputBase}
                  disabled={saving}
                />
              </div>
              <div>
                <label className={labelBase}>
                  Charge Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.chargeType}
                    onChange={(e) => handleChange("chargeType", e.target.value)}
                    className={`${selectBase} pr-8 appearance-none`}
                    disabled={saving}
                  >
                    {CHARGE_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>
                        {ct.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                  />
                </div>
              </div>
              <div>
                <label className={labelBase}>Incoterm</label>
                <div className="relative">
                  <select
                    value={formData.incoterm}
                    onChange={(e) => handleChange("incoterm", e.target.value)}
                    className={`${selectBase} pr-8 appearance-none`}
                    disabled={saving}
                  >
                    {INCOTERMS.map((inc) => (
                      <option key={inc} value={inc}>
                        {inc}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Lane */}
          {showLaneFields && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                <Anchor size={14} /> Route
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelBase}>
                    Origin Port (POL) <span className="text-red-500">*</span>
                  </label>
                  <PortCodeSelect
                    value={formData.lane?.originPortCode || ""}
                    onChange={(code, name) => handleLaneChange("originPortCode", code, name)}
                    options={ports}
                    placeholder="Search origin port…"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className={labelBase}>
                    Destination Port (POD) <span className="text-red-500">*</span>
                  </label>
                  <PortCodeSelect
                    value={formData.lane?.destinationPortCode || ""}
                    onChange={(code, name) => handleLaneChange("destinationPortCode", code, name)}
                    options={ports}
                    placeholder="Search destination port…"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-700 flex items-center gap-2">
              <DollarSign size={14} /> Pricing
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelBase}>
                  Cost <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost || ""}
                  onChange={(e) => handleChange("cost", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={inputBase}
                  disabled={saving}
                />
              </div>
              <div>
                <label className={labelBase}>Profit</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.profit ?? ""}
                  onChange={(e) => handleChange("profit", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={inputBase}
                  disabled={saving}
                />
              </div>
              <div>
                <label className={labelBase}>Currency</label>
                <div className="relative">
                  <select
                    value={formData.currency}
                    onChange={(e) => handleChange("currency", e.target.value)}
                    className={`${selectBase} pr-8 appearance-none`}
                    disabled={saving}
                  >
                    {CURRENCIES.map((cur) => (
                      <option key={cur} value={cur}>
                        {cur}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                  />
                </div>
              </div>
              <div>
                <label className={labelBase}>Pricing Unit</label>
                <div className="relative">
                  <select
                    value={formData.pricingUnit || "PER_CONTAINER"}
                    onChange={(e) => handleChange("pricingUnit", e.target.value)}
                    className={`${selectBase} pr-8 appearance-none`}
                    disabled={saving}
                  >
                    {PRICING_UNITS.map((pu) => (
                      <option key={pu.value} value={pu.value}>
                        {pu.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                  />
                </div>
              </div>
              {showEquipmentFields && (
                <div>
                  <label className={labelBase}>Equipment</label>
                  <div className="relative">
                    <select
                      value={formData.equipmentType || ""}
                      onChange={(e) => handleChange("equipmentType", e.target.value)}
                      className={`${selectBase} pr-8 appearance-none`}
                      disabled={saving}
                    >
                      <option value="">Select</option>
                      {EQUIPMENT_TYPES.map((eq) => (
                        <option key={eq.value} value={eq.value}>
                          {eq.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transit & Free Time */}
          {showTransitFields && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                <Clock size={14} /> Transit & Free Time
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className={labelBase}>Free Time (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.freeTimeDays || ""}
                    onChange={(e) => handleChange("freeTimeDays", parseInt(e.target.value) || undefined)}
                    placeholder="21"
                    className={inputBase}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className={labelBase}>T/T Min (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.transitTimeDaysMin || ""}
                    onChange={(e) => handleChange("transitTimeDaysMin", parseInt(e.target.value) || undefined)}
                    placeholder="30"
                    className={inputBase}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className={labelBase}>T/T Max (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.transitTimeDaysMax || ""}
                    onChange={(e) => handleChange("transitTimeDaysMax", parseInt(e.target.value) || undefined)}
                    placeholder="40"
                    className={inputBase}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className={labelBase}>Carrier</label>
                  <input
                    type="text"
                    value={formData.carrierName || ""}
                    onChange={(e) => handleChange("carrierName", e.target.value)}
                    placeholder="e.g., Maersk"
                    className={inputBase}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-700 flex items-center gap-2">
              <FileText size={14} /> Notes
            </h3>
            <textarea
              value={formData.metadata?.notes || ""}
              onChange={(e) => handleChange("metadata", { ...formData.metadata, notes: e.target.value })}
              placeholder="e.g., Cancellation Fee USD300/CTN..."
              rows={2}
              className={`${inputBase} resize-none`}
              disabled={saving}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {isEdit ? "Update Item" : "Add Item"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// ITEM ROW COMPONENT
// =============================================================================

interface ItemRowProps {
  item: PricelistItem;
  onEdit: (item: PricelistItem) => void;
  onDelete: (itemId: string) => void;
  disabled: boolean;
  deleting: boolean;
}

const ItemRow: React.FC<ItemRowProps> = ({ item, onEdit, onDelete, disabled, deleting }) => {
  const chargeLabel = CHARGE_TYPES.find((c) => c.value === item.chargeType)?.label || item.chargeType;
  const routeLabel =
    item.lane?.originName && item.lane?.destinationName
      ? `${item.lane.originName} → ${item.lane.destinationName}`
      : null;

  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-neutral-900 truncate">
            {item.name}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
            {chargeLabel}
          </span>
          {item.equipmentType && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
              {item.equipmentType}
            </span>
          )}
        </div>
        {routeLabel && <p className="text-xs text-neutral-500 mt-1">{routeLabel}</p>}
        <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
          <span>{item.incoterm}</span>
          {item.freeTimeDays && <span>{item.freeTimeDays} days free</span>}
          {item.transitTimeDaysMin && item.transitTimeDaysMax && (
            <span>
              T/T: {item.transitTimeDaysMin}-{item.transitTimeDaysMax} days
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-neutral-900 whitespace-nowrap">
          {item.currency} {item.cost.toLocaleString()}
        </span>
        {!disabled && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(item)}
              disabled={deleting}
              className="p-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              disabled={deleting}
              className="p-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-500 hover:text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
              title="Delete"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// HISTORY MODAL COMPONENT
// =============================================================================

interface HistoryModalProps {
  supplierId: string;
  onClose: () => void;
  onViewPricelist: (pricelistId: string) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ supplierId, onClose, onViewPricelist }) => {
  const [history, setHistory] = useState<PricelistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await AgentPricingService.getPricelistHistory(supplierId, { limit: 20 });
        setHistory(response.pricelists);
      } catch (err: any) {
        console.error("Failed to load history:", err);
        setError(err?.response?.data?.message || "Failed to load history");
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [supplierId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={20} className="text-neutral-500" />
            <h2 className="text-lg font-semibold text-neutral-900">Pricelist History</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X size={20} className="text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">No history available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => {
                const badge = getStatusBadge(item.status);
                return (
                  <button
                    key={item.pricelistId}
                    type="button"
                    onClick={() => onViewPricelist(item.pricelistId)}
                    className="w-full text-left p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-neutral-900">
                        {formatWeekRange(item.weekStart, item.weekEnd)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.style}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <span>{item.itemCount} items</span>
                      <span>${item.totalCost.toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// PRICELIST DETAIL MODAL (Read-only view for history)
// =============================================================================

interface PricelistDetailModalProps {
  pricelistId: string;
  onClose: () => void;
}

const PricelistDetailModal: React.FC<PricelistDetailModalProps> = ({ pricelistId, onClose }) => {
  const [pricelist, setPricelist] = useState<Pricelist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPricelist = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await AgentPricingService.getPricelistById(pricelistId);
        setPricelist(response);
      } catch (err: any) {
        console.error("Failed to load pricelist:", err);
        setError(err?.response?.data?.message || "Failed to load pricelist");
      } finally {
        setLoading(false);
      }
    };
    loadPricelist();
  }, [pricelistId]);

  const badge = pricelist ? getStatusBadge(pricelist.status) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {pricelist ? formatWeekRange(pricelist.weekStart, pricelist.weekEnd) : "Pricelist Details"}
            </h2>
            {badge && (
              <span className={`inline-flex items-center mt-1 text-xs px-2 py-0.5 rounded-full border ${badge.style}`}>
                {badge.label}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X size={20} className="text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          ) : pricelist ? (
            <div className="space-y-3">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Items</p>
                  <p className="text-lg font-semibold text-neutral-900">{pricelist.itemCount}</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500">Total Cost</p>
                  <p className="text-lg font-semibold text-blue-600">${pricelist.totalCost.toLocaleString()}</p>
                </div>
              </div>

              {/* Rejection reason */}
              {pricelist.status === "rejected" && pricelist.rejectionReason && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 mb-4">
                  <p className="text-xs font-medium text-red-800">Rejection Reason</p>
                  <p className="text-sm text-red-700">{pricelist.rejectionReason}</p>
                </div>
              )}

              {/* Items */}
              {pricelist.items?.length > 0 ? (
                pricelist.items.map((item) => {
                  const chargeLabel = CHARGE_TYPES.find((c) => c.value === item.chargeType)?.label || item.chargeType;
                  const routeLabel = item.lane?.originName && item.lane?.destinationName
                    ? `${item.lane.originName} → ${item.lane.destinationName}`
                    : null;
                  return (
                    <div key={item.id} className="p-3 rounded-lg border border-neutral-200 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-neutral-900">{item.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                            {chargeLabel}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-neutral-900">
                          {item.currency} {item.cost.toLocaleString()}
                        </span>
                      </div>
                      {routeLabel && <p className="text-xs text-neutral-500 mt-1">{routeLabel}</p>}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-neutral-500 text-center py-4">No items</p>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AgentPriceMaintenanceScreen() {
  const navigate = useNavigate();
  const { supplierId: urlSupplierId } = useParams<{ supplierId?: string }>();
  // State
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [ports, setPorts] = useState<PortOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(urlSupplierId || null);
  const [pricelist, setPricelist] = useState<Pricelist | null>(null);
  const [, setPricelistExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingPricelist, setLoadingPricelist] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal state
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PricelistItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [viewingPricelistId, setViewingPricelistId] = useState<string | null>(null);

  // Load suppliers
  useEffect(() => {
    const loadSuppliers = async () => {
      setLoading(true);
      setError(null);
      try {
        const [suppliersResponse, portsResponse] = await Promise.all([
          AgentPricingService.listSuppliers({ limit: 50 }),
          AgentPricingService.getPorts(),
        ]);
        setSuppliers(suppliersResponse.data);
        setPorts(portsResponse.filter((p) => p.unlocode && p.name).map((p) => ({ code: p.unlocode!, name: p.name })));

        // Auto-select if only one supplier or if URL has supplierId
        if (urlSupplierId) {
          setSelectedSupplierId(urlSupplierId);
        } else if (suppliersResponse.data.length === 1) {
          setSelectedSupplierId(suppliersResponse.data[0].supplierId);
        }
      } catch (err: any) {
        console.error("Failed to load suppliers:", err);
        setError(err?.response?.data?.message || "Failed to load suppliers");
      } finally {
        setLoading(false);
      }
    };

    loadSuppliers();
  }, [urlSupplierId]);

  // Load pricelist when supplier is selected
  useEffect(() => {
    if (!selectedSupplierId) {
      setPricelist(null);
      setPricelistExists(false);
      return;
    }

    const loadPricelist = async () => {
      setLoadingPricelist(true);
      setError(null);
      try {
        const response = await AgentPricingService.getPricelist(selectedSupplierId);
        setPricelist(response);
        setPricelistExists(true);
      } catch (err: any) {
        // 404 means no pricelist exists yet - that's OK, we start with empty
        if (err?.response?.status === 404) {
          setPricelist(null);
          setPricelistExists(false);
        } else {
          console.error("Failed to load pricelist:", err);
          setError(err?.response?.data?.message || "Failed to load pricelist");
        }
      } finally {
        setLoadingPricelist(false);
      }
    };

    loadPricelist();
  }, [selectedSupplierId]);

  // Check if pricelist belongs to the current week (Monday-based)
  const isCurrentWeek = useMemo(() => {
    if (!pricelist?.weekStart) return false;
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun, 1=Mon...
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const currentWeekStart = new Date(now);
    currentWeekStart.setUTCDate(now.getUTCDate() + diffToMonday);
    currentWeekStart.setUTCHours(0, 0, 0, 0);
    const pricelistWeekStart = new Date(pricelist.weekStart);
    pricelistWeekStart.setUTCHours(0, 0, 0, 0);
    return pricelistWeekStart.getTime() === currentWeekStart.getTime();
  }, [pricelist?.weekStart]);

  // Editable only when pricelist belongs to the current week AND is in draft/rejected status.
  // A past-week pricelist is always read-only; the agent should start a fresh one.
  const isEditable =
    isCurrentWeek &&
    (!pricelist?.status ||
      pricelist.status === "draft" ||
      pricelist.status === "rejected");

  // True when there is a pricelist loaded but it belongs to a previous week
  const isPastWeek = !!pricelist && !isCurrentWeek;

  // Get selected supplier info
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.supplierId === selectedSupplierId),
    [suppliers, selectedSupplierId]
  );

  // Handlers
  const handleBack = useCallback(() => navigate("/agent"), [navigate]);

  const handleSupplierSelect = useCallback((supplierId: string) => {
    setSelectedSupplierId(supplierId);
    setError(null);
    setSuccess(null);
  }, []);

  const handleAddItem = useCallback(() => {
    setEditingItem(null);
    setItemError(null);
    setShowItemModal(true);
  }, []);

  const handleEditItem = useCallback((item: PricelistItem) => {
    setEditingItem(item);
    setItemError(null);
    setShowItemModal(true);
  }, []);

  const handleSaveItem = useCallback(
    async (itemDto: PricelistItemDto, existingId?: string) => {
      if (!selectedSupplierId) return;

      setSavingItem(true);
      setItemError(null);

      try {
        let response: Pricelist;

        if (existingId) {
          // Update existing item
          response = await AgentPricingService.updateItem(selectedSupplierId, existingId, itemDto);
        } else {
          // Add new item (this creates pricelist if doesn't exist)
          response = await AgentPricingService.addItem(selectedSupplierId, itemDto);
        }

        setPricelist(response);
        setPricelistExists(true);
        setShowItemModal(false);
        setEditingItem(null);
        setSuccess(existingId ? "Item updated successfully" : "Item added successfully");
        setTimeout(() => setSuccess(null), 3000);
      } catch (err: any) {
        console.error("Failed to save item:", err);
        const message = err?.response?.data?.message || "Failed to save item";
        setItemError(message);
      } finally {
        setSavingItem(false);
      }
    },
    [selectedSupplierId]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (!selectedSupplierId) return;

      if (!window.confirm("Are you sure you want to delete this item?")) {
        return;
      }

      setDeleting(true);
      setError(null);

      try {
        const response = await AgentPricingService.deleteItem(selectedSupplierId, itemId);
        setPricelist(response);
        setSuccess("Item deleted successfully");
        setTimeout(() => setSuccess(null), 3000);
      } catch (err: any) {
        console.error("Failed to delete item:", err);
        setError(err?.response?.data?.message || "Failed to delete item");
      } finally {
        setDeleting(false);
      }
    },
    [selectedSupplierId]
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedSupplierId || !pricelist?.items?.length) return;

    setSubmitting(true);
    setError(null);
    setShowSubmitConfirm(false);

    try {
      const response = await AgentPricingService.submitPricelist(selectedSupplierId);
      setPricelist(response);
      setSuccess("Pricelist submitted for approval!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Failed to submit pricelist:", err);
      setError(err?.response?.data?.message || "Failed to submit pricelist");
    } finally {
      setSubmitting(false);
    }
  }, [selectedSupplierId, pricelist]);

  // Stats
  const stats = useMemo(() => {
    if (!pricelist) return { totalItems: 0, totalCost: 0 };
    const totalItems = pricelist.items?.length || 0;
    const totalCost = pricelist.items?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
    return { totalItems, totalCost };
  }, [pricelist]);

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] overflow-auto bg-white text-neutral-900 p-4 sm:p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
          <p className="text-sm text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  // No suppliers
  if (suppliers.length === 0) {
    return (
      <div className="h-[calc(100vh-56px)] overflow-auto bg-white text-neutral-900 p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">No Suppliers Assigned</h2>
          <p className="text-sm text-neutral-500 mb-4">
            You don't have any suppliers assigned to your account. Please contact your administrator.
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge(pricelist?.status);

  return (
    <div className="h-[calc(100vh-56px)] overflow-auto bg-white text-neutral-900 p-4 sm:p-6 pb-24">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <Ship className="w-5 h-5 text-neutral-400 flex-shrink-0 hidden sm:block" />
              <h1 className="text-[20px] sm:text-[24px] font-semibold text-neutral-900 truncate">
                Price Maintenance
              </h1>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge.style}`}
          >
            {statusBadge.label}
          </span>
        </div>

        {/* Supplier Selector (if multiple) */}
        {suppliers.length > 1 && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-neutral-700">Supplier:</label>
            <div className="relative flex-1 max-w-xs">
              <select
                value={selectedSupplierId || ""}
                onChange={(e) => handleSupplierSelect(e.target.value)}
                className={`${selectBase} pr-8 appearance-none`}
              >
                <option value="">Select a supplier</option>
                {suppliers.map((s) => (
                  <option key={s.supplierId} value={s.supplierId}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
              />
            </div>
          </div>
        )}

        {/* Week info and History */}
        {selectedSupplierId && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Calendar size={14} />
              {pricelist
                ? <span>{isPastWeek ? "Last pricelist: " : "Current week: "}{formatWeekRange(pricelist.weekStart, pricelist.weekEnd)}</span>
                : <span>No pricelist this week yet</span>
              }
            </div>
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <History size={14} />
              <span>History</span>
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-700 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Rejection Reason */}
      {pricelist?.status === "rejected" && pricelist.rejectionReason && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Rejection Reason</p>
              <p className="text-sm text-red-700 mt-0.5">{pricelist.rejectionReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {!selectedSupplierId ? (
        <div className="text-center py-12">
          <Ship className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">Select a supplier to manage prices</p>
        </div>
      ) : loadingPricelist ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Supplier Info */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Supplier</h2>
            </div>
            <div className="p-3 sm:p-5 bg-white">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Ship className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">
                    {selectedSupplier?.name || "Unknown Supplier"}
                  </h3>
                </div>
              </div>
            </div>
          </section>

          {/* Past-week banner: the loaded pricelist is from a previous week */}
          {isPastWeek && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">New week — no pricelist yet</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    The pricelist below is from {formatWeekRange(pricelist!.weekStart, pricelist!.weekEnd)} (previous week) and is read-only.
                    Create a new one for this week using the button below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={submitting || deleting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors flex-shrink-0 disabled:opacity-50"
              >
                <Plus size={15} />
                New Pricelist
              </button>
            </div>
          )}

          {/* Stats — only show for current week */}
          {isCurrentWeek && pricelist && pricelist.items?.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4">
                <p className="text-xs text-neutral-500">Total Items</p>
                <p className="text-xl sm:text-2xl font-semibold text-neutral-900 mt-1">
                  {stats.totalItems}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4">
                <p className="text-xs text-neutral-500">Total Cost</p>
                <p className="text-xl sm:text-2xl font-semibold text-blue-600 mt-1">
                  ${stats.totalCost.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Items */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900">
                  {isPastWeek ? `Previous Pricelist — ${formatWeekRange(pricelist!.weekStart, pricelist!.weekEnd)}` : "Pricelist Items"}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
                  {pricelist?.items?.length || 0} items{isPastWeek ? " (read-only)" : ""}
                </p>
              </div>
              {isEditable && (
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={submitting || deleting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors self-start sm:self-auto disabled:opacity-50"
                >
                  <Plus size={14} />
                  <span>Add Item</span>
                </button>
              )}
            </div>
            <div className="p-3 sm:p-5 bg-white space-y-2">
              {!pricelist || !pricelist.items?.length ? (
                <div className="text-center py-8">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-neutral-100 mx-auto mb-3">
                    <Package className="w-6 h-6 text-neutral-400" />
                  </div>
                  <p className="text-sm text-neutral-500 mb-3">
                    No pricelist for this week yet. Add your first item to create one.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
                  >
                    <Plus size={16} />
                    Add First Item
                  </button>
                </div>
              ) : (
                pricelist.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onEdit={handleEditItem}
                    onDelete={handleDeleteItem}
                    disabled={!isEditable || submitting}
                    deleting={deleting}
                  />
                ))
              )}
            </div>
          </section>

          {/* Spacer */}
          <div className="h-24"></div>
        </div>
      )}

      {/* Sticky Footer */}
      {selectedSupplierId && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 shadow-lg"
          style={{ zIndex: 100 }}
        >
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {isEditable && pricelist?.items?.length ? (
              showSubmitConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-600">Submit for approval?</span>
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirm(false)}
                    disabled={submitting}
                    className="px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Confirm</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={submitting || deleting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                  <span>Submit for Approval</span>
                </button>
              )
            ) : null}

            {isCurrentWeek && pricelist?.status === "submitted" && (
              <span className="text-sm text-neutral-500 flex items-center gap-2">
                <Clock size={16} />
                Waiting for approval...
              </span>
            )}

            {isCurrentWeek && pricelist?.status === "approved" && (
              <span className="text-sm text-green-600 flex items-center gap-2">
                <CheckCircle2 size={16} />
                Approved
              </span>
            )}
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <ItemFormModal
          item={editingItem ? itemToDto(editingItem) : null}
          existingId={editingItem?.id}
          onSave={handleSaveItem}
          onClose={() => {
            setShowItemModal(false);
            setEditingItem(null);
            setItemError(null);
          }}
          saving={savingItem}
          error={itemError}
          ports={ports}
        />
      )}

      {/* History Modal */}
      {showHistoryModal && selectedSupplierId && (
        <HistoryModal
          supplierId={selectedSupplierId}
          onClose={() => setShowHistoryModal(false)}
          onViewPricelist={(pricelistId) => {
            setShowHistoryModal(false);
            setViewingPricelistId(pricelistId);
          }}
        />
      )}

      {/* Pricelist Detail Modal */}
      {viewingPricelistId && (
        <PricelistDetailModal
          pricelistId={viewingPricelistId}
          onClose={() => setViewingPricelistId(null)}
        />
      )}
    </div>
  );
}