import { TemplateDocument } from "../../schemas/template.schema";

export interface TemplateResponse {
  id: string;
  name: string;
  category: string;
  serviceType: string;
  shippingModes: string[];
  headerFields?: Array<{
    id: string;
    label: string;
    inputType: string;
    options?: string[];
    defaultValue?: any;
    required?: boolean;
    order?: number;
  }>;
  items?: Array<{
    id: string;
    label: string;
    hasPrice: boolean;
    hasQuantity: boolean;
    hasDiscount: boolean;
    defaultPrice?: number | null;
    defaultQuantity?: number | null;
    defaultDiscount?: number | null;
    notes?: string;
    order?: number;
    applyTemplateDiscount?: boolean;
    applyTaxes?: boolean;
    taxRate?: number | null;
  }>;
  equipmentItems?: Array<{
    id: string;
    label: string;
    fields: Array<{
      key: string;
      label: string;
      inputType: "text" | "number";
      defaultValue?: string | number | null;
      order?: number;
    }>;
    hasPrice: boolean;
    hasQuantity: boolean;
    hasDiscount: boolean;
    defaultPrice?: number | null;
    defaultQuantity?: number | null;
    defaultDiscount?: number | null;
    applyTemplateDiscount?: boolean;
    applyTaxes?: boolean;
    taxRate?: number | null;
    order?: number;
  }>;
  pricingConfig: {
    currency: string;
    templatePrice?: number | null;
    templateDiscount?: number | null;
    applyTemplateDiscount?: boolean;
    templateTaxRate?: number | null;
    applyTemplateTaxes?: boolean;
  };
  notes?: string;
  showAgentToClient: boolean;
  showCarrierToClient: boolean;
  showCommodityToClient: boolean;
  showNotesToClient: boolean;
  companyId: {
    _id: string;
    name: string;
  };
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updatedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateResponse {
  id: string;
  name: string;
  createdAt: Date;
}

export interface TemplateListResponse {
  id: string;
  name: string;
  category: string;
  serviceType: string;
  shippingModes: string[];
  headerFields?: Array<{
    id: string;
    label: string;
    inputType: string;
    options?: string[];
    defaultValue?: any;
    required?: boolean;
    order?: number;
  }>;
  items?: Array<{
    id: string;
    label: string;
    hasPrice: boolean;
    hasQuantity: boolean;
    hasDiscount: boolean;
    defaultPrice?: number | null;
    defaultQuantity?: number | null;
    defaultDiscount?: number | null;
    notes?: string;
    order?: number;
    applyTemplateDiscount?: boolean;
    applyTaxes?: boolean;
    taxRate?: number | null;
  }>;
  equipmentItems?: Array<{
    id: string;
    label: string;
    fields: Array<{
      key: string;
      label: string;
      inputType: "text" | "number";
      defaultValue?: string | number | null;
      order?: number;
    }>;
    hasPrice: boolean;
    hasQuantity: boolean;
    hasDiscount: boolean;
    defaultPrice?: number | null;
    defaultQuantity?: number | null;
    defaultDiscount?: number | null;
    applyTemplateDiscount?: boolean;
    applyTaxes?: boolean;
    taxRate?: number | null;
    order?: number;
  }>;
  pricingConfig: {
    currency: string;
    templatePrice?: number | null;
    templateDiscount?: number | null;
    applyTemplateDiscount?: boolean;
    templateTaxRate?: number | null;
    applyTemplateTaxes?: boolean;
  };
  notes?: string;
  showAgentToClient: boolean;
  showCarrierToClient: boolean;
  showCommodityToClient: boolean;
  showNotesToClient: boolean;
  companyId: {
    _id: string;
    name: string;
  };
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updatedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TemplateSerializer {
  static toResponse(template: TemplateDocument | any): TemplateResponse {
    const templateObj = template.toObject ? template.toObject() : template;

    return {
      id: template._id.toString(),
      name: template.name,
      category: template.category,
      serviceType: template.serviceType,
      shippingModes: template.shippingModes || [],
      headerFields: template.headerFields,
      items: template.items,
      equipmentItems: template.equipmentItems,
      pricingConfig: template.pricingConfig,
      notes: template.notes,
      showAgentToClient: template.showAgentToClient,
      showCarrierToClient: template.showCarrierToClient,
      showCommodityToClient: template.showCommodityToClient,
      showNotesToClient: template.showNotesToClient,
      companyId: {
        _id: template.companyId?._id?.toString() || template.companyId?.toString(),
        name: template.companyId?.name || "",
      },
      createdBy: {
        _id: template.createdBy?._id?.toString() || template.createdBy?.toString(),
        firstName: template.createdBy?.firstName || "",
        lastName: template.createdBy?.lastName || "",
        email: template.createdBy?.email || "",
      },
      updatedBy: template.updatedBy
        ? {
            _id: template.updatedBy?._id?.toString() || template.updatedBy?.toString(),
            firstName: template.updatedBy?.firstName || "",
            lastName: template.updatedBy?.lastName || "",
            email: template.updatedBy?.email || "",
          }
        : undefined,
      isActive: template.isActive,
      createdAt: (templateObj as any).createdAt,
      updatedAt: (templateObj as any).updatedAt,
    };
  }

  static toCreateResponse(template: TemplateDocument | any): CreateTemplateResponse {
    const templateObj = template.toObject ? template.toObject() : template;

    return {
      id: template._id.toString(),
      name: template.name,
      createdAt: (templateObj as any).createdAt,
    };
  }

  static toListResponse(template: any): TemplateListResponse {
    return {
      id: template._id.toString(),
      name: template.name,
      category: template.category,
      serviceType: template.serviceType,
      shippingModes: template.shippingModes || [],
      headerFields: template.headerFields,
      items: template.items,
      equipmentItems: template.equipmentItems,
      pricingConfig: template.pricingConfig,
      notes: template.notes,
      showAgentToClient: template.showAgentToClient,
      showCarrierToClient: template.showCarrierToClient,
      showCommodityToClient: template.showCommodityToClient,
      showNotesToClient: template.showNotesToClient,
      companyId: {
        _id: template.companyId?._id?.toString() || template.companyId?.toString(),
        name: template.companyId?.name || "",
      },
      createdBy: {
        _id: template.createdBy?._id?.toString() || template.createdBy?.toString(),
        firstName: template.createdBy?.firstName || "",
        lastName: template.createdBy?.lastName || "",
        email: template.createdBy?.email || "",
      },
      updatedBy: template.updatedBy
        ? {
            _id: template.updatedBy?._id?.toString() || template.updatedBy?.toString(),
            firstName: template.updatedBy?.firstName || "",
            lastName: template.updatedBy?.lastName || "",
            email: template.updatedBy?.email || "",
          }
        : undefined,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}

