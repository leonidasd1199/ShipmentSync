/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from 'uuid';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  memo,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import classNames from "classnames";
import { Calendar } from "primereact/calendar";
import {
  ArrowLeft,
  Trash2,
  ChevronDown,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Plus,
  Ship,
  Plane,
  Truck,
  Shield,
  FileCheck,
  Package,
  Info,
  Search,
  X,
  Eye,
  EyeOff,
} from "lucide-react";

import { useQuotationHelpers } from "../hooks/useQuotationsHelpers";
import { useQuotations } from "../hooks/useQuotations";
import { QuotationsService } from "../services/quotations.service";
import { ShippingsService } from "../services/shipping.service";
import { TemplatesService } from "../services/templates.service";
import { PortsService } from "../services/ports.service";
import type {
  CreateQuotationDto,
  UpdateQuotationDto,
  QuotationResponse,
} from "../utils/types/quotation.type";
import type { Port } from "../utils/types/port.type";
import { TransitTypeEnum, QuotationStatusEnum } from "../utils/constants";
import { useAuthStore } from "../stores/auth.store";
import type { Template } from "../utils/types/template.type";

// =============================================================================
// TYPES
// =============================================================================

type QuotationAgentHelper = {
  _id: string;
  name: string;
  shippingLineId: string;
};

type QuotationItemForm = {
  itemId?: string;
  type: "cargo" | "custom";
  description: string;
  price: string;
  quantity: string;
  discount: string;
  notes: string;
  transitType: TransitTypeEnum | "";
  applyTemplateDiscount?: boolean;
  applyTaxes?: boolean;
  taxRate?: number | null;
};

type HeaderFieldValue = {
  fieldId: string;
  label: string;
  value: string;
  inputType?: string;
};

type EquipmentItemValue = {
  equipmentId: string;
  label: string;
  fieldValues: { key: string; value: string }[];
  price?: string;
  quantity?: string;
  discount?: string;
  applyTemplateDiscount?: boolean;
  applyTaxes?: boolean;
  taxRate?: number | null;
};

// =============================================================================
// CONSTANTS
// =============================================================================

const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  FCL: { label: "FCL Maritime", icon: <Ship size={18} /> },
  LCL: { label: "LCL", icon: <Package size={18} /> },
  AIR: { label: "Air Freight", icon: <Plane size={18} /> },
  FTL: { label: "FTL", icon: <Truck size={18} /> },
  INSURANCE: { label: "Cargo Insurance", icon: <Shield size={18} /> },
  CUSTOMS: { label: "Customs", icon: <FileCheck size={18} /> },
  "LOCAL_TRUCKING": { label: "Local Trucking", icon: <Truck size={18} /> },
  OTHER: { label: "Other", icon: <Package size={18} /> },
};

const SERVICE_TYPE_SHIPPING_MODE: Record<string, "maritime" | "air" | "road" | null> = {
  FCL: "maritime",
  LCL: "maritime",
  AIR: "air",
  FTL: "road",
  "LOCAL_TRUCKING": "road",
  CUSTOMS: null,
  INSURANCE: null,
  OTHER: null,
};

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "MXN", label: "MXN - Mexican Peso" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
  { value: "BRL", label: "BRL - Brazilian Real" },
  { value: "ARS", label: "ARS - Argentine Peso" },
  { value: "CLP", label: "CLP - Chilean Peso" },
  { value: "COP", label: "COP - Colombian Peso" },
  { value: "PEN", label: "PEN - Peruvian Sol" },
  { value: "HNL", label: "HNL - Lempiras" },
];

// =============================================================================
// STYLE CLASSES
// =============================================================================

const inputBase =
  "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const selectBase =
  "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400 transition-all";

const labelBase = "mb-1 block text-xs sm:text-sm font-medium text-neutral-700";

const checkboxBase = "h-4 w-4 appearance-none rounded border border-neutral-300 bg-white relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bf0077]/40 checked:bg-[#bf0077] checked:border-[#bf0077] checked:after:content-[''] checked:after:absolute checked:after:left-[5px] checked:after:top-[2px] checked:after:h-[9px] checked:after:w-[5px] checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white disabled:opacity-50 disabled:cursor-not-allowed";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getDefaultItem = (): QuotationItemForm[] => [
  {
    itemId: uuidv4(),
    type: "cargo",
    description: "",
    price: "",
    quantity: "1",
    discount: "0",
    notes: "",
    transitType: "" as TransitTypeEnum | "",
    applyTemplateDiscount: false,
    applyTaxes: false,
    taxRate: null,
  },
];

const getPortDisplayName = (port: any): string => {
  const parts = [port.name];
  if (port.unlocode) {
    parts.push(`(${port.unlocode})`);
  } else if (port.code) {
    parts.push(`(${port.code})`);
  }
  if (port.countryName) {
    parts.push(`- ${port.countryName}`);
  } else if (port.country) {
    parts.push(`- ${port.country}`);
  }
  return parts.join(" ");
};

const parseHeaderFieldDate = (value: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// =============================================================================
// SEARCHABLE PORT SELECT COMPONENT WITH CREATE PORT
// =============================================================================

interface SearchablePortSelectProps {
  value: string;
  onChange: (value: string) => void;
  ports: Port[];
  loading: boolean;
  disabled: boolean;
  placeholder: string;
  label: string;
  onPortCreated?: () => void | Promise<void>;
}

const MAX_SUGGESTIONS = 8;
const MIN_SEARCH_LENGTH = 2;

const searchPorts = (ports: Port[], term: string, maxResults: number): Port[] => {
  if (term.length < MIN_SEARCH_LENGTH) return [];

  const lowerTerm = term.toLowerCase();
  const results: Port[] = [];

  for (let i = 0; i < ports.length && results.length < maxResults; i++) {
    const port = ports[i] as any;
    const name = (port.name || "").toLowerCase();
    const code = (port.code || port.unlocode || "").toLowerCase();
    const country = (port.countryName || port.country || "").toLowerCase();

    if (name.includes(lowerTerm) || code.includes(lowerTerm) || country.includes(lowerTerm)) {
      results.push(port);
    }
  }

  return results;
};

const SearchablePortSelect = memo(function SearchablePortSelect({
  value,
  onChange,
  ports,
  loading,
  disabled,
  placeholder,
  label,
  onPortCreated,
}: SearchablePortSelectProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [newPortName, setNewPortName] = useState("");
  const [newPortCode, setNewPortCode] = useState("");
  const [newPortCountry, setNewPortCountry] = useState("");
  const [newPortModes, setNewPortModes] = useState<("maritime" | "air" | "road")[]>(["maritime"]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedPort = useMemo(() => {
    if (!value) return null;
    return ports.find((p: any) => (p.id || p._id) === value);
  }, [ports, value]);

  const suggestions = useMemo(() => {
    return searchPorts(ports, searchTerm, MAX_SUGGESTIONS);
  }, [ports, searchTerm]);

  useEffect(() => {
    if (isFocused && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isFocused, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    const handleScroll = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      }
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isFocused]);

  const handleSelect = useCallback((portId: string) => {
    onChange(portId);
    setIsFocused(false);
    setSearchTerm("");
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange("");
    setSearchTerm("");
    inputRef.current?.focus();
  }, [onChange]);

  const handleFocus = useCallback(() => {
    if (!disabled && !loading) {
      setIsFocused(true);
    }
  }, [disabled, loading]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        const firstPort = suggestions[0] as any;
        handleSelect(firstPort.id || firstPort._id);
      }
    } else if (e.key === "Escape") {
      setIsFocused(false);
      setSearchTerm("");
      inputRef.current?.blur();
    }
  }, [suggestions, handleSelect]);

  const openCreateModal = useCallback(() => {
    setNewPortName(searchTerm);
    setNewPortCode("");
    setNewPortCountry("");
    setNewPortModes(["maritime"]);
    setCreateError(null);
    setShowCreateModal(true);
    setIsFocused(false);
  }, [searchTerm]);

  const handleCreatePort = useCallback(async () => {
    if (!newPortName.trim()) {
      setCreateError("Port name is required");
      return;
    }
    if (!newPortCountry.trim()) {
      setCreateError("Country is required");
      return;
    }
    if (newPortModes.length === 0) {
      setCreateError("At least one transport mode is required");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      // Map the selected mode to the backend type
      const modeToType: Record<string, string> = {
        maritime: "sea",
        air: "air",
        road: "inland",
      };
      const portType = modeToType[newPortModes[0]] || "sea";

      const newPort = await PortsService.create({
        name: newPortName.trim(),
        code: newPortCode.trim() || newPortName.trim().substring(0, 5).toUpperCase(),
        country: newPortCountry.trim(),
        type: portType,
        isActive: true,
      } as any);

      // Get the port ID from the response
      const portId = newPort._id || (newPort as any).id;

      // Close modal and reset form first
      setShowCreateModal(false);
      setSearchTerm("");
      setNewPortName("");
      setNewPortCode("");
      setNewPortCountry("");
      setNewPortModes(["maritime"]);

      // Call the callback to reload the ports list
      if (onPortCreated) {
        await onPortCreated();
      }

      // Select the newly created port after the list is reloaded
      onChange(portId);
    } catch (error: any) {
      console.error("Failed to create port:", error);
      setCreateError(error?.response?.data?.message || error?.message || "Failed to create port. Please try again.");
    } finally {
      setCreating(false);
    }
  }, [newPortName, newPortCode, newPortCountry, newPortModes, onChange, onPortCreated]);

  const showSuggestions = isFocused && searchTerm.length > 0;
  const hasMinChars = searchTerm.length >= MIN_SEARCH_LENGTH;
  const noResults = hasMinChars && suggestions.length === 0;

  return (
    <div ref={containerRef} className="relative">
      <label className={labelBase}>{label}</label>

      <div className="relative">
        {loading ? (
          <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none animate-spin" />
        ) : (
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={isFocused ? searchTerm : (selectedPort ? getPortDisplayName(selectedPort) : "")}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "Loading ports..." : placeholder}
          disabled={disabled || loading}
          className={classNames(
            "w-full pl-9 pr-8 py-2 text-sm bg-white border border-neutral-300 rounded-lg",
            "focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400",
            "placeholder-neutral-400 transition-all",
            disabled && "opacity-50 cursor-not-allowed",
            loading && "opacity-70 cursor-wait",
            selectedPort && !isFocused && "text-neutral-900",
            !selectedPort && !isFocused && "text-neutral-400"
          )}
        />
        {(value || searchTerm) && !disabled && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
            style={{
              color: '#d4d4d4',
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#737373'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#d4d4d4'; }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showSuggestions && (
        <div
          className="fixed rounded-lg shadow-lg overflow-hidden"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999,
            backgroundColor: '#ffffff',
            border: '1px solid #e5e5e5',
          }}
        >
          {!hasMinChars ? (
            <div className="px-3 py-2 text-xs" style={{ color: '#a3a3a3', backgroundColor: '#ffffff' }}>
              Type {MIN_SEARCH_LENGTH - searchTerm.length} more character{MIN_SEARCH_LENGTH - searchTerm.length > 1 ? "s" : ""}...
            </div>
          ) : noResults ? (
            <div className="flex flex-col" style={{ backgroundColor: '#ffffff' }}>
              <div className="px-3 py-2 text-xs" style={{ color: '#737373', backgroundColor: '#ffffff' }}>
                No results for "<span className="font-medium">{searchTerm}</span>"
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="w-full px-3 py-2 text-left text-xs transition-colors flex items-center gap-2 border-t"
                style={{
                  color: '#0066cc',
                  backgroundColor: '#f8f9fa',
                  borderColor: '#e5e5e5',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e9ecef'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
              >
                <Plus size={14} />
                <span>Create new port: "{searchTerm}"</span>
              </button>
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto" style={{ backgroundColor: '#ffffff' }}>
              {suggestions.map((port: any, index) => {
                const portId = port.id || port._id;
                return (
                  <button
                    key={portId}
                    type="button"
                    onClick={() => handleSelect(portId)}
                    className="w-full px-3 py-1.5 text-left text-sm transition-colors flex items-center gap-2"
                    style={{
                      color: '#404040',
                      backgroundColor: index === 0 ? '#fafafa' : '#ffffff',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fafafa'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = index === 0 ? '#fafafa' : '#ffffff'; }}
                  >
                    <span className="truncate">{getPortDisplayName(port)}</span>
                    {index === 0 && (
                      <span
                        className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
                        style={{ color: '#a3a3a3', backgroundColor: '#f5f5f5' }}
                      >
                        Enter
                      </span>
                    )}
                  </button>
                );
              })}
              {suggestions.length >= MAX_SUGGESTIONS && (
                <div
                  className="px-3 py-1.5 text-[10px] border-t"
                  style={{ color: '#a3a3a3', backgroundColor: '#ffffff', borderColor: '#f5f5f5' }}
                >
                  Type more to refine results
                </div>
              )}
              <button
                type="button"
                onClick={openCreateModal}
                className="w-full px-3 py-2 text-left text-xs transition-colors flex items-center gap-2 border-t"
                style={{
                  color: '#0066cc',
                  backgroundColor: '#f8f9fa',
                  borderColor: '#e5e5e5',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e9ecef'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
              >
                <Plus size={14} />
                <span>Create new port</span>
              </button>
            </div>
          )}
        </div>
      )}

      {showCreateModal && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">Create New Port</h2>
              <p className="text-sm text-neutral-500 mt-1">Add a new port to the database</p>
            </div>

            <div className="p-5 space-y-4">
              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{createError}</p>
                </div>
              )}

              <div>
                <label className={labelBase}>Port Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newPortName}
                  onChange={(e) => setNewPortName(e.target.value)}
                  placeholder="e.g., Shanghai"
                  className={inputBase}
                  autoFocus
                />
              </div>

              <div>
                <label className={labelBase}>Port Code</label>
                <input
                  type="text"
                  value={newPortCode}
                  onChange={(e) => setNewPortCode(e.target.value.toUpperCase())}
                  placeholder="e.g., CNSHA (optional)"
                  className={inputBase}
                  maxLength={10}
                />
              </div>

              <div>
                <label className={labelBase}>Country <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newPortCountry}
                  onChange={(e) => setNewPortCountry(e.target.value)}
                  placeholder="e.g., China"
                  className={inputBase}
                />
              </div>

              <div>
                <label className={labelBase}>Port Type <span className="text-red-500">*</span></label>
                <select
                  value={newPortModes[0] || "maritime"}
                  onChange={(e) => setNewPortModes([e.target.value as "maritime" | "air" | "road"])}
                  className={selectBase}
                >
                  <option value="maritime">Sea Port</option>
                  <option value="air">Airport</option>
                  <option value="road">Inland Port / Road Terminal</option>
                </select>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-neutral-200 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePort}
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Create Port</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

// =============================================================================
// QUOTATION ITEM COMPONENT (Memoized for performance)
// =============================================================================

interface QuotationItemProps {
  item: QuotationItemForm;
  index: number;
  itemsLength: number;
  canEditItems: boolean;
  currency: string;
  onItemChange: (index: number, field: keyof QuotationItemForm, value: string | boolean | number | null) => void;
  onRemoveItem: (index: number) => void;
  calculateItemTotal: (item: QuotationItemForm) => number;
}

const QuotationItem = memo(function QuotationItem({
  item,
  index,
  itemsLength,
  canEditItems,
  currency,
  onItemChange,
  onRemoveItem,
  calculateItemTotal,
}: QuotationItemProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
        <span className="text-xs sm:text-sm font-medium text-neutral-700">Item #{index + 1}</span>
        {itemsLength > 1 && (
          <button
            type="button"
            onClick={() => onRemoveItem(index)}
            disabled={!canEditItems}
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-white bg-white border border-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Remove item"
            aria-label="Remove item"
          >
            <Trash2 size={16} className="text-neutral-500 hover:text-red-500" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="col-span-2 sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Description</label>
          <input
            id={`item-${index}-description`}
            value={item.description}
            onChange={(e) => onItemChange(index, "description", e.target.value)}
            maxLength={100}
            placeholder="Enter description"
            className={classNames(inputBase, "text-xs sm:text-sm")}
            disabled={!canEditItems}
          />
        </div>

        <div className="col-span-1">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Price</label>
          <input
            id={`item-${index}-price`}
            type="number"
            min="0"
            step="0.01"
            value={item.price}
            onChange={(e) => onItemChange(index, "price", e.target.value)}
            placeholder="0.00"
            className={classNames(inputBase, "text-xs sm:text-sm")}
            disabled={!canEditItems}
          />
        </div>

        <div className="col-span-1">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Quantity</label>
          <input
            id={`item-${index}-quantity`}
            type="number"
            min="0"
            step="0.01"
            value={item.quantity}
            onChange={(e) => onItemChange(index, "quantity", e.target.value)}
            placeholder="1"
            className={classNames(inputBase, "text-xs sm:text-sm")}
            disabled={!canEditItems}
          />
        </div>

        <div className="col-span-1">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Discount %</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={item.discount}
            onChange={(e) => onItemChange(index, "discount", e.target.value)}
            placeholder="0"
            className={classNames(inputBase, "text-xs sm:text-sm")}
            disabled={!canEditItems}
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Notes</label>
          <input
            value={item.notes}
            onChange={(e) => onItemChange(index, "notes", e.target.value)}
            placeholder="Optional"
            maxLength={100}
            className={classNames(inputBase, "text-xs sm:text-sm")}
            disabled={!canEditItems}
          />
        </div>

        <div className="col-span-2 flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={item.applyTaxes ?? false}
              onChange={(e) => onItemChange(index, "applyTaxes", e.target.checked)}
              className="h-3.5 w-3.5 appearance-none rounded border border-neutral-300 bg-white relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bf0077]/40 checked:bg-[#bf0077] checked:border-[#bf0077] checked:after:content-[''] checked:after:absolute checked:after:left-[4px] checked:after:top-[1px] checked:after:h-[8px] checked:after:w-[4px] checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white"
              disabled={!canEditItems}
            />
            <span>Apply tax</span>
          </label>
        </div>

        {item.applyTaxes && (
          <div className="col-span-1">
            <label className="mb-1 block text-xs font-medium text-neutral-600">Tax Rate %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={item.taxRate ?? ""}
              onChange={(e) => onItemChange(index, "taxRate", e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="0"
              className={classNames(inputBase, "text-xs sm:text-sm")}
              disabled={!canEditItems}
            />
          </div>
        )}
      </div>

      <div className="mt-3 sm:mt-4 flex justify-end">
        <div className="text-xs sm:text-sm text-neutral-700">
          <span className="font-medium">Item Total:</span>{" "}
          <span className="text-neutral-900 font-semibold">
            {calculateItemTotal(item).toLocaleString("en-US", {
              style: "currency",
              currency: currency || "USD",
            })}
          </span>
        </div>
      </div>
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const CreateEditQuotationPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const serviceTypeFromUrl = searchParams.get("serviceType") || "";
  const { user: currentUser } = useAuthStore();
  const companyId = (currentUser as any)?.company?._id ?? (currentUser as any)?.company?.id ?? null;

  const {
    clients,
    shippingLines,
    agents,
    isLoading: helpersLoading,
    refresh: refreshHelpers,
  } = useQuotationHelpers({ autoload: true });

  const { createQuotation, updateQuotation, getQuotation } = useQuotations({ autoload: false });

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  // Service configuration
  const [serviceType, setServiceType] = useState<string>(serviceTypeFromUrl);
  const [incoterms, setIncoterms] = useState<string[]>([]);
  const [shippingModes, setShippingModes] = useState<string[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [selectedIncoterm, setSelectedIncoterm] = useState<string>("");
  const [selectedShippingMode, setSelectedShippingMode] = useState<string>("");

  // Basic info
  const [clientId, setClientId] = useState<string>("");
  const [shippingLineId, setShippingLineId] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");

  // Route info
  const [ports, setPorts] = useState<Port[]>([]);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [originPortId, setOriginPortId] = useState<string>("");
  const [destinationPortId, setDestinationPortId] = useState<string>("");

  // Template
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [useTemplate, setUseTemplate] = useState<boolean>(false);
  const [headerFieldValues, setHeaderFieldValues] = useState<HeaderFieldValue[]>([]);
  const [equipmentItemValues, setEquipmentItemValues] = useState<EquipmentItemValue[]>([]);

  // Pricing
  const [currency, setCurrency] = useState<string>("USD");
  const [templateDiscount, setTemplateDiscount] = useState<string>("0");
  const [templateTaxRate, setTemplateTaxRate] = useState<string>("0");
  const [applyGlobalDiscount, setApplyGlobalDiscount] = useState<boolean>(false);
  const [applyGlobalTaxes, setApplyGlobalTaxes] = useState<boolean>(false);

  // Items
  const [items, setItems] = useState<QuotationItemForm[]>(getDefaultItem());

  // Additional details
  const [notes, setNotes] = useState<string>("");
  const [validUntil, setValidUntil] = useState<Date | null>(null);
  const [summarize, setSummarize] = useState<boolean>(true);
  const [status, setStatus] = useState<QuotationStatusEnum>(QuotationStatusEnum.Draft);

  // Visibility Settings
  const [showAgentToClient, setShowAgentToClient] = useState<boolean>(true);
  const [showCarrierToClient, setShowCarrierToClient] = useState<boolean>(true);
  const [showCommodityToClient, setShowCommodityToClient] = useState<boolean>(true);
  const [showNotesToClient, setShowNotesToClient] = useState<boolean>(true);

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data
  const [quotation, setQuotation] = useState<QuotationResponse | null>(null);
  const [modeSuppliers, setModeSuppliers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // ---------------------------------------------------------------------------
  // COMPUTED VALUES (Memoized)
  // ---------------------------------------------------------------------------

  const originalStatus = useMemo(() => {
    if (!isEdit || !quotation) return QuotationStatusEnum.Draft;
    return ((quotation as any).status as QuotationStatusEnum) ?? QuotationStatusEnum.Draft;
  }, [isEdit, quotation]);

  const isApprovedReadOnly = isEdit && originalStatus === QuotationStatusEnum.Accepted;
  // const requiresTemplate = !isEdit && useTemplate;

  // Check if service type has an auto-assigned shipping mode
  const serviceTypeHasAutoShippingMode = useMemo(() => {
    const mode = SERVICE_TYPE_SHIPPING_MODE[serviceType];
    return mode !== null && mode !== undefined;
  }, [serviceType]);

  // For service types without auto shipping mode, user must select manually
  const serviceTypeRequiresManualShippingMode = useMemo(() => {
    if (!serviceType) return false;
    const mode = SERVICE_TYPE_SHIPPING_MODE[serviceType];
    return mode === null;
  }, [serviceType]);

  // Legacy name kept for compatibility - true if shipping mode selection should be shown
  const serviceTypeRequiresShippingMode = serviceTypeRequiresManualShippingMode;

  const shippingModeLabel = useMemo(() => {
    if (!selectedShippingMode) return "";
    const labels: Record<string, string> = { maritime: "Maritime", air: "Air", road: "Road" };
    return labels[selectedShippingMode] || selectedShippingMode;
  }, [selectedShippingMode]);

  const statusOptions = useMemo(() => {
    if (!isEdit) return [QuotationStatusEnum.Draft];
    const optionsMap: Record<QuotationStatusEnum, QuotationStatusEnum[]> = {
      [QuotationStatusEnum.Draft]: [QuotationStatusEnum.Draft, QuotationStatusEnum.Sent],
      [QuotationStatusEnum.Sent]: [QuotationStatusEnum.Sent, QuotationStatusEnum.Accepted, QuotationStatusEnum.Rejected],
      [QuotationStatusEnum.Rejected]: [QuotationStatusEnum.Rejected, QuotationStatusEnum.Draft, QuotationStatusEnum.Accepted],
      [QuotationStatusEnum.Accepted]: [QuotationStatusEnum.Accepted],
      [QuotationStatusEnum.Expired]: [originalStatus],
    };
    return optionsMap[originalStatus] || [originalStatus];
  }, [isEdit, originalStatus]);

  const serviceTypeDisplay = useMemo(() => {
    return SERVICE_TYPE_CONFIG[serviceType] || { label: serviceType, icon: <Package size={18} /> };
  }, [serviceType]);

  const filteredAgents = useMemo(() => {
    return agents.filter((a: any) =>
      shippingLineId
        ? a.shippingLines?.some((s: any) => s._id === shippingLineId)
        : true
    );
  }, [agents, shippingLineId]);

  const filteredShippingLines = useMemo(() => {
    const source = modeSuppliers.length > 0 ? modeSuppliers : shippingLines;
    if (!selectedShippingMode) return source;

    const filtered = source.filter((s: any) => {
      if (!Array.isArray(s.shippingModes)) return false;
      if (s.shippingModes.includes(selectedShippingMode)) return true;

      // Alias matching for robustness
      if (selectedShippingMode === "maritime" && (s.shippingModes.includes("sea") || s.shippingModes.includes("ocean"))) return true;
      if (selectedShippingMode === "road" && (s.shippingModes.includes("land") || s.shippingModes.includes("truck") || s.shippingModes.includes("inland"))) return true;
      if (selectedShippingMode === "air" && s.shippingModes.includes("flight")) return true;

      return false;
    });

    if (isEdit && shippingLineId) {
      const currentInFiltered = filtered.some((s: any) => s._id === shippingLineId);
      if (!currentInFiltered) {
        const currentSupplier = source.find((s: any) => s._id === shippingLineId);
        if (currentSupplier) return [...filtered, currentSupplier];
      }
    }
    return filtered;
  }, [shippingLines, modeSuppliers, selectedShippingMode, serviceTypeRequiresShippingMode, isEdit, shippingLineId]);

  const canLoadTemplates = useMemo(() => {
    return Boolean(serviceType && selectedIncoterm && companyId && (!serviceTypeRequiresShippingMode || selectedShippingMode));
  }, [serviceType, selectedIncoterm, selectedShippingMode, serviceTypeRequiresShippingMode, companyId]);

  const canEditItems = useMemo(() => {
    return !isApprovedReadOnly;
  }, [isApprovedReadOnly]);

  const metadataReady = !loadingMetadata && shippingModes.length > 0 && (serviceType ? incoterms.length > 0 : true);

  // ---------------------------------------------------------------------------
  // CALCULATE ITEM TOTAL (Memoized callback)
  // ---------------------------------------------------------------------------

  const calculateItemTotal = useCallback((item: QuotationItemForm): number => {
    const price = parseFloat(item.price.replace(",", "."));
    const quantity = parseFloat(item.quantity.replace(",", "."));
    const discount = parseFloat(item.discount.replace(",", "."));

    if (!Number.isFinite(price) || !Number.isFinite(quantity)) return 0;

    let subtotal = price * quantity;
    if (Number.isFinite(discount) && discount > 0) {
      subtotal = subtotal * (1 - discount / 100);
    }
    if (
      item.applyTaxes &&
      item.taxRate !== null &&
      item.taxRate !== undefined &&
      Number.isFinite(item.taxRate) &&
      item.taxRate > 0
    ) {
      subtotal = subtotal * (1 + item.taxRate / 100);
    }

    return subtotal;
  }, []);

  const calculateEquipmentTotal = useCallback((equipment: EquipmentItemValue): number => {
    const price = parseFloat((equipment.price || "0").replace(",", "."));
    const quantity = parseFloat((equipment.quantity || "1").replace(",", "."));
    const discount = parseFloat((equipment.discount || "0").replace(",", "."));

    if (!Number.isFinite(price) || !Number.isFinite(quantity)) return 0;

    let subtotal = price * quantity;

    if (Number.isFinite(discount) && discount > 0) {
      subtotal = subtotal * (1 - discount / 100);
    }

    if (
      equipment.applyTaxes &&
      equipment.taxRate !== null &&
      equipment.taxRate !== undefined &&
      Number.isFinite(equipment.taxRate) &&
      equipment.taxRate > 0
    ) {
      subtotal = subtotal * (1 + equipment.taxRate / 100);
    }

    return subtotal;
  }, []);

  const itemsTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  }, [items, calculateItemTotal]);

  const equipmentTotal = useMemo(() => {
    return equipmentItemValues.reduce((sum, eq) => sum + calculateEquipmentTotal(eq), 0);
  }, [equipmentItemValues, calculateEquipmentTotal]);

  const subtotalBeforeDiscount = useMemo(() => {
    return itemsTotal + equipmentTotal;
  }, [itemsTotal, equipmentTotal]);

  const templateDiscountAmount = useMemo(() => {
    if (!applyGlobalDiscount) return 0;
    const discountPercent = parseFloat(templateDiscount.replace(",", "."));
    if (!Number.isFinite(discountPercent) || discountPercent <= 0) return 0;
    return subtotalBeforeDiscount * (discountPercent / 100);
  }, [applyGlobalDiscount, templateDiscount, subtotalBeforeDiscount]);

  const subtotalAfterDiscount = useMemo(() => {
    return subtotalBeforeDiscount - templateDiscountAmount;
  }, [subtotalBeforeDiscount, templateDiscountAmount]);

  const templateTaxAmount = useMemo(() => {
    if (!applyGlobalTaxes) return 0;
    const taxPercent = parseFloat(templateTaxRate.replace(",", "."));
    if (!Number.isFinite(taxPercent) || taxPercent <= 0) return 0;
    return subtotalAfterDiscount * (taxPercent / 100);
  }, [applyGlobalTaxes, templateTaxRate, subtotalAfterDiscount]);

  const totalAmount = useMemo(() => {
    return subtotalAfterDiscount + templateTaxAmount;
  }, [subtotalAfterDiscount, templateTaxAmount]);

  // ---------------------------------------------------------------------------
  // EFFECTS
  // ---------------------------------------------------------------------------

  // Redirect if no service type on create
  useEffect(() => {
    if (!isEdit && !serviceTypeFromUrl) {
      navigate("/estimates");
    }
  }, [isEdit, serviceTypeFromUrl, navigate]);

  // Load ports function (reusable)
  const loadPorts = useCallback(async () => {
    setLoadingPorts(true);
    try {
      const data = await PortsService.findAll();
      setPorts(data);
    } catch (err) {
      console.error("Failed to load ports:", err);
      setPorts([]);
    } finally {
      setLoadingPorts(false);
    }
  }, []);

  // Load ports on mount
  useEffect(() => {
    loadPorts();
  }, [loadPorts]);

  // Handler when a new port is created - reload the full list to get all fields
  const handlePortCreated = useCallback(async () => {
    await loadPorts();
  }, [loadPorts]);

  // Load metadata (incoterms, shipping modes)
  useEffect(() => {
    const loadMetadata = async () => {
      setLoadingMetadata(true);
      try {
        const shippingModesData = await QuotationsService.getShippingModes();
        setShippingModes(shippingModesData);
        if (serviceType) {
          const incotermsData = await QuotationsService.getIncoterms(serviceType);
          setIncoterms(incotermsData);
        }
      } catch (err) {
        console.error("Failed to load metadata:", err);
      } finally {
        setLoadingMetadata(false);
      }
    };
    loadMetadata();
  }, [serviceType]);

  // Auto-set shipping mode based on service type (only for types with auto mode)
  useEffect(() => {
    if (!serviceType || isEdit) return;
    const mappedMode = SERVICE_TYPE_SHIPPING_MODE[serviceType];
    if (mappedMode) {
      // Service type has auto mode - set it
      setSelectedShippingMode(mappedMode);
    } else {
      // Service type requires manual selection - clear any previous selection
      setSelectedShippingMode("");
    }
  }, [serviceType, isEdit]);

  // Load quotation for edit
  useEffect(() => {
    const loadQuotation = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getQuotation(id);
        if (data) {
          setQuotation(data);
          populateForm(data);
        } else {
          setError("Quotation not found.");
        }
      } catch (e: any) {
        console.error("Error loading quotation:", e);
        setError(e?.message ?? "Failed to load quotation.");
      } finally {
        setLoading(false);
      }
    };
    loadQuotation();
  }, [id, getQuotation]);

  // Refresh helpers
  useEffect(() => {
    void refreshHelpers();
  }, [refreshHelpers]);

  // Load suppliers by mode
  useEffect(() => {
    const loadSuppliers = async () => {
      if (!selectedShippingMode) {
        setModeSuppliers([]);
        return;
      }
      setLoadingSuppliers(true);
      try {
        const data = await ShippingsService.findByMode(selectedShippingMode);
        setModeSuppliers(data);
      } catch (errorLoad) {
        console.error("Failed to load suppliers by mode:", errorLoad);
        setModeSuppliers([]);
      } finally {
        setLoadingSuppliers(false);
      }
    };
    loadSuppliers();
  }, [selectedShippingMode, serviceTypeRequiresShippingMode]);

  // Load templates with cancellation support
  useEffect(() => {
    let cancelled = false;
    const loadTemplates = async () => {
      if (!canLoadTemplates) {
        setTemplates([]);
        // Only clear selectedTemplateId in create mode, not in edit mode
        if (!isEdit) {
          setSelectedTemplateId("");
        }
        return;
      }
      setLoadingTemplates(true);
      try {
        const filters: any = {
          serviceType,
          category: selectedIncoterm,
          companyId,
          isActive: true,
        };
        if (serviceTypeRequiresShippingMode && selectedShippingMode) {
          filters.shippingMode = selectedShippingMode;
        }
        const data = await TemplatesService.find(filters);
        if (!cancelled) {
          setTemplates(data);

          // In edit mode, if we have a selectedTemplateId but no selectedTemplate yet,
          // try to find and set it from the loaded templates
          if (isEdit && selectedTemplateId && !selectedTemplate) {
            const matchingTemplate = data.find((t: any) => t.id === selectedTemplateId || t._id === selectedTemplateId);
            if (matchingTemplate) {
              setSelectedTemplate(matchingTemplate);
            }
          }

          // Auto-select custom mode if no templates available (only for create mode)
          if (!isEdit && data.length === 0) {
            setUseTemplate(false);
            setSelectedTemplateId("");
            setSelectedTemplate(null);
          }
        }
      } catch (errorLoad) {
        console.error("Failed to load templates:", errorLoad);
        if (!cancelled) {
          setTemplates([]);
          // Auto-select custom mode on error (only for create mode)
          if (!isEdit) {
            setUseTemplate(false);
          }
        }
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    };
    void loadTemplates();
    return () => { cancelled = true; };
  }, [canLoadTemplates, serviceType, selectedIncoterm, selectedShippingMode, serviceTypeRequiresShippingMode, companyId, isEdit, selectedTemplateId, selectedTemplate]);

  // Clear shipping line if mode changes
  useEffect(() => {
    if (isEdit && shippingLineId) return;
    if (!serviceTypeRequiresShippingMode || !shippingLineId) return;

    const current = (filteredShippingLines as any[]).find((s) => s._id === shippingLineId);
    if (!current) {
      setShippingLineId("");
      return;
    }
    const modes = current.shippingModes;
    if (!Array.isArray(modes) || !modes.includes(selectedShippingMode)) {
      setShippingLineId("");
    }
  }, [serviceTypeRequiresShippingMode, selectedShippingMode, shippingLineId, filteredShippingLines, isEdit]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const populateForm = useCallback((q: QuotationResponse) => {
    const quotationServiceType = (q as any).serviceType;
    const quotationIncoterm = (q as any).incoterm;
    const quotationShippingMode = (q as any).shippingMode;
    const templateData = (q as any).template;
    const templateId = (q as any).templateId;
    const isTemplateBased = Boolean(templateId);

    if (quotationServiceType) {
      setServiceType(quotationServiceType);
    } else if (templateData?.serviceType) {
      setServiceType(templateData.serviceType);
    }

    if (quotationIncoterm) {
      setSelectedIncoterm(quotationIncoterm);
    } else if (templateData?.category) {
      setSelectedIncoterm(templateData.category);
    }

    if (quotationShippingMode) {
      setSelectedShippingMode(quotationShippingMode);
    } else {
      const st = quotationServiceType ?? templateData?.serviceType;
      if (st) {
        const mappedMode = SERVICE_TYPE_SHIPPING_MODE[st];
        setSelectedShippingMode(mappedMode ?? "");
      } else {
        const shippingLineData = (q as any).shippingLine;
        if (shippingLineData?.shippingModes?.length > 0) {
          setSelectedShippingMode(shippingLineData.shippingModes[0]);
        }
      }
    }

    const clientData = (q as any).client;
    if (clientData?.id) {
      setClientId(clientData.id);
    } else if ((q as any).clientId) {
      setClientId((q as any).clientId);
    }

    const shippingLineData = (q as any).shippingLine;
    const slId = shippingLineData?.id || (q as any).shippingLineId;
    if (slId) setShippingLineId(slId);

    const agentData = (q as any).agent;
    if (agentData?.id) {
      setAgentId(agentData.id);
    } else if ((q as any).agentId) {
      setAgentId((q as any).agentId);
    }

    const originPortData = (q as any).portOfOriginData || (q as any).portOfOrigin;
    const originPortIdValue = (q as any).portOfOrigin;
    if (originPortData?.id || originPortData?._id) {
      setOriginPortId(originPortData.id || originPortData._id);
    } else if (typeof originPortIdValue === "string") {
      setOriginPortId(originPortIdValue);
    }

    const destinationPortData = (q as any).portOfDestinationData || (q as any).portOfDestination;
    const destPortIdValue = (q as any).portOfDestination;
    if (destinationPortData?.id || destinationPortData?._id) {
      setDestinationPortId(destinationPortData.id || destinationPortData._id);
    } else if (typeof destPortIdValue === "string") {
      setDestinationPortId(destPortIdValue);
    }

    setNotes(q.notes ?? "");
    setSummarize(Boolean(q.summarize));
    setStatus(((q as any).status as QuotationStatusEnum) ?? QuotationStatusEnum.Draft);

    // Load visibility settings
    setShowAgentToClient((q as any).showAgentToClient ?? true);
    setShowCarrierToClient((q as any).showCarrierToClient ?? true);
    setShowCommodityToClient((q as any).showCommodityToClient ?? true);
    setShowNotesToClient((q as any).showNotesToClient ?? true);

    if (templateId) {
      setSelectedTemplateId(templateId);
      setUseTemplate(true);
      // If templateData is embedded in the quotation response, use it
      // Otherwise, we'll need to wait for templates to load and match by ID
      if (templateData) {
        setSelectedTemplate(templateData as any);
      }
      // Note: If templateData is not available, selectedTemplate will be set 
      // when templates load and handleTemplateChange is called, or we need to 
      // handle this case separately
    } else {
      setUseTemplate(false);
      setSelectedTemplateId("");
    }

    const vu = q.validUntil instanceof Date ? q.validUntil : q.validUntil ? new Date(q.validUntil) : null;
    setValidUntil(vu && !Number.isNaN(vu.getTime()) ? vu : null);

    if (isTemplateBased && (q as any).items?.length > 0) {
      const templateItems = (q as any).items;
      const templateDef = templateData?.items || [];
      const mappedItems: QuotationItemForm[] = templateItems.map((it: any) => {
        const itemDef = templateDef.find((def: any) => def.id === it.itemId);
        return {
          itemId: it.itemId ?? uuidv4(),
          type: "cargo" as const,
          description: it.description ?? itemDef?.label ?? "",
          price: it.price != null ? String(it.price) : "",
          quantity: it.quantity != null ? String(it.quantity) : "1",
          discount: it.discount != null ? String(it.discount) : "0",
          notes: it.notes ?? "",
          transitType: "" as TransitTypeEnum | "",
          applyTemplateDiscount: it.applyTemplateDiscount ?? itemDef?.applyTemplateDiscount ?? false,
          applyTaxes: it.applyTaxes ?? itemDef?.applyTaxes ?? false,
          taxRate: it.taxRate ?? itemDef?.taxRate ?? null,
        };
      });
      setItems(mappedItems.length > 0 ? mappedItems : getDefaultItem());
    } else if ((q as any).legacyItems?.length > 0) {
      const mappedItems: QuotationItemForm[] = (q as any).legacyItems.map((it: any) => ({
        itemId: uuidv4(),
        type: it.type ?? "cargo",
        description: it.description ?? "",
        price: typeof it.price === "number" ? String(it.price) : it.price ?? "",
        quantity: it.quantity != null ? String(it.quantity) : "1",
        discount: it.discount != null ? String(it.discount) : "0",
        notes: it.notes ?? "",
        transitType: (it.transitType as TransitTypeEnum) ?? "",
        applyTemplateDiscount: false,
        applyTaxes: it.applyTaxes ?? false,
        taxRate: it.taxRate ?? null,
      }));

      setItems(mappedItems.length > 0 ? mappedItems : getDefaultItem());
    }

    else {
      setItems(getDefaultItem());
    }

    if ((q as any).headerFieldValues?.length > 0) {
      const hfValues = (q as any).headerFieldValues;
      const templateHeaderFields = templateData?.headerFields || [];
      const mappedHF: HeaderFieldValue[] = hfValues.map((hf: any) => {
        const fieldDef = templateHeaderFields.find((f: any) => f.id === hf.fieldId);
        return {
          fieldId: hf.fieldId,
          label: fieldDef?.label ?? "",
          value: hf.value ?? "",
          inputType: fieldDef?.inputType ?? "text",
        };
      });
      setHeaderFieldValues(mappedHF);
    }

    if ((q as any).pricingConfig) {
      const pc = (q as any).pricingConfig;
      setCurrency(pc.currency ?? "USD");
      setTemplateDiscount(pc.templateDiscount != null ? String(pc.templateDiscount) : "0");
      setTemplateTaxRate(pc.templateTaxRate != null ? String(pc.templateTaxRate) : "0");
      setApplyGlobalDiscount(pc.applyTemplateDiscount ?? false);
      setApplyGlobalTaxes(pc.applyTemplateTaxes ?? false);
    }

    // Load equipment item values from saved quotation
    // Note: Backend uses "equipmentItemId" and "fieldKey", we use "equipmentId" and "key" internally
    const savedEquipmentItems = (q as any).equipmentItemValues || (q as any).equipmentItems || [];
    if (savedEquipmentItems.length > 0) {
      const templateEquipmentItems = templateData?.equipmentItems || [];
      const mappedEquipment: EquipmentItemValue[] = savedEquipmentItems.map((eq: any) => {
        // Backend uses equipmentItemId, we use equipmentId internally
        const eqId = eq.equipmentItemId || eq.equipmentId;
        const equipmentDef = templateEquipmentItems.find((def: any) => def.id === eqId);
        return {
          equipmentId: eqId,
          label: eq.label ?? equipmentDef?.label ?? "",
          // Backend uses fieldKey, we use key internally
          fieldValues: (eq.fieldValues || []).map((fv: any) => ({
            key: fv.fieldKey || fv.key,
            value: fv.value ?? "",
          })),
          price: eq.price != null ? String(eq.price) : "",
          quantity: eq.quantity != null ? String(eq.quantity) : "1",
          discount: eq.discount != null ? String(eq.discount) : "0",
          applyTemplateDiscount: eq.applyTemplateDiscount ?? equipmentDef?.applyTemplateDiscount ?? false,
          applyTaxes: eq.applyTaxes ?? equipmentDef?.applyTaxes ?? false,
          taxRate: eq.taxRate ?? equipmentDef?.taxRate ?? null,
        };
      });
      setEquipmentItemValues(mappedEquipment);
    } else if (templateData?.equipmentItems?.length > 0) {
      // If no saved equipment values but template has equipment items, initialize from template
      const sortedEquipment = [...templateData.equipmentItems].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      const equipmentValues: EquipmentItemValue[] = sortedEquipment.map((eq: any) => ({
        equipmentId: eq.id,
        label: eq.label,
        fieldValues: (eq.fields || []).map((f: any) => ({
          key: f.key,
          value: f.defaultValue ? String(f.defaultValue) : "",
        })),
        price: eq.defaultPrice != null ? String(eq.defaultPrice) : "",
        quantity: eq.defaultQuantity != null ? String(eq.defaultQuantity) : "1",
        discount: eq.defaultDiscount != null ? String(eq.defaultDiscount) : "0",
        applyTemplateDiscount: eq.applyTemplateDiscount ?? false,
        applyTaxes: eq.applyTaxes ?? false,
        taxRate: eq.taxRate ?? null,
      }));
      setEquipmentItemValues(equipmentValues);
    }
  }, []);

  const handleTemplateChange = useCallback((templateId: string) => {
    if (isApprovedReadOnly) return;
    setSelectedTemplateId(templateId);

    const template = templates.find((t: any) => t.id === templateId || t._id === templateId);
    if (!template) {
      setSelectedTemplate(null);
      setHeaderFieldValues([]);
      setCurrency("USD");
      setTemplateDiscount("0");
      setTemplateTaxRate("0");
      setApplyGlobalDiscount(false);
      setApplyGlobalTaxes(false);
      setEquipmentItemValues([]);
      return;
    }

    setSelectedTemplate(template);

    if (template.headerFields && template.headerFields.length > 0) {
      const sortedFields = [...(template.headerFields || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setHeaderFieldValues(sortedFields.map((field) => ({
        fieldId: field.id,
        label: field.label,
        value: "",
        inputType: field.inputType,
      })));
    } else {
      setHeaderFieldValues([]);
    }

    if (template.pricingConfig) {
      setCurrency(template.pricingConfig.currency || "USD");
      setTemplateDiscount(template.pricingConfig.templateDiscount != null ? String(template.pricingConfig.templateDiscount) : "0");
      setTemplateTaxRate(template.pricingConfig.templateTaxRate != null ? String(template.pricingConfig.templateTaxRate) : "0");
      setApplyGlobalDiscount(template.pricingConfig.applyTemplateDiscount ?? false);
      setApplyGlobalTaxes(template.pricingConfig.applyTemplateTaxes ?? false);
    } else {
      setCurrency("USD");
      setTemplateDiscount("0");
      setTemplateTaxRate("0");
      setApplyGlobalDiscount(false);
      setApplyGlobalTaxes(false);
    }

    if (template.notes) setNotes(template.notes);

    // Load visibility settings from template
    setShowAgentToClient((template as any).showAgentToClient ?? true);
    setShowCarrierToClient((template as any).showCarrierToClient ?? true);
    setShowCommodityToClient((template as any).showCommodityToClient ?? true);
    setShowNotesToClient((template as any).showNotesToClient ?? true);

    const mappedItems: QuotationItemForm[] = (template.items || [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((it) => ({
        itemId: it.id,
        type: "cargo" as const,
        description: it.label ?? "",
        price: typeof it.defaultPrice === "number" ? String(it.defaultPrice) : "",
        quantity: String(typeof it.defaultQuantity === "number" && it.defaultQuantity > 0 ? it.defaultQuantity : 1),
        discount: String(typeof it.defaultDiscount === "number" ? it.defaultDiscount : 0),
        notes: it.notes ?? "",
        transitType: "" as TransitTypeEnum | "",
        applyTemplateDiscount: it.applyTemplateDiscount ?? false,
        applyTaxes: it.applyTaxes ?? false,
        taxRate:
          it.applyTaxes && it.taxRate !== null && it.taxRate !== undefined
            ? it.taxRate
            : null,
      }));

    setItems(mappedItems.length ? mappedItems : getDefaultItem());

    // Load equipment items from template
    if ((template as any).equipmentItems && (template as any).equipmentItems.length > 0) {
      const sortedEquipment = [...(template as any).equipmentItems].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      const equipmentValues: EquipmentItemValue[] = sortedEquipment.map((eq: any) => ({
        equipmentId: eq.id,
        label: eq.label,
        fieldValues: (eq.fields || []).map((f: any) => ({
          key: f.key,
          value: f.defaultValue ? String(f.defaultValue) : "",
        })),
        price: eq.defaultPrice != null ? String(eq.defaultPrice) : "",
        quantity: eq.defaultQuantity != null ? String(eq.defaultQuantity) : "1",
        discount: eq.defaultDiscount != null ? String(eq.defaultDiscount) : "0",
        applyTemplateDiscount: eq.applyTemplateDiscount ?? false,
        applyTaxes: eq.applyTaxes ?? false,
        taxRate: eq.taxRate ?? null,
      }));
      setEquipmentItemValues(equipmentValues);
    } else {
      setEquipmentItemValues([]);
    }
  }, [templates, isApprovedReadOnly]);

  const handleHeaderFieldChange = useCallback((fieldId: string, value: string) => {
    setHeaderFieldValues((prev) => prev.map((field) => (field.fieldId === fieldId ? { ...field, value } : field)));
  }, []);

  const handleHeaderFieldDateChange = useCallback((fieldId: string, date: Date | null) => {
    const value = date ? date.toISOString() : "";
    setHeaderFieldValues((prev) => prev.map((field) => (field.fieldId === fieldId ? { ...field, value } : field)));
  }, []);

  const handleEquipmentFieldChange = useCallback((equipmentIndex: number, fieldKey: string, value: string) => {
    setEquipmentItemValues((prev) =>
      prev.map((eq, i) =>
        i === equipmentIndex
          ? {
            ...eq,
            fieldValues: eq.fieldValues.map((f) =>
              f.key === fieldKey ? { ...f, value } : f
            ),
          }
          : eq
      )
    );
  }, []);

  const handleEquipmentPriceChange = useCallback((equipmentIndex: number, value: string) => {
    setEquipmentItemValues((prev) =>
      prev.map((eq, i) => (i === equipmentIndex ? { ...eq, price: value } : eq))
    );
  }, []);

  const handleEquipmentQuantityChange = useCallback((equipmentIndex: number, value: string) => {
    setEquipmentItemValues((prev) =>
      prev.map((eq, i) => (i === equipmentIndex ? { ...eq, quantity: value } : eq))
    );
  }, []);

  const handleEquipmentDiscountChange = useCallback((equipmentIndex: number, value: string) => {
    setEquipmentItemValues((prev) =>
      prev.map((eq, i) => (i === equipmentIndex ? { ...eq, discount: value } : eq))
    );
  }, []);

  const handleItemChange = useCallback((index: number, field: keyof QuotationItemForm, value: string | boolean | number | null) => {
    if (!canEditItems) return;
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } as QuotationItemForm : it)));
  }, [canEditItems]);

  const handleAddItem = useCallback(() => {
    if (!canEditItems) return;
    setItems((prev) => [...prev, ...getDefaultItem()]);
  }, [canEditItems]);

  const handleRemoveItem = useCallback((index: number) => {
    if (!canEditItems) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, [canEditItems]);

  const handleBack = useCallback(() => navigate(-1), [navigate]);

  // ---------------------------------------------------------------------------
  // VALIDATION & SUBMIT
  // ---------------------------------------------------------------------------

  // Helper to scroll to element and highlight it
  const scrollToError = useCallback((elementId: string) => {
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("ring-2", "ring-red-500", "border-red-500");
        element.focus();
        // Remove highlight after 3 seconds
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-red-500", "border-red-500");
        }, 3000);
      }
    }, 100);
  }, []);

  const validateForm = useCallback((): { error: string; fieldId?: string } | null => {
    if (!companyId) return { error: "No company associated to current user." };
    if (!serviceType) return { error: "Service type is required." };
    if (!selectedIncoterm) return { error: "Incoterm is required.", fieldId: "field-incoterm" };
    if (serviceTypeRequiresShippingMode && !selectedShippingMode) return { error: "Shipping mode is required.", fieldId: "field-shipping-mode" };
    if (!clientId) return { error: "Client is required.", fieldId: "field-client" };
    if (!shippingLineId) return { error: "Supplier is required.", fieldId: "field-supplier" };
    if (!validUntil) return { error: "Valid until date is required.", fieldId: "field-valid-until" };

    // We no longer strictly require a template to be selected to proceed
    // if (useTemplate && requiresTemplate && !selectedTemplateId) {
    //   return { error: "Template is required when using template mode.", fieldId: "field-template" };
    // }

    if (selectedTemplate?.headerFields && selectedTemplate.headerFields.length > 0) {
      for (const field of selectedTemplate.headerFields) {
        if (field.required) {
          const fieldValue = headerFieldValues.find((v) => v.fieldId === field.id);
          if (!fieldValue?.value.trim()) {
            return { error: `Header field "${field.label}" is required.`, fieldId: `header-field-${field.id}` };
          }
        }
      }
    }

    // Validate equipment items
    if ((selectedTemplate as any)?.equipmentItems) {
      for (const equipment of (selectedTemplate as any).equipmentItems) {
        const equipmentValue = equipmentItemValues.find((v) => v.equipmentId === equipment.id);
        if (!equipmentValue) {
          return { error: `Equipment "${equipment.label}" is required.`, fieldId: `equipment-${equipment.id}` };
        }

        if (equipment.fields) {
          for (const field of equipment.fields) {
            if (field.required) {
              const fieldValue = equipmentValue.fieldValues.find((fv: any) => fv.key === field.key);
              if (!fieldValue || !fieldValue.value.trim()) {
                return { error: `Field "${field.label}" in equipment "${equipment.label}" is required.`, fieldId: `equipment-${equipment.id}-field-${field.key}` };
              }
            }
          }
        }

        if (equipment.hasPrice) {
          const price = parseFloat((equipmentValue.price || "0").replace(",", "."));
          if (isNaN(price) || price < 0) {
            return { error: `Equipment "${equipment.label}": price must be a valid positive number.`, fieldId: `equipment-${equipment.id}-price` };
          }
        }

        if (equipment.hasQuantity) {
          const quantity = parseFloat((equipmentValue.quantity || "0").replace(",", "."));
          if (isNaN(quantity) || quantity <= 0) {
            return { error: `Equipment "${equipment.label}": quantity must be greater than 0.`, fieldId: `equipment-${equipment.id}-quantity` };
          }
        }
      }
    }

    if (Number.isNaN(validUntil.getTime())) return { error: "Valid until date is not valid.", fieldId: "field-valid-until" };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const vuDate = new Date(validUntil.getTime());
    vuDate.setHours(0, 0, 0, 0);
    if (vuDate < today) return { error: "Valid until date cannot be in the past.", fieldId: "field-valid-until" };

    if (!items.length) return { error: "At least one item is required." };

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.description.trim()) return { error: `Item #${i + 1}: description is required.`, fieldId: `item-${i}-description` };
      const priceNum = parseFloat(it.price.replace(",", "."));
      if (!Number.isFinite(priceNum) || priceNum < 0) return { error: `Item #${i + 1}: price must be a valid number.`, fieldId: `item-${i}-price` };
      const qtyNum = parseFloat(it.quantity.replace(",", "."));
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) return { error: `Item #${i + 1}: quantity must be greater than 0.`, fieldId: `item-${i}-quantity` };
    }

    if (!isEdit && status !== QuotationStatusEnum.Draft) return { error: "New quotations must start in Draft status." };
    if (isEdit && status === QuotationStatusEnum.Expired) return { error: "Status cannot be set to Expired manually." };
    return null;
  }, [companyId, serviceType, selectedIncoterm, serviceTypeRequiresShippingMode, selectedShippingMode, clientId, shippingLineId, validUntil, useTemplate, selectedTemplateId, selectedTemplate, headerFieldValues, equipmentItemValues, items, isEdit, status]);

  const handleSubmit = useCallback(async () => {
    if (submitting || isApprovedReadOnly) return;

    const validationResult = validateForm();
    if (validationResult) {
      setError(validationResult.error);
      setSuccess(null);
      if (validationResult.fieldId) {
        scrollToError(validationResult.fieldId);
      }
      return;
    }

    if (!companyId) {
      setError("No company associated to current user.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!validUntil) throw new Error("Valid until date is required.");

      const shippingModeToSend = (
        serviceTypeRequiresShippingMode && selectedShippingMode
          ? selectedShippingMode
          : (SERVICE_TYPE_SHIPPING_MODE[serviceType] || undefined)
      ) as "maritime" | "air" | "road" | undefined;

      // Build items array - ALWAYS with full structure for ALL items
      const itemsPayload = items.map((it) => {
        const price = parseFloat(it.price.replace(",", "."));
        const quantity = parseFloat(it.quantity.replace(",", "."));
        const discount = parseFloat(it.discount.replace(",", "."));

        return {
          itemId: it.itemId || uuidv4(),
          type: it.type,
          description: it.description.trim(),
          price: Number.isFinite(price) ? price : 0,
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          discount: Number.isFinite(discount) ? discount : 0,
          notes: it.notes.trim() || undefined,
          transitType: it.type === "cargo" && it.transitType ? it.transitType : undefined,
          applyTemplateDiscount: it.applyTemplateDiscount ?? false,
          applyTaxes: it.applyTaxes ?? false,
          taxRate: it.taxRate !== null && it.taxRate !== undefined && Number.isFinite(it.taxRate) ? it.taxRate : 0,
        };
      });

      // Build equipment items array - ALWAYS send with consistent structure
      const equipmentPayload = equipmentItemValues.map((ev) => ({
        equipmentItemId: ev.equipmentId,
        label: ev.label || undefined,
        fieldValues: ev.fieldValues.map((fv) => ({
          fieldKey: fv.key,
          value: fv.value || undefined,
        })),
        price: ev.price && ev.price.trim() !== ""
          ? (Number.isFinite(parseFloat(ev.price.replace(",", "."))) ? parseFloat(ev.price.replace(",", ".")) : 0)
          : 0,
        quantity: ev.quantity && ev.quantity.trim() !== ""
          ? parseFloat(ev.quantity.replace(",", "."))
          : 1,
        discount: ev.discount && ev.discount.trim() !== ""
          ? parseFloat(ev.discount.replace(",", "."))
          : 0,
        applyTemplateDiscount: ev.applyTemplateDiscount ?? false,
        applyTaxes: ev.applyTaxes ?? false,
        taxRate: ev.taxRate !== null && ev.taxRate !== undefined ? ev.taxRate : 0,
      }));

      // Build header field values - ALWAYS send with consistent structure
      const headerFieldValuesPayload = headerFieldValues.map((hf) => ({
        fieldId: hf.fieldId,
        value: hf.value || undefined,
      }));

      // Build pricing config - ALWAYS same structure
      const pricingConfigPayload = {
        currency: currency || "USD",
        templatePrice: undefined,
        templateDiscount: templateDiscount !== "" ? parseFloat(templateDiscount.replace(",", ".")) : 0,
        applyTemplateDiscount: applyGlobalDiscount,
        templateTaxRate: templateTaxRate !== "" ? parseFloat(templateTaxRate.replace(",", ".")) : 0,
        applyTemplateTaxes: applyGlobalTaxes,
      };

      // ALWAYS send BOTH items and legacyItems
      // Backend will use templateId to determine which one to process
      const isTemplateBased = Boolean(selectedTemplateId);

      // Build the DTO - ALWAYS same structure regardless of template/incoterm
      const baseDto = {
        // Required fields
        clientId,
        companyId,
        shippingLineId,
        validUntil: validUntil.toISOString(),

        // Optional reference fields - use undefined if empty (not null)
        agentId: agentId || undefined,
        templateId: selectedTemplateId || undefined,
        originPortId: originPortId || undefined,
        destinationPortId: destinationPortId || undefined,

        // Service configuration - always include
        serviceType: serviceType || undefined,
        incoterm: selectedIncoterm || undefined,
        shippingMode: shippingModeToSend || undefined,

        // Items - ALWAYS send both arrays
        // When templateId is present, backend uses 'items'
        // When templateId is undefined, backend uses 'legacyItems'
        items: isTemplateBased ? itemsPayload : [],
        legacyItems: !isTemplateBased ? itemsPayload.map(it => ({
          type: it.type,
          description: it.description,
          price: it.price,
          quantity: it.quantity,
          discount: it.discount,
          applyDiscount: true,
          applyTaxes: it.applyTaxes,
          taxRate: it.taxRate,
          notes: it.notes,
          transitType: it.transitType,
        })) : [],

        // Related data - always include as arrays (empty if none)
        headerFieldValues: headerFieldValuesPayload,
        equipmentItems: equipmentPayload,

        // Pricing - always include full structure
        pricingConfig: pricingConfigPayload,

        // Options - always include with defaults
        summarize: summarize ?? true,
        notes: notes.trim() || undefined,

        // Visibility settings - always include with defaults
        showAgentToClient: showAgentToClient ?? true,
        showCarrierToClient: showCarrierToClient ?? true,
        showCommodityToClient: showCommodityToClient ?? true,
        showNotesToClient: showNotesToClient ?? true,
      };

      if (isEdit && quotation) {
        const dto: UpdateQuotationDto = {
          ...baseDto,
          status
        };
        const qId = (quotation as any).id ?? (quotation as any)._id;
        await updateQuotation(String(qId), dto);
        setSuccess("Estimate updated successfully!");
        setTimeout(() => navigate(-1), 1500);
      } else {
        const dto: CreateQuotationDto = {
          ...baseDto,
          status: QuotationStatusEnum.Draft
        };
        await createQuotation(dto);
        setSuccess("Estimate created successfully!");
        setTimeout(() => navigate(-1), 1500);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Operation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    isApprovedReadOnly,
    validateForm,
    scrollToError,
    companyId,
    validUntil,
    serviceTypeRequiresShippingMode,
    selectedShippingMode,
    serviceType,
    items,
    equipmentItemValues,
    headerFieldValues,
    currency,
    templateDiscount,
    templateTaxRate,
    applyGlobalDiscount,
    applyGlobalTaxes,
    selectedTemplateId,
    clientId,
    shippingLineId,
    agentId,
    originPortId,
    destinationPortId,
    selectedIncoterm,
    summarize,
    notes,
    showAgentToClient,
    showCarrierToClient,
    showCommodityToClient,
    showNotesToClient,
    isEdit,
    quotation,
    status,
    updateQuotation,
    createQuotation,
    navigate,
  ]);
  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
          <p className="text-sm text-neutral-500">Loading estimate...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6 pb-24">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={handleBack} className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-700 hover:bg-neutral-50 transition-colors" title="Back" aria-label="Back">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-neutral-400 flex-shrink-0 hidden sm:block" />
            <h1 className="text-[20px] sm:text-[24px] font-semibold text-neutral-900 truncate">{isEdit ? "Edit Estimate" : "New Estimate"}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4 sm:space-y-6">
        {isApprovedReadOnly && (<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 sm:px-4 py-3 flex items-start gap-3"><AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-amber-800">Read Only</p><p className="text-xs sm:text-sm text-amber-700 mt-0.5">This estimate has been accepted and cannot be modified.</p></div></div>)}

        <form className="space-y-4 sm:space-y-6" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          {/* Section 1: Service Configuration */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Service Configuration</h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Service type, incoterm, and shipping mode</p>
            </div>
            <div className="p-3 sm:p-5 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className={labelBase}>Service Type {!serviceType && <span className="text-red-500">*</span>}</label>
                  {serviceType ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-700">
                      <span className="text-neutral-500">{serviceTypeDisplay.icon}</span>
                      <span className="font-medium">{serviceTypeDisplay.label || "Not set"}</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <select value={serviceType} onChange={(e) => { setServiceType(e.target.value); const mappedMode = SERVICE_TYPE_SHIPPING_MODE[e.target.value]; setSelectedShippingMode(mappedMode ?? ""); }} className={classNames(selectBase, "pr-8 appearance-none")} disabled={isApprovedReadOnly}>
                        <option value="">Select service type</option>
                        {Object.entries(SERVICE_TYPE_CONFIG).map(([key, config]) => (<option key={key} value={key}>{config.label}</option>))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center"><ChevronDown size={14} className="text-neutral-500" /></span>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelBase}>Incoterm <span className="text-red-500">*</span></label>
                  {loadingMetadata ? (<div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-500"><Loader2 size={14} className="animate-spin" /><span>Loading...</span></div>) : !serviceType ? (<div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-500"><span>Select service type first</span></div>) : (
                    <div className="relative">
                      <select value={selectedIncoterm} onChange={(e) => setSelectedIncoterm(e.target.value)} className={classNames(selectBase, "pr-8 appearance-none")} disabled={isApprovedReadOnly || incoterms.length === 0}>
                        <option value="">Select incoterm</option>
                        {incoterms.map((inc) => <option key={inc} value={inc}>{inc}</option>)}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center"><ChevronDown size={14} className="text-neutral-500" /></span>
                    </div>
                  )}
                </div>
                {serviceTypeRequiresShippingMode && (
                  <div>
                    <label className={labelBase}>Shipping Mode <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <select
                        id="field-shipping-mode"
                        value={selectedShippingMode}
                        onChange={(e) => setSelectedShippingMode(e.target.value)}
                        className={classNames(selectBase, "pr-8 appearance-none")}
                        disabled={isApprovedReadOnly}
                      >
                        <option value="">Select shipping mode</option>
                        <option value="maritime">Maritime</option>
                        <option value="air">Air</option>
                        <option value="road">Road</option>
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center"><ChevronDown size={14} className="text-neutral-500" /></span>
                    </div>
                  </div>
                )}
                {serviceTypeHasAutoShippingMode && selectedShippingMode && (
                  <div>
                    <label className={labelBase}>Shipping Mode</label>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-700">
                      <span className="text-neutral-500">{selectedShippingMode === "air" && <Plane size={18} />}{selectedShippingMode === "maritime" && <Ship size={18} />}{selectedShippingMode === "road" && <Truck size={18} />}</span>
                      <span className="font-medium">{shippingModeLabel}</span>
                      <span className="text-xs text-neutral-400 ml-1">(auto)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 2: Basic Information */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Basic Information</h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Select the client and supplier</p>
            </div>
            <div className="p-3 sm:p-5 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className={labelBase}>Client <span className="text-red-500">*</span></label>
                  <select id="field-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={selectBase} disabled={isApprovedReadOnly}>
                    <option value="">Select client</option>
                    {clients.map((c) => <option key={c._id} value={c._id}>{c.clientName}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelBase}>Supplier <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select id="field-supplier" value={shippingLineId} onChange={(e) => { setShippingLineId(e.target.value); setSelectedTemplateId(""); setUseTemplate(false); if (agentId) { const currentAgent = (agents as any[]).find((a) => a._id === agentId) as QuotationAgentHelper | undefined; if (currentAgent && currentAgent.shippingLineId !== e.target.value) setAgentId(""); } }} className={selectBase} disabled={isApprovedReadOnly || loadingSuppliers}>
                      <option value="">{loadingSuppliers ? "Loading suppliers..." : "Select supplier"}</option>
                      {filteredShippingLines.map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center"><ChevronDown size={14} className="text-neutral-500" /></span>
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className={labelBase}>Agent</label>
                  <select value={agentId} onChange={(e) => { setAgentId(e.target.value); if (e.target.value) { const agent = (agents as any[]).find((a) => a._id === e.target.value) as QuotationAgentHelper | undefined; if (agent?.shippingLineId && agent.shippingLineId !== shippingLineId) { setShippingLineId(agent.shippingLineId); setSelectedTemplateId(""); setUseTemplate(false); } } }} className={selectBase} disabled={isApprovedReadOnly}>
                    <option value="">No agent</option>
                    {filteredAgents.map((a: any) => <option key={a._id} value={a._id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Route Information */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Route Information</h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Select origin and destination ports</p>
            </div>
            <div className="p-3 sm:p-5 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <SearchablePortSelect value={originPortId} onChange={setOriginPortId} ports={ports} loading={loadingPorts} disabled={isApprovedReadOnly} placeholder="Select origin port" label="Origin Port" onPortCreated={handlePortCreated} />
                <SearchablePortSelect value={destinationPortId} onChange={setDestinationPortId} ports={ports} loading={loadingPorts} disabled={isApprovedReadOnly} placeholder="Select destination port" label="Destination Port" onPortCreated={handlePortCreated} />
              </div>
            </div>
          </section>

          {/* Section 4: Template Selection */}
          {!isEdit && (
            <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
              <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Load Template (Optional)</h2>
                <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Choose a template to auto-fill the estimate, or start manually.</p>
              </div>
              <div className="p-3 sm:p-5 bg-white space-y-4">
                {/* Loading state */}
                {canLoadTemplates && loadingTemplates && (
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Loading templates...</span>
                  </div>
                )}

                {/* Cannot load templates yet */}
                {!canLoadTemplates && (
                  <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-neutral-600">Select service type and incoterm above to see available templates.</p>
                    </div>
                  </div>
                )}

                {/* Templates loaded */}
                {canLoadTemplates && !loadingTemplates && (
                  <>
                    {templates.length > 0 ? (
                      <div className="space-y-3">
                        <div className="relative max-w-md">
                          <label className={labelBase}>Select Template to Load</label>
                          <div className="flex gap-2">
                            <select
                              id="field-template"
                              value={selectedTemplateId}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                  setSelectedTemplateId("");
                                  setUseTemplate(false);
                                } else {
                                  setUseTemplate(true);
                                  handleTemplateChange(val);
                                }
                              }}
                              className={selectBase}
                              disabled={isApprovedReadOnly}
                            >
                              <option value="">-- Start with blank / Custom --</option>
                              {templates.map((t: any) => (
                                <option key={t._id || t.id} value={t._id || t.id}>
                                  {t.name} {t.category ? `(${t.category})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Template info */}
                        {selectedTemplateId && selectedTemplate?.pricingConfig && (
                          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                            <div className="flex items-start gap-2">
                              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                              <div className="text-xs text-blue-800">
                                <p className="font-medium">Loaded Template: {selectedTemplate.name}</p>
                                <p className="mt-1">Currency: <strong>{selectedTemplate.pricingConfig.currency}</strong></p>
                                {selectedTemplate.pricingConfig?.templateDiscount != null && selectedTemplate.pricingConfig.templateDiscount > 0 && (
                                  <p>Discount: <strong>{selectedTemplate.pricingConfig.templateDiscount}%</strong></p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-neutral-600">No matching templates found for this configuration. You can proceed manually.</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {/* Section 5: Template Selection (Edit mode) */}
          {isEdit && useTemplate && (
            <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
              <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Template</h2>
                <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Select a template to load predefined items</p>
              </div>
              <div className="p-3 sm:p-5 bg-white space-y-4">
                {!canLoadTemplates && <p className="text-xs sm:text-sm text-neutral-500">Select service type and incoterm to see available templates.</p>}
                {canLoadTemplates && loadingTemplates && <div className="flex items-center gap-2 text-sm text-neutral-600"><Loader2 size={16} className="animate-spin" /><span>Loading templates...</span></div>}
                {canLoadTemplates && !loadingTemplates && templates.length === 0 && <p className="text-xs sm:text-sm text-neutral-500">No templates found for this configuration.</p>}
                {canLoadTemplates && !loadingTemplates && templates.length > 0 && (
                  <>
                    <div className="relative max-w-sm">
                      <label className={labelBase}>Template</label>
                      <select id="field-template" value={selectedTemplateId} onChange={(e) => handleTemplateChange(e.target.value)} className={selectBase} disabled={isApprovedReadOnly}>
                        <option value="">No template linked</option>
                        {templates.map((t: any) => <option key={t._id || t.id} value={t._id || t.id}>{t.name} {t.category ? `(${t.category})` : ""}</option>)}
                      </select>
                    </div>
                    {selectedTemplate?.pricingConfig && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-blue-800">
                            <p className="font-medium">Template Pricing</p>
                            <p className="mt-1">Currency: <strong>{selectedTemplate.pricingConfig.currency}</strong></p>
                            {selectedTemplate.pricingConfig?.templateDiscount != null && selectedTemplate.pricingConfig.templateDiscount > 0 && <p>Discount: <strong>{selectedTemplate.pricingConfig.templateDiscount}%</strong></p>}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {/* Section 6: Pricing Configuration */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Pricing Configuration</h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Currency, discounts, and tax settings</p>
            </div>
            <div className="p-3 sm:p-5 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className={labelBase}>Currency</label>
                  <div className="relative">
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={classNames(selectBase, "pr-8 appearance-none")} disabled={isApprovedReadOnly}>
                      {CURRENCY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center"><ChevronDown size={14} className="text-neutral-500" /></span>
                  </div>
                </div>
                <div>
                  <label className={labelBase}>Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={templateDiscount}
                    onChange={(e) => setTemplateDiscount(e.target.value)}
                    placeholder="0"
                    className={inputBase}
                    disabled={isApprovedReadOnly}
                  />
                </div>
                <div>
                  <label className={labelBase}>Tax Rate %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={templateTaxRate}
                    onChange={(e) => setTemplateTaxRate(e.target.value)}
                    placeholder="0"
                    className={inputBase}
                    disabled={isApprovedReadOnly}
                  />
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <label className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600">
                    <input
                      type="checkbox"
                      checked={applyGlobalDiscount}
                      onChange={(e) => setApplyGlobalDiscount(e.target.checked)}
                      className={checkboxBase}
                      disabled={isApprovedReadOnly}
                    />
                    <span>Apply Discount</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600">
                    <input
                      type="checkbox"
                      checked={applyGlobalTaxes}
                      onChange={(e) => setApplyGlobalTaxes(e.target.checked)}
                      className={checkboxBase}
                      disabled={isApprovedReadOnly}
                    />
                    <span>Apply Taxes</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7: Template Header Fields */}
          {headerFieldValues.length > 0 && (
            <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
              <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Template Header Fields</h2>
                <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Complete the required information</p>
              </div>
              <div className="p-3 sm:p-5 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {headerFieldValues.map((fieldValue) => {
                    // Try to get field definition from template
                    const fieldDef = selectedTemplate?.headerFields?.find((f) => f.id === fieldValue.fieldId);
                    const inputType = fieldValue.inputType || fieldDef?.inputType || "text";
                    const hasValidOptions = inputType === "select" && Array.isArray(fieldDef?.options) && fieldDef!.options!.length > 0;
                    const effectiveInputType = inputType === "select" && !hasValidOptions ? "text" : inputType;
                    const fieldElementId = `header-field-${fieldValue.fieldId}`;
                    const label = fieldValue.label || fieldDef?.label || fieldValue.fieldId;
                    const isRequired = fieldDef?.required ?? false;

                    return (
                      <div key={fieldValue.fieldId}>
                        <label className={labelBase}>{label}{isRequired && <span className="text-red-500 ml-1">*</span>}</label>
                        {effectiveInputType === "select" && hasValidOptions ? (
                          <select id={fieldElementId} value={fieldValue.value || ""} onChange={(e) => handleHeaderFieldChange(fieldValue.fieldId, e.target.value)} className={selectBase} disabled={isApprovedReadOnly}>
                            <option value="">Select {label.toLowerCase()}</option>
                            {fieldDef!.options!.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : effectiveInputType === "date" ? (
                          <Calendar inputId={fieldElementId} value={parseHeaderFieldDate(fieldValue.value || "")} onChange={(e) => handleHeaderFieldDateChange(fieldValue.fieldId, e.value as Date | null)} showIcon className="w-full quotation-datepicker" panelClassName="quotation-datepicker-panel" disabled={isApprovedReadOnly} dateFormat="dd/mm/yy" />
                        ) : effectiveInputType === "number" ? (
                          <input id={fieldElementId} type="number" value={fieldValue.value || ""} onChange={(e) => handleHeaderFieldChange(fieldValue.fieldId, e.target.value)} className={inputBase} disabled={isApprovedReadOnly} />
                        ) : effectiveInputType === "textarea" ? (
                          <textarea id={fieldElementId} value={fieldValue.value || ""} onChange={(e) => handleHeaderFieldChange(fieldValue.fieldId, e.target.value)} className={classNames(inputBase, "resize-none")} rows={3} disabled={isApprovedReadOnly} />
                        ) : (
                          <input id={fieldElementId} type="text" value={fieldValue.value || ""} onChange={(e) => handleHeaderFieldChange(fieldValue.fieldId, e.target.value)} className={inputBase} disabled={isApprovedReadOnly} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Section 7.5: Equipment Items */}
          {equipmentItemValues.length > 0 && (
            <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
              <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Equipment Details</h2>
                <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Specify equipment specifications and quantities</p>
              </div>
              <div className="p-3 sm:p-5 bg-white space-y-4">
                {equipmentItemValues.map((equipmentValue, eqIndex) => {
                  // Try to get equipment definition from template, otherwise use minimal info
                  const templateEquipment = selectedTemplate
                    ? (selectedTemplate as any).equipmentItems?.find((eq: any) => eq.id === equipmentValue.equipmentId)
                    : null;
                  const eqTotal = calculateEquipmentTotal(equipmentValue);

                  // Use template definition if available, otherwise create minimal structure
                  const equipment = templateEquipment || {
                    id: equipmentValue.equipmentId,
                    label: equipmentValue.label,
                    fields: equipmentValue.fieldValues.map(fv => ({ key: fv.key, label: fv.key, inputType: 'text' })),
                    hasPrice: true,
                    hasQuantity: true,
                    hasDiscount: true,
                  };

                  return (
                    <div key={equipmentValue.equipmentId || eqIndex} id={`equipment-${equipment.id}`} className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 sm:p-4">
                      <h3 className="text-sm font-medium text-neutral-900 mb-3">{equipmentValue.label || equipment.label}</h3>
                      {equipmentValue.fieldValues && equipmentValue.fieldValues.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                          {equipmentValue.fieldValues.map((fieldValue) => {
                            const fieldDef = equipment.fields?.find((f: any) => f.key === fieldValue.key);
                            return (
                              <div key={fieldValue.key}>
                                <label className="mb-1 block text-xs font-medium text-neutral-600">
                                  {fieldDef?.label || fieldValue.key}
                                  {fieldDef?.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                <input
                                  id={`equipment-${equipment.id}-field-${fieldValue.key}`}
                                  type={fieldDef?.inputType === "number" ? "number" : "text"}
                                  value={fieldValue.value || ""}
                                  onChange={(e) => handleEquipmentFieldChange(eqIndex, fieldValue.key, e.target.value)}
                                  placeholder={fieldDef?.label || fieldValue.key}
                                  disabled={isApprovedReadOnly}
                                  className={inputBase}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {(equipment.hasPrice !== false) && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-neutral-600">Price ({currency})</label>
                            <input id={`equipment-${equipment.id}-price`} type="number" min="0" step="0.01" value={equipmentValue.price ?? ""} onChange={(e) => handleEquipmentPriceChange(eqIndex, e.target.value)} placeholder="0.00" disabled={isApprovedReadOnly} className={inputBase} />
                          </div>
                        )}
                        {(equipment.hasQuantity !== false) && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-neutral-600">Quantity</label>
                            <input id={`equipment-${equipment.id}-quantity`} type="number" min="0" step="1" value={equipmentValue.quantity ?? ""} onChange={(e) => handleEquipmentQuantityChange(eqIndex, e.target.value)} placeholder="1" disabled={isApprovedReadOnly} className={inputBase} />
                          </div>
                        )}
                        {(equipment.hasDiscount !== false) && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-neutral-600">Discount %</label>
                            <input id={`equipment-${equipment.id}-discount`} type="number" min="0" max="100" step="0.01" value={equipmentValue.discount ?? ""} onChange={(e) => handleEquipmentDiscountChange(eqIndex, e.target.value)} placeholder="0" disabled={isApprovedReadOnly} className={inputBase} />
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        {(equipment.hasPrice !== false) && (
                          <div className="ml-auto text-xs sm:text-sm text-neutral-700">
                            <span className="font-medium">Subtotal:</span>{" "}
                            <span className="text-neutral-900 font-semibold">
                              {eqTotal.toLocaleString("en-US", { style: "currency", currency: currency || "USD" })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {summarize && equipmentTotal > 0 && (
                  <div className="flex justify-end pt-2">
                    <div className="bg-neutral-100 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
                      <div className="flex items-center justify-between gap-3 sm:gap-4">
                        <span className="text-xs sm:text-sm font-medium text-neutral-600">Equipment Total:</span>
                        <span className="text-base sm:text-lg font-semibold text-neutral-900">{equipmentTotal.toLocaleString("en-US", { style: "currency", currency: currency || "USD" })}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 9: Items */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Items <span className="text-red-500">*</span></h2>
                <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Add the charges and items</p>
              </div>
              <button type="button" onClick={handleAddItem} disabled={!canEditItems} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto">
                <Plus size={14} /><span>Add Item</span>
              </button>
            </div>
            <div className="p-3 sm:p-5 bg-white space-y-3 sm:space-y-4">
              {useTemplate && !selectedTemplateId && !isApprovedReadOnly && (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs sm:text-sm text-neutral-600">Select a template above to load items.</div>
              )}
              {items.map((item, index) => (
                <QuotationItem key={item.itemId || index} item={item} index={index} itemsLength={items.length} canEditItems={canEditItems} currency={currency} onItemChange={handleItemChange} onRemoveItem={handleRemoveItem} calculateItemTotal={calculateItemTotal} />
              ))}
              {summarize && items.length > 0 && (
                <div className="flex justify-end pt-2">
                  <div className="bg-neutral-100 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
                    <div className="flex items-center justify-between gap-3 sm:gap-4">
                      <span className="text-xs sm:text-sm font-medium text-neutral-600">Items Total:</span>
                      <span className="text-base sm:text-lg font-semibold text-neutral-900">{itemsTotal.toLocaleString("en-US", { style: "currency", currency: currency || "USD" })}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Section 10: Additional Details */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Additional Details</h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Set validity, status, and notes</p>
            </div>
            <div className="p-3 sm:p-5 bg-white">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-4 sm:space-y-5">
                  <div>
                    <label className={labelBase}>Valid Until <span className="text-red-500">*</span></label>
                    <div className="lg:max-w-xs">
                      <Calendar value={validUntil} onChange={(e) => setValidUntil((e.value as Date | null) ?? null)} showIcon minDate={new Date()} className="w-full quotation-datepicker" panelClassName="quotation-datepicker-panel" disabled={isApprovedReadOnly} dateFormat="dd/mm/yy" />
                    </div>
                  </div>
                  <div>
                    <label className={labelBase}>Status {isEdit && <span className="text-red-500">*</span>}</label>
                    <div className="lg:max-w-xs">
                      <select value={status} onChange={(e) => setStatus(e.target.value as QuotationStatusEnum)} className={selectBase} disabled={!isEdit || isApprovedReadOnly}>
                        {statusOptions.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </div>
                    {!isEdit && <p className="mt-1.5 text-xs text-neutral-500">New estimates always start as <strong>Draft</strong>.</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <input id="summarize" type="checkbox" checked={summarize} onChange={(e) => setSummarize(e.target.checked)} className="h-4 w-4 appearance-none rounded border border-neutral-300 bg-white relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bf0077]/40 checked:bg-[#bf0077] checked:border-[#bf0077] checked:after:content-[''] checked:after:absolute checked:after:left-[5px] checked:after:top-[2px] checked:after:h-[9px] checked:after:w-[5px] checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white disabled:opacity-50" disabled={isApprovedReadOnly} />
                    <label htmlFor="summarize" className="text-xs sm:text-sm text-neutral-700 select-none">Summarize items (calculate totals)</label>
                  </div>
                </div>
                <div>
                  <label className={labelBase}>General Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} placeholder="Add any additional notes about this estimate (optional)" className={classNames(inputBase, "resize-none")} disabled={isApprovedReadOnly} />
                </div>
              </div>
            </div>
          </section>

          {/* Section 11: Visibility Settings */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Visibility Settings</h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Control what clients can see in this estimate</p>
            </div>
            <div className="p-3 sm:p-5 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors">
                  <input type="checkbox" checked={showAgentToClient} onChange={(e) => setShowAgentToClient(e.target.checked)} className={checkboxBase} disabled={isApprovedReadOnly} />
                  <div className="flex items-center gap-2">
                    {showAgentToClient ? <Eye size={16} className="text-neutral-500" /> : <EyeOff size={16} className="text-neutral-400" />}
                    <span className="text-sm text-neutral-700">Show Agent to Client</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors">
                  <input type="checkbox" checked={showCarrierToClient} onChange={(e) => setShowCarrierToClient(e.target.checked)} className={checkboxBase} disabled={isApprovedReadOnly} />
                  <div className="flex items-center gap-2">
                    {showCarrierToClient ? <Eye size={16} className="text-neutral-500" /> : <EyeOff size={16} className="text-neutral-400" />}
                    <span className="text-sm text-neutral-700">Show Carrier to Client</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors">
                  <input type="checkbox" checked={showCommodityToClient} onChange={(e) => setShowCommodityToClient(e.target.checked)} className={checkboxBase} disabled={isApprovedReadOnly} />
                  <div className="flex items-center gap-2">
                    {showCommodityToClient ? <Eye size={16} className="text-neutral-500" /> : <EyeOff size={16} className="text-neutral-400" />}
                    <span className="text-sm text-neutral-700">Show Commodity to Client</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors">
                  <input type="checkbox" checked={showNotesToClient} onChange={(e) => setShowNotesToClient(e.target.checked)} className={checkboxBase} disabled={isApprovedReadOnly} />
                  <div className="flex items-center gap-2">
                    {showNotesToClient ? <Eye size={16} className="text-neutral-500" /> : <EyeOff size={16} className="text-neutral-400" />}
                    <span className="text-sm text-neutral-700">Show Notes to Client</span>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* Section 12: Grand Total */}
          {summarize && (itemsTotal > 0 || equipmentTotal > 0) && (
            <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
              <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Summary</h2>
              </div>
              <div className="p-3 sm:p-5 bg-white">
                <div className="flex flex-col gap-2 max-w-sm ml-auto">
                  {itemsTotal > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Items:</span>
                      <span className="font-medium text-neutral-800">{itemsTotal.toLocaleString("en-US", { style: "currency", currency: currency || "USD" })}</span>
                    </div>
                  )}
                  {equipmentTotal > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Equipment:</span>
                      <span className="font-medium text-neutral-800">{equipmentTotal.toLocaleString("en-US", { style: "currency", currency: currency || "USD" })}</span>
                    </div>
                  )}
                  {(itemsTotal > 0 || equipmentTotal > 0) && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Subtotal:</span>
                      <span className="font-medium text-neutral-800">{subtotalBeforeDiscount.toLocaleString("en-US", { style: "currency", currency: currency || "USD" })}</span>
                    </div>
                  )}
                  {templateDiscountAmount > 0 && (
                    <div className="flex items-center justify-between text-sm text-green-600">
                      <span>Discount ({templateDiscount}%):</span>
                      <span className="font-medium">-{templateDiscountAmount.toLocaleString("en-US", { style: "currency", currency: currency || "USD" })}</span>
                    </div>
                  )}
                  {templateTaxAmount > 0 && (
                    <div className="flex items-center justify-between text-sm text-orange-600">
                      <span>Tax ({templateTaxRate}%):</span>
                      <span className="font-medium">+{templateTaxAmount.toLocaleString("en-US", { style: "currency", currency: currency || "USD" })}</span>
                    </div>
                  )}
                  <div className="border-t border-neutral-200 pt-2 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-neutral-900">Grand Total:</span>
                      <span className="text-lg font-bold text-neutral-900">{totalAmount.toLocaleString("en-US", { style: "currency", currency: currency || "USD" })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Spacer for sticky footer */}
          <div className="h-24"></div>
        </form>
      </div>

      {/* Sticky Footer with Messages and Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 shadow-lg" style={{ zIndex: 100 }}>
        {/* Error/Success Messages */}
        {(error || success) && (
          <div className="px-4 py-2 border-b border-neutral-100">
            {error && (
              <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{success}</p>
              </div>
            )}
          </div>
        )}
        {/* Buttons */}
        <div className="px-4 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || helpersLoading || isApprovedReadOnly || !metadataReady || !serviceType || !selectedIncoterm || (serviceTypeRequiresShippingMode && !selectedShippingMode)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{isEdit ? "Saving..." : "Creating..."}</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{isEdit ? "Save Estimate" : "Create Estimate"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateEditQuotationPage;