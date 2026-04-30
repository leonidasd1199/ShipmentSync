import { useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DataTable, type DataTableFilterMeta } from "primereact/datatable";
import { Column } from "primereact/column";
import { FilterMatchMode } from "primereact/api";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

type PriceItem = {
  _id: string;
  pol: string; // Port of Loading
  pod: string; // Port of Discharge
  containerSize: "20GP" | "40GP" | "40HQ" | "45HQ";
  price: number;
  currency: string;
  freeTime: number; // days
  transitTime: string;
  validFrom: string;
  validTo: string;
  notes?: string;
  incoterm: string;
};

type MockSupplier = {
  _id: string;
  name: string;
  email: string;
};

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_SUPPLIERS: Record<string, MockSupplier> = {
  "supplier-001": { _id: "supplier-001", name: "MSC Mediterranean Shipping", email: "rates@msc.com" },
  "supplier-002": { _id: "supplier-002", name: "CMA CGM", email: "pricing@cma-cgm.com" },
  "supplier-003": { _id: "supplier-003", name: "Hapag-Lloyd", email: "rates@hapag-lloyd.com" },
  "supplier-004": { _id: "supplier-004", name: "COSCO Shipping", email: "sales@cosco.com" },
  "supplier-005": { _id: "supplier-005", name: "OOCL", email: "rates@oocl.com" },
};

const MOCK_PRICES: PriceItem[] = [
  {
    _id: "price-001",
    pol: "Ningbo",
    pod: "Puerto Cortes",
    containerSize: "20GP",
    price: 2100,
    currency: "USD",
    freeTime: 21,
    transitTime: "35-40 days",
    validFrom: "2026-01-05",
    validTo: "2026-01-11",
    notes: "Cancellation Fee: USD300/CTN",
    incoterm: "FOB",
  },
  {
    _id: "price-002",
    pol: "Ningbo",
    pod: "Puerto Cortes",
    containerSize: "40HQ",
    price: 2250,
    currency: "USD",
    freeTime: 21,
    transitTime: "35-40 days",
    validFrom: "2026-01-05",
    validTo: "2026-01-11",
    notes: "Cancellation Fee: USD300/CTN",
    incoterm: "FOB",
  },
  {
    _id: "price-003",
    pol: "Qingdao",
    pod: "Puerto Cortes",
    containerSize: "20GP",
    price: 2450,
    currency: "USD",
    freeTime: 21,
    transitTime: "42 days",
    validFrom: "2026-01-01",
    validTo: "2026-01-07",
    notes: "Including PCS (USD297)",
    incoterm: "FOB",
  },
  {
    _id: "price-004",
    pol: "Qingdao",
    pod: "Puerto Cortes",
    containerSize: "40HQ",
    price: 2700,
    currency: "USD",
    freeTime: 21,
    transitTime: "42 days",
    validFrom: "2026-01-01",
    validTo: "2026-01-07",
    notes: "Including PCS (USD297)",
    incoterm: "FOB",
  },
  {
    _id: "price-005",
    pol: "Yantian",
    pod: "Puerto Cortes",
    containerSize: "20GP",
    price: 2624,
    currency: "USD",
    freeTime: 21,
    transitTime: "60 days",
    validFrom: "2026-01-01",
    validTo: "2026-01-07",
    incoterm: "CIF",
  },
  {
    _id: "price-006",
    pol: "Shanghai",
    pod: "Puerto Cortes",
    containerSize: "40HQ",
    price: 2824,
    currency: "USD",
    freeTime: 14,
    transitTime: "55 days",
    validFrom: "2026-01-01",
    validTo: "2026-01-15",
    incoterm: "CIF",
  },
];

const CONTAINER_SIZES = ["20GP", "40GP", "40HQ", "45HQ"] as const;
const INCOTERMS = ["FOB", "CIF", "CFR", "EXW", "DDP", "DAP"] as const;
const CURRENCIES = ["USD", "EUR", "CNY"] as const;

// =============================================================================
// PRICE FORM MODAL
// =============================================================================

type PriceFormData = {
  pol: string;
  pod: string;
  containerSize: string;
  price: string;
  currency: string;
  freeTime: string;
  transitTime: string;
  validFrom: string;
  validTo: string;
  notes: string;
  incoterm: string;
};

const getEmptyForm = (): PriceFormData => ({
  pol: "",
  pod: "",
  containerSize: "40HQ",
  price: "",
  currency: "USD",
  freeTime: "21",
  transitTime: "",
  validFrom: "",
  validTo: "",
  notes: "",
  incoterm: "FOB",
});

const inputBase =
  "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400 transition-all";

const selectBase =
  "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400 transition-all";

const labelBase = "mb-1 block text-xs sm:text-sm font-medium text-neutral-700";

interface PriceFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialData?: PriceItem | null;
  onClose: () => void;
  onSave: (data: PriceFormData) => Promise<void>;
}

function PriceFormModal({ open, mode, initialData, onClose, onSave }: PriceFormModalProps) {
  const [form, setForm] = useState<PriceFormData>(() => {
    if (initialData) {
      return {
        pol: initialData.pol,
        pod: initialData.pod,
        containerSize: initialData.containerSize,
        price: String(initialData.price),
        currency: initialData.currency,
        freeTime: String(initialData.freeTime),
        transitTime: initialData.transitTime,
        validFrom: initialData.validFrom,
        validTo: initialData.validTo,
        notes: initialData.notes || "",
        incoterm: initialData.incoterm,
      };
    }
    return getEmptyForm();
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof PriceFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.pol.trim()) {
      setError("Port of Loading is required");
      return;
    }
    if (!form.pod.trim()) {
      setError("Port of Discharge is required");
      return;
    }
    if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
      setError("Valid price is required");
      return;
    }
    if (!form.validFrom) {
      setError("Valid from date is required");
      return;
    }
    if (!form.validTo) {
      setError("Valid to date is required");
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save price";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            {mode === "create" ? "Add New Price" : "Edit Price"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X size={20} className="text-neutral-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* POL */}
            <div>
              <label className={labelBase}>
                Port of Loading (POL) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.pol}
                onChange={(e) => handleChange("pol", e.target.value)}
                placeholder="e.g., Ningbo"
                className={inputBase}
              />
            </div>

            {/* POD */}
            <div>
              <label className={labelBase}>
                Port of Discharge (POD) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.pod}
                onChange={(e) => handleChange("pod", e.target.value)}
                placeholder="e.g., Puerto Cortes"
                className={inputBase}
              />
            </div>

            {/* Container Size */}
            <div>
              <label className={labelBase}>Container Size</label>
              <select
                value={form.containerSize}
                onChange={(e) => handleChange("containerSize", e.target.value)}
                className={selectBase}
              >
                {CONTAINER_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* Incoterm */}
            <div>
              <label className={labelBase}>Incoterm</label>
              <select
                value={form.incoterm}
                onChange={(e) => handleChange("incoterm", e.target.value)}
                className={selectBase}
              >
                {INCOTERMS.map((inc) => (
                  <option key={inc} value={inc}>
                    {inc}
                  </option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div>
              <label className={labelBase}>
                Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => handleChange("price", e.target.value)}
                placeholder="0.00"
                className={inputBase}
              />
            </div>

            {/* Currency */}
            <div>
              <label className={labelBase}>Currency</label>
              <select
                value={form.currency}
                onChange={(e) => handleChange("currency", e.target.value)}
                className={selectBase}
              >
                {CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>
            </div>

            {/* Free Time */}
            <div>
              <label className={labelBase}>Free Time (days)</label>
              <input
                type="number"
                min="0"
                value={form.freeTime}
                onChange={(e) => handleChange("freeTime", e.target.value)}
                placeholder="21"
                className={inputBase}
              />
            </div>

            {/* Transit Time */}
            <div>
              <label className={labelBase}>Transit Time</label>
              <input
                type="text"
                value={form.transitTime}
                onChange={(e) => handleChange("transitTime", e.target.value)}
                placeholder="e.g., 35-40 days"
                className={inputBase}
              />
            </div>

            {/* Valid From */}
            <div>
              <label className={labelBase}>
                Valid From <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => handleChange("validFrom", e.target.value)}
                className={inputBase}
              />
            </div>

            {/* Valid To */}
            <div>
              <label className={labelBase}>
                Valid To <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.validTo}
                onChange={(e) => handleChange("validTo", e.target.value)}
                className={inputBase}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelBase}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional notes (optional)"
              rows={3}
              className={`${inputBase} resize-none`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-200 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{mode === "create" ? "Add Price" : "Save Changes"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DELETE CONFIRMATION MODAL
// =============================================================================

interface DeleteConfirmModalProps {
  open: boolean;
  price: PriceItem | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function DeleteConfirmModal({ open, price, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  if (!open || !price) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Delete Price</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Are you sure you want to delete the price for{" "}
              <strong>
                {price.pol} → {price.pod}
              </strong>{" "}
              ({price.containerSize})? This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AgentSupplierPriceDetailScreen() {
  const navigate = useNavigate();
  const { supplierId } = useParams<{ supplierId: string }>();

  // Mock data - replace with API calls
  const supplier = supplierId ? MOCK_SUPPLIERS[supplierId] : null;
  const [prices, setPrices] = useState<PriceItem[]>(MOCK_PRICES);
  const [isLoading] = useState(false);

  // UI State
  const [global, setGlobal] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: "", matchMode: FilterMatchMode.CONTAINS },
  });

  const [showForm, setShowForm] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PriceItem | null>(null);
  const [deletingPrice, setDeletingPrice] = useState<PriceItem | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onGlobalChange = (value: string) => {
    setGlobal(value);
    setFilters((prev) => ({
      ...prev,
      global: { ...prev.global, value },
    }));
  };

  // Handlers
  const handleCreate = useCallback(() => {
    setEditingPrice(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((price: PriceItem) => {
    setEditingPrice(price);
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingPrice(null);
  }, []);

  const handleSave = useCallback(
    async (data: PriceFormData) => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (editingPrice) {
        // Update existing
        setPrices((prev) =>
          prev.map((p) =>
            p._id === editingPrice._id
              ? {
                  ...p,
                  pol: data.pol,
                  pod: data.pod,
                  containerSize: data.containerSize as PriceItem["containerSize"],
                  price: parseFloat(data.price),
                  currency: data.currency,
                  freeTime: parseInt(data.freeTime, 10),
                  transitTime: data.transitTime,
                  validFrom: data.validFrom,
                  validTo: data.validTo,
                  notes: data.notes,
                  incoterm: data.incoterm,
                }
              : p
          )
        );
        setSuccess("Price updated successfully");
      } else {
        // Create new
        const newPrice: PriceItem = {
          _id: `price-${Date.now()}`,
          pol: data.pol,
          pod: data.pod,
          containerSize: data.containerSize as PriceItem["containerSize"],
          price: parseFloat(data.price),
          currency: data.currency,
          freeTime: parseInt(data.freeTime, 10),
          transitTime: data.transitTime,
          validFrom: data.validFrom,
          validTo: data.validTo,
          notes: data.notes,
          incoterm: data.incoterm,
        };
        setPrices((prev) => [newPrice, ...prev]);
        setSuccess("Price added successfully");
      }

      setTimeout(() => setSuccess(null), 3000);
    },
    [editingPrice]
  );

  const handleDelete = useCallback(async () => {
    if (!deletingPrice) return;

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    setPrices((prev) => prev.filter((p) => p._id !== deletingPrice._id));
    setSuccess("Price deleted successfully");
    setTimeout(() => setSuccess(null), 3000);
  }, [deletingPrice]);

  // Format currency
  const formatPrice = useMemo(
    () => (price: number, currency: string) =>
      price.toLocaleString("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    []
  );

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (!supplier) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center bg-white">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Supplier Not Found</h2>
          <p className="text-sm text-neutral-500 mb-4">
            The supplier you're looking for doesn't exist.
          </p>
          <button
            type="button"
            onClick={() => navigate("/agent/price-maintenance")}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Suppliers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/agent/price-maintenance")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            title="Back to Suppliers"
            aria-label="Back to Suppliers"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-[24px] font-semibold truncate">{supplier.name}</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Manage price list</p>
          </div>
        </div>

        <div className="flex flex-col w-full sm:w-auto sm:flex-row sm:items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={global}
              onChange={(e) => onGlobalChange(e.target.value)}
              placeholder="Search prices..."
              className="block w-full pl-9 pr-3 rounded-lg border border-neutral-300 bg-white py-2 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            <Plus size={16} />
            <span>Add Price</span>
          </button>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm -mx-2 sm:mx-0 overflow-x-auto">
        <DataTable
          value={prices}
          loading={isLoading}
          size="small"
          showGridlines
          className="text-sm min-w-0"
          filters={filters}
          filterDisplay="menu"
          globalFilterFields={["pol", "pod", "containerSize", "incoterm", "notes"]}
          emptyMessage={
            <div className="py-8 text-center text-sm text-neutral-500">
              No prices found. Click "Add Price" to create one.
            </div>
          }
          pt={{
            root: { className: "rounded-xl overflow-hidden" },
            table: { className: "bg-white" },
            header: { className: "!bg-white !border-0" },
            thead: { className: "!bg-white" },
          }}
        >
          <Column
            field="pol"
            header="POL"
            sortable
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: PriceItem) => (
              <span className="font-medium text-neutral-900">{row.pol}</span>
            )}
            bodyClassName="!py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px", paddingLeft: "16px" }}
            bodyStyle={{ paddingLeft: "16px" }}
            style={{ width: "12%" }}
          />

          <Column
            field="pod"
            header="POD"
            sortable
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: PriceItem) => <span className="text-neutral-700">{row.pod}</span>}
            bodyClassName="!py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "12%" }}
          />

          <Column
            field="containerSize"
            header="Size"
            sortable
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: PriceItem) => (
              <span className="inline-flex px-2 py-0.5 rounded bg-neutral-100 text-xs font-medium text-neutral-700">
                {row.containerSize}
              </span>
            )}
            bodyClassName="!py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "8%" }}
          />

          <Column
            field="incoterm"
            header="Incoterm"
            sortable
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: PriceItem) => (
              <span className="inline-flex px-2 py-0.5 rounded bg-blue-50 text-xs font-medium text-blue-700">
                {row.incoterm}
              </span>
            )}
            bodyClassName="!py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "8%" }}
          />

          <Column
            field="price"
            header="Price"
            sortable
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: PriceItem) => (
              <span className="font-semibold text-neutral-900">
                {formatPrice(row.price, row.currency)}
              </span>
            )}
            bodyClassName="!py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "10%" }}
          />

          <Column
            field="freeTime"
            header="Free Time"
            sortable
            className="hidden md:table-cell"
            headerClassName="hidden md:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: PriceItem) => (
              <span className="text-neutral-600">{row.freeTime} days</span>
            )}
            bodyClassName="hidden md:table-cell !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "8%" }}
          />

          <Column
            field="transitTime"
            header="Transit"
            className="hidden lg:table-cell"
            headerClassName="hidden lg:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: PriceItem) => (
              <span className="text-neutral-600">{row.transitTime || "—"}</span>
            )}
            bodyClassName="hidden lg:table-cell !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "10%" }}
          />

          <Column
            header="Validity"
            className="hidden sm:table-cell"
            headerClassName="hidden sm:table-cell !bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            body={(row: PriceItem) => (
              <span className="text-xs text-neutral-600">
                {formatDate(row.validFrom)} - {formatDate(row.validTo)}
              </span>
            )}
            bodyClassName="hidden sm:table-cell !py-2 sm:!py-3"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "12%" }}
          />

          <Column
            header="Actions"
            headerClassName="!bg-[#F8FAFC] !text-neutral-700 !font-semibold"
            bodyClassName="!py-2 sm:!py-3 !px-2 sm:!px-4"
            headerStyle={{ paddingTop: "14px", paddingBottom: "14px" }}
            style={{ width: "10%" }}
            body={(row: PriceItem) => (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(row)}
                  className="inline-flex items-center justify-center border border-neutral-300 bg-white h-7 w-7 sm:h-8 sm:w-8 p-0 leading-none hover:bg-neutral-50 rounded-md"
                  aria-label="Edit price"
                  title="Edit"
                >
                  <Pencil size={14} className="text-neutral-700" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingPrice(row)}
                  className="inline-flex items-center justify-center border border-red-300 bg-white h-7 w-7 sm:h-8 sm:w-8 p-0 leading-none hover:bg-red-50 rounded-md"
                  aria-label="Delete price"
                  title="Delete"
                >
                  <Trash2 size={14} className="text-red-600" />
                </button>
              </div>
            )}
          />
        </DataTable>
      </div>

      {/* Footer */}
      <div className="mt-4 text-center sm:text-right">
        <p className="text-xs text-neutral-500">{prices.length} price(s) total</p>
      </div>

      {/* Modals */}
      <PriceFormModal
        open={showForm}
        mode={editingPrice ? "edit" : "create"}
        initialData={editingPrice}
        onClose={handleCloseForm}
        onSave={handleSave}
      />

      <DeleteConfirmModal
        open={!!deletingPrice}
        price={deletingPrice}
        onClose={() => setDeletingPrice(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}