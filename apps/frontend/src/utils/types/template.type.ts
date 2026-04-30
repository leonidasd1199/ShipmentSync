export type TemplateHeaderFieldInputType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "textarea";

export type TemplateHeaderField = {
  id: string;
  label: string;
  inputType: TemplateHeaderFieldInputType;
  options?: string[];
  required?: boolean;
  order?: number;
};

export type TemplateItem = {
  id: string;
  label: string;

  hasPrice?: boolean;
  hasQuantity?: boolean;
  hasDiscount?: boolean;

  defaultPrice?: number | null;
  defaultQuantity?: number | null;
  defaultDiscount?: number | null;

  notes?: string;

  order?: number;

  applyTemplateDiscount?: boolean;
  applyTaxes?: boolean;
  taxRate?: number | null;
};

export type TemplateEquipmentField = {
  key: string;
  label: string;
  inputType: "text" | "number";
  defaultValue?: string | number | null;
  order?: number;
};

export type TemplateEquipmentItem = {
  id: string;
  label: string;
  fields?: TemplateEquipmentField[];

  hasPrice?: boolean;
  hasQuantity?: boolean;
  hasDiscount?: boolean;

  defaultPrice?: number | null;
  defaultQuantity?: number | null;
  defaultDiscount?: number | null;

  order?: number;

  applyTemplateDiscount?: boolean;
  applyTaxes?: boolean;
  taxRate?: number | null;
};

export type TemplatePricingConfig = {
  currency: string;
  templatePrice?: number | null;
  templateDiscount?: number | null;
  applyTemplateDiscount: boolean;
  templateTaxRate?: number | null;
  applyTemplateTaxes: boolean;
};

export type Template = {
  _id: string;
  name: string;

  category?: string | null;
  serviceType: string;
  shippingModes?: string[];

  headerFields?: TemplateHeaderField[];
  items: TemplateItem[];
  equipmentItems?: TemplateEquipmentItem[];
  pricingConfig?: TemplatePricingConfig;

  notes?: string;

  companyId: {
    _id: string;
    name: string;
  };

  createdBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };

  isActive?: boolean;

  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type TemplateFilters = {
  serviceType?: string;
  category?: string;        // SAME as backend: category = incoterm
  shippingMode?: string;
  isActive?: boolean;
};
