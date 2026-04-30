/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import classNames from "classnames";
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
  Eye,
  EyeOff,
} from "lucide-react";

import { useAuthStore } from "../stores/auth.store";
import { TemplatesService } from "../services/templates.service";

// Types based on backend DTOs
type TemplateHeaderField = {
  id: string;
  label: string;
  inputType: "text" | "number" | "date" | "select" | "textarea";
  required: boolean;
  options?: string[];
  order?: number;
};

type TemplateEquipmentField = {
  key: string;
  label: string;
  inputType: "text" | "number";
  required: boolean;
  order?: number;
};

type TemplateEquipmentItem = {
  id: string;
  label: string;
  fields: TemplateEquipmentField[];
  hasPrice: boolean;
  hasQuantity: boolean;
  hasDiscount: boolean;
  defaultPrice?: number;
  defaultQuantity?: number;
  defaultDiscount?: number;
  applyTemplateDiscount?: boolean;
  applyTaxes?: boolean;
  taxRate?: number;
  order?: number;
};

type TemplateItem = {
  id: string;
  label: string;
  hasPrice: boolean;
  hasQuantity: boolean;
  hasDiscount: boolean;
  defaultPrice?: number;
  defaultQuantity?: number;
  defaultDiscount?: number;
  notes?: string;
  applyTemplateDiscount?: boolean;
  applyTaxes?: boolean;
  taxRate?: number;
  order?: number;
};

type TemplatePricingConfig = {
  currency: string;
  templatePrice?: number;
  templateDiscount?: number;
  applyTemplateDiscount?: boolean;
  templateTaxRate?: number;
  applyTemplateTaxes?: boolean;
};

// Service type configuration with icons
const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; shippingMode: string }> = {
  FCL: { label: "FCL Maritime", icon: <Ship size={18} />, shippingMode: "maritime" },
  LCL: { label: "LCL", icon: <Package size={18} />, shippingMode: "maritime" },
  AIR: { label: "Air Freight", icon: <Plane size={18} />, shippingMode: "air" },
  FTL: { label: "FTL", icon: <Truck size={18} />, shippingMode: "road" },
  INSURANCE: { label: "Cargo Insurance", icon: <Shield size={18} />, shippingMode: "" },
  CUSTOMS: { label: "Customs", icon: <FileCheck size={18} />, shippingMode: "" },
  "LOCAL_TRUCKING": { label: "Local Trucking", icon: <Truck size={18} />, shippingMode: "road" },
  OTHER: { label: "Other", icon: <Package size={18} />, shippingMode: "" },
};

const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];

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

// Checkbox style classes
const checkboxBase = "h-4 w-4 appearance-none rounded border border-neutral-300 bg-white relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bf0077]/40 checked:bg-[#bf0077] checked:border-[#bf0077] checked:after:content-[''] checked:after:absolute checked:after:left-[5px] checked:after:top-[2px] checked:after:h-[9px] checked:after:w-[5px] checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white disabled:opacity-50 disabled:cursor-not-allowed";
const checkboxSmall = "h-3.5 w-3.5 appearance-none rounded border border-neutral-300 bg-white relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bf0077]/40 checked:bg-[#bf0077] checked:border-[#bf0077] checked:after:content-[''] checked:after:absolute checked:after:left-[4px] checked:after:top-[1px] checked:after:h-[8px] checked:after:w-[4px] checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white disabled:opacity-50 disabled:cursor-not-allowed";

// Helper to get shipping mode label
const getShippingModeLabel = (mode: string): string => {
  switch (mode) {
    case "maritime": return "Maritime";
    case "air": return "Air";
    case "road": return "Road";
    default: return mode;
  }
};

const CreateEditTemplatePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const { user: currentUser } = useAuthStore();
  const companyId = (currentUser as any)?.company?._id ?? (currentUser as any)?.company?.id ?? null;

  // Basic Info
  const [name, setName] = useState<string>("");
  const [serviceType, setServiceType] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);

  // Header Fields
  const [headerFields, setHeaderFields] = useState<TemplateHeaderField[]>([]);

  // Equipment Items
  const [equipmentItems, setEquipmentItems] = useState<TemplateEquipmentItem[]>([]);

  // Regular Items
  const [items, setItems] = useState<TemplateItem[]>([]);

  // Pricing Config
  const [pricingConfig, setPricingConfig] = useState<TemplatePricingConfig>({
    currency: "USD",
    templatePrice: undefined,
    templateDiscount: undefined,
    applyTemplateDiscount: false,
    templateTaxRate: undefined,
    applyTemplateTaxes: false,
  });

  // Visibility Settings
  const [showAgentToClient, setShowAgentToClient] = useState<boolean>(true);
  const [showCarrierToClient, setShowCarrierToClient] = useState<boolean>(true);
  const [showCommodityToClient, setShowCommodityToClient] = useState<boolean>(true);
  const [showNotesToClient, setShowNotesToClient] = useState<boolean>(true);

  // Manual shipping mode (for INSURANCE, CUSTOMS, OTHER)
  const [manualShippingMode, setManualShippingMode] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if service type has auto shipping mode or needs manual selection
  const autoShippingMode = serviceType ? SERVICE_TYPE_CONFIG[serviceType]?.shippingMode || "" : "";
  const requiresManualShippingMode = serviceType && !autoShippingMode;
  
  // The effective shipping mode (auto or manual)
  const shippingMode = autoShippingMode || manualShippingMode;

  useEffect(() => {
    if (isEdit && id) {
      loadTemplate(id);
    }
  }, [id, isEdit]);

  // Clear manual shipping mode when service type changes (only for create mode)
  useEffect(() => {
    if (!isEdit) {
      setManualShippingMode("");
    }
  }, [serviceType, isEdit]);

  const loadTemplate = async (templateId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await TemplatesService.findOne(templateId);
      populateForm(response);
    } catch (e: any) {
      console.error("Error loading template:", e);
      setError(e?.message ?? "Failed to load template.");
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (template: any) => {
    setName(template.name || "");
    setServiceType(template.serviceType || "");
    setCategory(template.category || "");
    setNotes(template.notes || "");
    setIsActive(template.isActive ?? true);
    
    // Load shipping mode - if the service type doesn't have auto mode, use the saved one
    if (template.shippingModes && template.shippingModes.length > 0) {
      const savedMode = template.shippingModes[0];
      const autoMode = template.serviceType ? SERVICE_TYPE_CONFIG[template.serviceType]?.shippingMode || "" : "";
      if (!autoMode) {
        setManualShippingMode(savedMode);
      }
    }
    
    if (template.headerFields) setHeaderFields(template.headerFields);
    if (template.equipmentItems) setEquipmentItems(template.equipmentItems);
    if (template.items) setItems(template.items);
    if (template.pricingConfig) {
      setPricingConfig({
        currency: template.pricingConfig.currency || "USD",
        templatePrice: template.pricingConfig.templatePrice,
        templateDiscount: template.pricingConfig.templateDiscount,
        applyTemplateDiscount: template.pricingConfig.applyTemplateDiscount ?? false,
        templateTaxRate: template.pricingConfig.templateTaxRate,
        applyTemplateTaxes: template.pricingConfig.applyTemplateTaxes ?? false,
      });
    }
    setShowAgentToClient(template.showAgentToClient ?? true);
    setShowCarrierToClient(template.showCarrierToClient ?? true);
    setShowCommodityToClient(template.showCommodityToClient ?? true);
    setShowNotesToClient(template.showNotesToClient ?? true);
  };

  const inputBase = "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const selectBase = "block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:border-neutral-400 transition-all";
  const labelBase = "mb-1 block text-xs sm:text-sm font-medium text-neutral-700";

  // ===== Header Fields Management =====
  const handleAddHeaderField = () => {
    const newField: TemplateHeaderField = { id: crypto.randomUUID(), label: "", inputType: "text", required: false, order: headerFields.length };
    setHeaderFields([...headerFields, newField]);
  };

  const handleRemoveHeaderField = (index: number) => {
    setHeaderFields(headerFields.filter((_, i) => i !== index));
  };

  const handleHeaderFieldChange = (index: number, field: keyof TemplateHeaderField, value: any) => {
    setHeaderFields(headerFields.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleAddHeaderFieldOption = (fieldIndex: number) => {
    setHeaderFields(headerFields.map((field, i) => {
      if (i === fieldIndex) {
        const options = field.options || [];
        return { ...field, options: [...options, ""] };
      }
      return field;
    }));
  };

  const handleRemoveHeaderFieldOption = (fieldIndex: number, optionIndex: number) => {
    setHeaderFields(headerFields.map((field, i) => {
      if (i === fieldIndex && field.options) {
        return { ...field, options: field.options.filter((_, oi) => oi !== optionIndex) };
      }
      return field;
    }));
  };

  const handleHeaderFieldOptionChange = (fieldIndex: number, optionIndex: number, value: string) => {
    setHeaderFields(headerFields.map((field, i) => {
      if (i === fieldIndex && field.options) {
        return { ...field, options: field.options.map((opt, oi) => (oi === optionIndex ? value : opt)) };
      }
      return field;
    }));
  };

  // ===== Equipment Items Management =====
  const handleAddEquipmentItem = () => {
    const newItem: TemplateEquipmentItem = { id: crypto.randomUUID(), label: "", fields: [], hasPrice: true, hasQuantity: true, hasDiscount: false, applyTemplateDiscount: false, applyTaxes: false, order: equipmentItems.length };
    setEquipmentItems([...equipmentItems, newItem]);
  };

  const handleRemoveEquipmentItem = (index: number) => {
    setEquipmentItems(equipmentItems.filter((_, i) => i !== index));
  };

  const handleEquipmentItemChange = (index: number, field: keyof TemplateEquipmentItem, value: any) => {
    setEquipmentItems(equipmentItems.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleAddEquipmentField = (equipmentIndex: number) => {
    setEquipmentItems(equipmentItems.map((equipment, i) => {
      if (i === equipmentIndex) {
        const newField: TemplateEquipmentField = { key: "", label: "", inputType: "text", required: false, order: equipment.fields.length };
        return { ...equipment, fields: [...equipment.fields, newField] };
      }
      return equipment;
    }));
  };

  const handleRemoveEquipmentField = (equipmentIndex: number, fieldIndex: number) => {
    setEquipmentItems(equipmentItems.map((equipment, i) => {
      if (i === equipmentIndex) {
        return { ...equipment, fields: equipment.fields.filter((_, fi) => fi !== fieldIndex) };
      }
      return equipment;
    }));
  };

  const handleEquipmentFieldChange = (equipmentIndex: number, fieldIndex: number, field: keyof TemplateEquipmentField, value: any) => {
    setEquipmentItems(equipmentItems.map((equipment, i) => {
      if (i === equipmentIndex) {
        return { ...equipment, fields: equipment.fields.map((f, fi) => (fi === fieldIndex ? { ...f, [field]: value } : f)) };
      }
      return equipment;
    }));
  };

  // ===== Regular Items Management =====
  const handleAddItem = () => {
    const newItem: TemplateItem = { id: crypto.randomUUID(), label: "", hasPrice: true, hasQuantity: true, hasDiscount: false, applyTemplateDiscount: false, applyTaxes: false, order: items.length };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof TemplateItem, value: any) => {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  // ===== Form Validation =====
  const validateForm = (): string | null => {
    if (!companyId) return "No company associated to current user.";
    if (!name.trim()) return "Template name is required.";
    if (!serviceType) return "Service type is required.";
    if (!category) return "Category (Incoterm) is required.";
    if (requiresManualShippingMode && !manualShippingMode) return "Shipping mode is required for this service type.";
    if (!pricingConfig.currency.trim()) return "Currency is required.";

    for (let i = 0; i < headerFields.length; i++) {
      const field = headerFields[i];
      if (!field.label.trim()) return `Header field #${i + 1}: label is required.`;
      if (field.inputType === "select" && (!field.options || field.options.length === 0)) {
        return `Header field #${i + 1}: select type requires at least one option.`;
      }
    }

    for (let i = 0; i < equipmentItems.length; i++) {
      const equipment = equipmentItems[i];
      if (!equipment.label.trim()) return `Equipment item #${i + 1}: label is required.`;
      for (let j = 0; j < equipment.fields.length; j++) {
        const field = equipment.fields[j];
        if (!field.key.trim()) return `Equipment item #${i + 1}, field #${j + 1}: alias is required.`;
        if (!field.label.trim()) return `Equipment item #${i + 1}, field #${j + 1}: label is required.`;
      }
      if (equipment.applyTaxes && (equipment.taxRate === undefined || equipment.taxRate === null)) {
        return `Equipment item #${i + 1}: tax rate is required when apply taxes is enabled.`;
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.label.trim()) return `Item #${i + 1}: label is required.`;
      if (item.applyTaxes && (item.taxRate === undefined || item.taxRate === null)) {
        return `Item #${i + 1}: tax rate is required when apply taxes is enabled.`;
      }
    }

    return null;
  };

  // ===== Form Submission =====
  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    const validationError = validateForm();
    if (validationError) { setError(validationError); setSuccess(null); return; }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Build shippingModes array based on service type
      const shippingModes = shippingMode ? [shippingMode] : [];

      const payload = {
        name, serviceType, category, shippingModes,
        notes: notes.trim() || undefined,
        isActive,
        headerFields: headerFields.length > 0 ? headerFields : undefined,
        equipmentItems: equipmentItems.length > 0 ? equipmentItems : undefined,
        items: items.length > 0 ? items : undefined,
        pricingConfig,
        showAgentToClient, showCarrierToClient, showCommodityToClient, showNotesToClient,
        companyId,
      };

      if (isEdit && id) {
        await TemplatesService.update(id, payload);
        setSuccess("Template updated successfully!");
      } else {
        await TemplatesService.create(payload);
        setSuccess("Template created successfully!");
      }

      setTimeout(() => navigate("/templates"), 1500);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Operation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [name, serviceType, category, shippingMode, notes, isActive, headerFields, equipmentItems, items, pricingConfig, showAgentToClient, showCarrierToClient, showCommodityToClient, showNotesToClient, companyId, isEdit, id, submitting, navigate]);

  const handleBack = () => navigate(-1);

  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
          <p className="text-sm text-neutral-500">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] overflow-auto overscroll-y-contain bg-white text-neutral-900 p-4 sm:p-6 pb-28">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={handleBack} className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-700 hover:bg-neutral-50 transition-colors" title="Back" aria-label="Back"><ArrowLeft size={16} /></button>
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-5 h-5 text-neutral-400 flex-shrink-0 hidden sm:block" />
              <h1 className="text-[20px] sm:text-[24px] font-semibold text-neutral-900 truncate">{isEdit ? "Edit Template" : "New Template"}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <form className="space-y-4 sm:space-y-6" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          {/* BASIC INFORMATION */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Basic Information</h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Template name and status</p>
            </div>
            <div className="p-3 sm:p-5 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className={labelBase}>Template Name <span className="text-red-500">*</span></label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter template name" className={inputBase} maxLength={100} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input id="isActive" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className={checkboxBase} />
                  <label htmlFor="isActive" className="text-xs sm:text-sm text-neutral-700 select-none">Active template</label>
                </div>
              </div>
            </div>
          </section>

          {/* SERVICE CONFIGURATION */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Service Configuration</h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Service type and category</p>
            </div>
            <div className="p-3 sm:p-5 bg-white space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className={labelBase}>Service Type <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className={classNames(selectBase, "pr-8 appearance-none")}>
                      <option value="">Select service type</option>
                      {Object.keys(SERVICE_TYPE_CONFIG).map((key) => (<option key={key} value={key}>{SERVICE_TYPE_CONFIG[key].label}</option>))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center"><ChevronDown size={14} className="text-neutral-500" /></span>
                  </div>
                </div>
                <div>
                  <label className={labelBase}>Category (Incoterm) <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={classNames(selectBase, "pr-8 appearance-none")}>
                      <option value="">Select category</option>
                      {INCOTERMS.map((inc) => (<option key={inc} value={inc}>{inc}</option>))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center"><ChevronDown size={14} className="text-neutral-500" /></span>
                  </div>
                </div>
                <div>
                  <label className={labelBase}>Shipping Mode {requiresManualShippingMode && <span className="text-red-500">*</span>}</label>
                  {requiresManualShippingMode ? (
                    <div className="relative">
                      <select 
                        value={manualShippingMode} 
                        onChange={(e) => setManualShippingMode(e.target.value)} 
                        className={classNames(selectBase, "pr-8 appearance-none")}
                      >
                        <option value="">Select shipping mode</option>
                        <option value="maritime">Maritime</option>
                        <option value="air">Air</option>
                        <option value="road">Road</option>
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center"><ChevronDown size={14} className="text-neutral-500" /></span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 h-[38px] px-3 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-600">
                      {shippingMode ? (
                        <>
                          {shippingMode === "maritime" && <Ship size={16} className="text-neutral-500" />}
                          {shippingMode === "air" && <Plane size={16} className="text-neutral-500" />}
                          {shippingMode === "road" && <Truck size={16} className="text-neutral-500" />}
                          <span>{getShippingModeLabel(shippingMode)}</span>
                          <span className="text-xs text-neutral-400 ml-1">(auto)</span>
                        </>
                      ) : (
                        <span className="text-neutral-400 italic">Select a service type first</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* HEADER FIELDS */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Header Fields</h2>
                <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Custom fields that will appear in quotation headers</p>
              </div>
              <button type="button" onClick={handleAddHeaderField} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors self-start sm:self-auto">
                <Plus size={14} /><span>Add Field</span>
              </button>
            </div>
            <div className="p-3 sm:p-5 bg-white space-y-3 sm:space-y-4">
              {headerFields.length === 0 && (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-6 text-center text-xs sm:text-sm text-neutral-600">No header fields added yet. Click "Add Field" to create one.</div>
              )}
              {headerFields.map((field, index) => (
                <div key={field.id} className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
                    <span className="text-xs sm:text-sm font-medium text-neutral-700">Field #{index + 1}</span>
                    <button type="button" onClick={() => handleRemoveHeaderField(index)} className="inline-flex items-center justify-center border border-red-300 bg-white h-8 w-8 p-0 leading-none hover:bg-red-50 rounded-md" title="Remove field" aria-label="Remove field">
                      <Trash2 size={16} strokeWidth={2} style={{ color: "#DC2626", display: "block" }} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600">Label</label>
                      <input type="text" value={field.label} onChange={(e) => handleHeaderFieldChange(index, "label", e.target.value)} placeholder="Field label" className={classNames(inputBase, "text-xs sm:text-sm")} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600">Input Type</label>
                      <select value={field.inputType} onChange={(e) => handleHeaderFieldChange(index, "inputType", e.target.value)} className={classNames(selectBase, "text-xs sm:text-sm")}>
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="select">Select</option>
                        <option value="textarea">Textarea</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-xs text-neutral-600">
                        <input type="checkbox" checked={field.required} onChange={(e) => handleHeaderFieldChange(index, "required", e.target.checked)} className={checkboxSmall} />
                        <span>Required</span>
                      </label>
                    </div>
                  </div>
                  {field.inputType === "select" && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-neutral-600">Options</label>
                        <button type="button" onClick={() => handleAddHeaderFieldOption(index)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
                          <Plus size={12} /><span>Add Option</span>
                        </button>
                      </div>
                      {field.options?.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-2">
                          <input type="text" value={option} onChange={(e) => handleHeaderFieldOptionChange(index, optIndex, e.target.value)} placeholder={`Option ${optIndex + 1}`} className={classNames(inputBase, "text-xs")} />
                          <button type="button" onClick={() => handleRemoveHeaderFieldOption(index, optIndex)} className="inline-flex items-center justify-center border border-red-300 bg-white h-7 w-7 p-0 leading-none hover:bg-red-50 rounded-md" title="Remove option" aria-label="Remove option">
                            <Trash2 size={14} strokeWidth={2} style={{ color: "#DC2626", display: "block" }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* EQUIPMENT ITEMS */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Equipment Items</h2>
                <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Equipment with dynamic fields (e.g., containers)</p>
              </div>
              <button type="button" onClick={handleAddEquipmentItem} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors self-start sm:self-auto">
                <Plus size={14} /><span>Add Equipment</span>
              </button>
            </div>
            <div className="p-3 sm:p-5 bg-white space-y-3 sm:space-y-4">
              {equipmentItems.length === 0 && (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-6 text-center text-xs sm:text-sm text-neutral-600">No equipment items added yet. Click "Add Equipment" to create one.</div>
              )}
              {equipmentItems.map((equipment, eqIndex) => (
                <div key={equipment.id} className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
                    <span className="text-xs sm:text-sm font-medium text-neutral-700">Equipment #{eqIndex + 1}</span>
                    <button type="button" onClick={() => handleRemoveEquipmentItem(eqIndex)} className="inline-flex items-center justify-center border border-red-300 bg-white h-8 w-8 p-0 leading-none hover:bg-red-50 rounded-md" title="Remove equipment" aria-label="Remove equipment">
                      <Trash2 size={16} strokeWidth={2} style={{ color: "#DC2626", display: "block" }} />
                    </button>
                  </div>
                  <div className="mb-3">
                    <label className="mb-1 block text-xs font-medium text-neutral-600">Label</label>
                    <input type="text" value={equipment.label} onChange={(e) => handleEquipmentItemChange(eqIndex, "label", e.target.value)} placeholder="Equipment label (e.g., Container 20')" className={classNames(inputBase, "text-xs sm:text-sm")} />
                  </div>
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-neutral-600">Fields</label>
                      <button type="button" onClick={() => handleAddEquipmentField(eqIndex)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <Plus size={12} /><span>Add Field</span>
                      </button>
                    </div>
                    {equipment.fields.length === 0 && (
                      <p className="text-xs text-neutral-400 italic">No fields added. Fields are optional.</p>
                    )}
                    {equipment.fields.map((field, fIndex) => (
                      <div key={fIndex} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-start p-2 rounded-lg bg-white border border-neutral-100">
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-neutral-500 uppercase tracking-wide">Alias</label>
                          <input type="text" value={field.key} onChange={(e) => handleEquipmentFieldChange(eqIndex, fIndex, "key", e.target.value)} placeholder="e.g., size" className={classNames(inputBase, "text-xs")} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-neutral-500 uppercase tracking-wide">Label</label>
                          <input type="text" value={field.label} onChange={(e) => handleEquipmentFieldChange(eqIndex, fIndex, "label", e.target.value)} placeholder="e.g., Container Size" className={classNames(inputBase, "text-xs")} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-neutral-500 uppercase tracking-wide">Type</label>
                          <select value={field.inputType} onChange={(e) => handleEquipmentFieldChange(eqIndex, fIndex, "inputType", e.target.value)} className={classNames(selectBase, "text-xs")}>
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                          </select>
                        </div>
                        <div className="flex items-end gap-2 h-full">
                          <label className="flex items-center gap-1.5 text-xs text-neutral-600 flex-1">
                            <input type="checkbox" checked={field.required} onChange={(e) => handleEquipmentFieldChange(eqIndex, fIndex, "required", e.target.checked)} className={checkboxSmall} />
                            <span>Required</span>
                          </label>
                          <button type="button" onClick={() => handleRemoveEquipmentField(eqIndex, fIndex)} className="inline-flex items-center justify-center border border-red-300 bg-white h-7 w-7 p-0 leading-none hover:bg-red-50 rounded-md flex-shrink-0" title="Remove field" aria-label="Remove field">
                            <Trash2 size={14} strokeWidth={2} style={{ color: "#DC2626", display: "block" }} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    <label className="flex items-center gap-2 text-xs text-neutral-600">
                      <input type="checkbox" checked={equipment.hasPrice} onChange={(e) => handleEquipmentItemChange(eqIndex, "hasPrice", e.target.checked)} className={checkboxSmall} />
                      <span>Has Price</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-neutral-600">
                      <input type="checkbox" checked={equipment.hasQuantity} onChange={(e) => handleEquipmentItemChange(eqIndex, "hasQuantity", e.target.checked)} className={checkboxSmall} />
                      <span>Has Quantity</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-neutral-600">
                      <input type="checkbox" checked={equipment.hasDiscount} onChange={(e) => handleEquipmentItemChange(eqIndex, "hasDiscount", e.target.checked)} className={checkboxSmall} />
                      <span>Has Discount</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-neutral-600">
                      <input type="checkbox" checked={equipment.applyTemplateDiscount ?? false} onChange={(e) => handleEquipmentItemChange(eqIndex, "applyTemplateDiscount", e.target.checked)} className={checkboxSmall} />
                      <span>Apply Discount</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-neutral-600">
                      <input type="checkbox" checked={equipment.applyTaxes ?? false} onChange={(e) => handleEquipmentItemChange(eqIndex, "applyTaxes", e.target.checked)} className={checkboxSmall} />
                      <span>Apply Taxes</span>
                    </label>
                  </div>
                  {equipment.applyTaxes && (
                    <div className="mb-3">
                      <label className="mb-1 block text-xs font-medium text-neutral-600">Tax Rate %</label>
                      <input type="number" min="0" max="100" step="0.01" value={equipment.taxRate ?? ""} onChange={(e) => handleEquipmentItemChange(eqIndex, "taxRate", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="0" className={classNames(inputBase, "text-xs sm:text-sm max-w-[120px]")} />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {equipment.hasPrice && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600">Default Price</label>
                        <input type="number" min="0" step="0.01" value={equipment.defaultPrice ?? ""} onChange={(e) => handleEquipmentItemChange(eqIndex, "defaultPrice", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="0.00" className={classNames(inputBase, "text-xs")} />
                      </div>
                    )}
                    {equipment.hasQuantity && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600">Default Qty</label>
                        <input type="number" min="0" step="1" value={equipment.defaultQuantity ?? ""} onChange={(e) => handleEquipmentItemChange(eqIndex, "defaultQuantity", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="1" className={classNames(inputBase, "text-xs")} />
                      </div>
                    )}
                    {equipment.hasDiscount && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600">Default Disc %</label>
                        <input type="number" min="0" max="100" step="0.01" value={equipment.defaultDiscount ?? ""} onChange={(e) => handleEquipmentItemChange(eqIndex, "defaultDiscount", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="0" className={classNames(inputBase, "text-xs")} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* REGULAR ITEMS */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Items</h2>
                <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Regular template items</p>
              </div>
              <button type="button" onClick={handleAddItem} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors self-start sm:self-auto">
                <Plus size={14} /><span>Add Item</span>
              </button>
            </div>
            <div className="p-3 sm:p-5 bg-white space-y-3 sm:space-y-4">
              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-6 text-center text-xs sm:text-sm text-neutral-600">No items added yet. Click "Add Item" to create one.</div>
              )}
              {items.map((item, index) => (
                <div key={item.id} className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
                    <span className="text-xs sm:text-sm font-medium text-neutral-700">Item #{index + 1}</span>
                    <button type="button" onClick={() => handleRemoveItem(index)} className="inline-flex items-center justify-center border border-red-300 bg-white h-8 w-8 p-0 leading-none hover:bg-red-50 rounded-md" title="Remove item" aria-label="Remove item">
                      <Trash2 size={16} strokeWidth={2} style={{ color: "#DC2626", display: "block" }} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-neutral-600">Label</label>
                      <input type="text" value={item.label} onChange={(e) => handleItemChange(index, "label", e.target.value)} placeholder="Item label" className={classNames(inputBase, "text-xs sm:text-sm")} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-neutral-600">Notes</label>
                      <input type="text" value={item.notes ?? ""} onChange={(e) => handleItemChange(index, "notes", e.target.value)} placeholder="Optional notes" className={classNames(inputBase, "text-xs sm:text-sm")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    <label className="flex items-center gap-2 text-xs text-neutral-600">
                      <input type="checkbox" checked={item.hasPrice} onChange={(e) => handleItemChange(index, "hasPrice", e.target.checked)} className={checkboxSmall} />
                      <span>Has Price</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-neutral-600">
                      <input type="checkbox" checked={item.hasQuantity} onChange={(e) => handleItemChange(index, "hasQuantity", e.target.checked)} className={checkboxSmall} />
                      <span>Has Quantity</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-neutral-600">
                      <input type="checkbox" checked={item.hasDiscount} onChange={(e) => handleItemChange(index, "hasDiscount", e.target.checked)} className={checkboxSmall} />
                      <span>Has Discount</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-neutral-600">
                      <input type="checkbox" checked={item.applyTemplateDiscount ?? false} onChange={(e) => handleItemChange(index, "applyTemplateDiscount", e.target.checked)} className={checkboxSmall} />
                      <span>Apply Discount</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-neutral-600">
                      <input type="checkbox" checked={item.applyTaxes ?? false} onChange={(e) => handleItemChange(index, "applyTaxes", e.target.checked)} className={checkboxSmall} />
                      <span>Apply Taxes</span>
                    </label>
                  </div>
                  {item.applyTaxes && (
                    <div className="mb-3">
                      <label className="mb-1 block text-xs font-medium text-neutral-600">Tax Rate %</label>
                      <input type="number" min="0" max="100" step="0.01" value={item.taxRate ?? ""} onChange={(e) => handleItemChange(index, "taxRate", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="0" className={classNames(inputBase, "text-xs sm:text-sm max-w-[120px]")} />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {item.hasPrice && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600">Default Price</label>
                        <input type="number" min="0" step="0.01" value={item.defaultPrice ?? ""} onChange={(e) => handleItemChange(index, "defaultPrice", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="0.00" className={classNames(inputBase, "text-xs")} />
                      </div>
                    )}
                    {item.hasQuantity && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600">Default Qty</label>
                        <input type="number" min="0" step="1" value={item.defaultQuantity ?? ""} onChange={(e) => handleItemChange(index, "defaultQuantity", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="1" className={classNames(inputBase, "text-xs")} />
                      </div>
                    )}
                    {item.hasDiscount && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600">Default Disc %</label>
                        <input type="number" min="0" max="100" step="0.01" value={item.defaultDiscount ?? ""} onChange={(e) => handleItemChange(index, "defaultDiscount", e.target.value ? parseFloat(e.target.value) : undefined)} placeholder="0" className={classNames(inputBase, "text-xs")} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* PRICING CONFIGURATION */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Pricing Configuration</h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Currency, discounts, and tax settings</p>
            </div>
            <div className="p-3 sm:p-5 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className={labelBase}>Currency <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select value={pricingConfig.currency} onChange={(e) => setPricingConfig({ ...pricingConfig, currency: e.target.value })} className={classNames(selectBase, "pr-8 appearance-none")}>
                      {CURRENCY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center"><ChevronDown size={14} className="text-neutral-500" /></span>
                  </div>
                </div>
                {/* <div>
                  <label className={labelBase}>Template Price</label>
                  <input type="number" min="0" step="0.01" value={pricingConfig.templatePrice ?? ""} onChange={(e) => setPricingConfig({ ...pricingConfig, templatePrice: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="0.00" className={inputBase} />
                </div> */}
                <div>
                  <label className={labelBase}>Template Discount %</label>
                  <input type="number" min="0" max="100" step="0.01" value={pricingConfig.templateDiscount ?? ""} onChange={(e) => setPricingConfig({ ...pricingConfig, templateDiscount: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="0" className={inputBase} />
                </div>
                <div>
                  <label className={labelBase}>Template Tax Rate %</label>
                  <input type="number" min="0" max="100" step="0.01" value={pricingConfig.templateTaxRate ?? ""} onChange={(e) => setPricingConfig({ ...pricingConfig, templateTaxRate: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="0" className={inputBase} />
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <label className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600">
                    <input type="checkbox" checked={pricingConfig.applyTemplateDiscount ?? false} onChange={(e) => setPricingConfig({ ...pricingConfig, applyTemplateDiscount: e.target.checked })} className={checkboxBase} />
                    <span>Apply Discount</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600">
                    <input type="checkbox" checked={pricingConfig.applyTemplateTaxes ?? false} onChange={(e) => setPricingConfig({ ...pricingConfig, applyTemplateTaxes: e.target.checked })} className={checkboxBase} />
                    <span>Apply Taxes</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* VISIBILITY SETTINGS */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Visibility Settings</h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Control what clients can see in quotations</p>
            </div>
            <div className="p-3 sm:p-5 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors">
                  <input type="checkbox" checked={showAgentToClient} onChange={(e) => setShowAgentToClient(e.target.checked)} className={checkboxBase} />
                  <div className="flex items-center gap-2">
                    {showAgentToClient ? <Eye size={16} className="text-neutral-500" /> : <EyeOff size={16} className="text-neutral-400" />}
                    <span className="text-sm text-neutral-700">Show Agent to Client</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors">
                  <input type="checkbox" checked={showCarrierToClient} onChange={(e) => setShowCarrierToClient(e.target.checked)} className={checkboxBase} />
                  <div className="flex items-center gap-2">
                    {showCarrierToClient ? <Eye size={16} className="text-neutral-500" /> : <EyeOff size={16} className="text-neutral-400" />}
                    <span className="text-sm text-neutral-700">Show Carrier to Client</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors">
                  <input type="checkbox" checked={showCommodityToClient} onChange={(e) => setShowCommodityToClient(e.target.checked)} className={checkboxBase} />
                  <div className="flex items-center gap-2">
                    {showCommodityToClient ? <Eye size={16} className="text-neutral-500" /> : <EyeOff size={16} className="text-neutral-400" />}
                    <span className="text-sm text-neutral-700">Show Commodity to Client</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors">
                  <input type="checkbox" checked={showNotesToClient} onChange={(e) => setShowNotesToClient(e.target.checked)} className={checkboxBase} />
                  <div className="flex items-center gap-2">
                    {showNotesToClient ? <Eye size={16} className="text-neutral-500" /> : <EyeOff size={16} className="text-neutral-400" />}
                    <span className="text-sm text-neutral-700">Show Notes to Client</span>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* NOTES */}
          <section className="rounded-xl border border-neutral-200 bg-[#F8FAFC] overflow-hidden">
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-200">
              <h2 className="text-sm sm:text-base font-semibold text-neutral-900">Notes</h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Additional notes about this template</p>
            </div>
            <div className="p-3 sm:p-5 bg-white">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Add any additional notes about this template (optional)" className={classNames(inputBase, "resize-none")} />
            </div>
          </section>
        </form>
      </div>

      {/* STICKY FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 sm:px-6 py-3 z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Error/Success messages */}
          <div className="flex-1 w-full sm:w-auto">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 break-words">{error}</p>
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-700">{success}</p>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              type="button" 
              onClick={handleBack} 
              disabled={submitting} 
              className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleSubmit} 
              disabled={submitting} 
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{isEdit ? "Saving..." : "Creating..."}</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{isEdit ? "Save" : "Create"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEditTemplatePage;