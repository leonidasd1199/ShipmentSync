import { QuotationDocument } from "../../schemas/quotation.schema";

export interface QuotationResponse {
  id: string;
  quoteNumber?: string;
  templateId?: string;
  serviceType?: string;
incoterm?: string;
shippingMode?: "maritime" | "air" | "road";
  template?: {
    id: string;
    name: string;
    serviceType?: string;
    category?: string;
    headerFields?: any[];
    items?: any[];
    equipmentItems?: any[];
    pricingConfig?: any;
    notes?: string;
  };
  clientId: string;
  client?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  companyId: string;
  company?: {
    id: string;
    name: string;
  };
  shippingLineId: string;
  shippingLine?: {
    id: string;
    name: string;
    code?: string;
    shippingModes?: string[];
  };
  agentId?: string;
  agent?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  portOfOrigin?: string;
  portOfOriginData?: {
    id: string;
    name: string;
    unlocode?: string;
    countryCode?: string;
    countryName?: string;
    city?: string;
    type?: string;
  };
  portOfDestination?: string;
  portOfDestinationData?: {
    id: string;
    name: string;
    unlocode?: string;
    countryCode?: string;
    countryName?: string;
    city?: string;
    type?: string;
  };
  headerFieldValues?: Array<{
    fieldId: string;
    value: any;
  }>;
  items?: Array<{
    itemId: string;
    price?: number | null;
    quantity?: number | null;
    discount?: number | null;
    notes?: string;
    applyTemplateDiscount?: boolean;
    applyTaxes?: boolean;
    taxRate?: number | null;
  }>;
  equipmentItems?: Array<{
    equipmentItemId: string;
    quantity?: number | null;
    price?: number | null;
    discount?: number | null;
    fieldValues?: Array<{
      fieldKey: string;
      value: any;
    }>;
    notes?: string;
  }>;
  pricingConfig?: {
    currency: string;
    templatePrice?: number | null;
    templateDiscount?: number | null;
    applyTemplateDiscount?: boolean;
    templateTaxRate?: number | null;
    applyTemplateTaxes?: boolean;
  };
  legacyItems?: Array<{
    type: "cargo" | "custom";
    description: string;
    price: number;
    notes?: string;
    transitType?: "air" | "land" | "maritime";
  }>;
  notes?: string;
  validUntil: Date;
  summarize: boolean;
  total?: number;
  showAgentToClient: boolean;
  showCarrierToClient: boolean;
  showCommodityToClient: boolean;
  showNotesToClient: boolean;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  createdBy?: string;
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  createdAt: Date;
  updatedAt?: Date;
}

export interface QuotationListResponse {
  id: string;
  quoteNumber?: string;
    serviceType?: string;
  incoterm?: string;
  shippingMode?: "maritime" | "air" | "road";
  clientId: string;
  client?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  companyId: string;
  company?: {
    id: string;
    name: string;
  };
  shippingLineId: string;
  shippingLine?: {
    id: string;
    name: string;
  };
  agentId?: string;
  agent?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdBy: string;
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  portOfOrigin?: string;
  portOfDestination?: string;
  legacyItems?: Array<{
    type?: string;
    description: string;
    price?: number;
    cost?: number;
    quantity?: number;
    transitType?: string;
    equipmentType?: string;
  }>;
  items: Array<{
    type: "cargo" | "custom";
    description: string;
    price: number;
    notes?: string;
    transitType?: "air" | "land" | "maritime";
  }>;
  sourcePricelistId?: string;
  notes?: string;
  validUntil: Date;
  summarize: boolean;
  total?: number;
  createdAt: Date;
  updatedAt?: Date;
  status: string;
}

export class QuotationSerializer {
  /**
   * Para respuestas de findOne (con datos poblados)
   */
  static toResponse(quotation: QuotationDocument | any): QuotationResponse {
    const quotationObj = quotation.toObject ? quotation.toObject() : quotation;
    const q = quotationObj as any;

    // Helper para extraer ID de un campo que puede ser ObjectId, string, o objeto poblado
    const extractId = (field: any): string | undefined => {
      if (!field) return undefined;
      if (typeof field === "string") return field;
      if (field._id) return field._id.toString();
      if (field.toString) return field.toString();
      return undefined;
    };

    // Helper para extraer datos de template poblado
    const extractTemplate = (tpl: any) => {
      if (!tpl || typeof tpl === "string") return undefined;
      if (!tpl._id && !tpl.name) return undefined;
      return {
        id: tpl._id?.toString() || tpl.toString(),
        name: tpl.name,
        serviceType: tpl.serviceType,
        category: tpl.category,
        headerFields: tpl.headerFields,
        items: tpl.items,
        equipmentItems: tpl.equipmentItems,
        pricingConfig: tpl.pricingConfig,
        notes: tpl.notes,
      };
    };

    // Helper para extraer datos de client poblado
    const extractClient = (client: any) => {
      if (!client || typeof client === "string") return undefined;
      if (!client._id && !client.name) return undefined;
      return {
        id: client._id?.toString() || client.toString(),
        name: client.name,
        email: client.email,
        phone: client.phone,
      };
    };

    // Helper para extraer datos de company poblado
    const extractCompany = (company: any) => {
      if (!company || typeof company === "string") return undefined;
      if (!company._id && !company.name) return undefined;
      return {
        id: company._id?.toString() || company.toString(),
        name: company.name,
      };
    };

    // Helper para extraer datos de shippingLine poblado
    const extractShippingLine = (sl: any) => {
      if (!sl || typeof sl === "string") return undefined;
      if (!sl._id && !sl.name) return undefined;
      return {
        id: sl._id?.toString() || sl.toString(),
        name: sl.name,
        code: sl.code,
        shippingModes: sl.shippingModes,
      };
    };

    // Helper para extraer datos de agent poblado
    const extractAgent = (agent: any) => {
      if (!agent || typeof agent === "string") return undefined;
      if (!agent._id && !agent.firstName) return undefined;
      return {
        id: agent._id?.toString() || agent.toString(),
        firstName: agent.firstName,
        lastName: agent.lastName,
        email: agent.email,
      };
    };

    // Helper para extraer datos de port poblado
    const extractPort = (port: any) => {
      if (!port || typeof port === "string") return undefined;
      if (!port._id && !port.name) return undefined;
      return {
        id: port._id?.toString() || port.toString(),
        name: port.name,
        unlocode: port.unlocode,
        countryCode: port.countryCode,
        countryName: port.countryName,
        city: port.city,
        type: port.type,
      };
    };

    // Helper para extraer datos de creator poblado
    const extractCreator = (creator: any) => {
      if (!creator || typeof creator === "string") return undefined;
      if (!creator._id && !creator.firstName) return undefined;
      return {
        id: creator._id?.toString() || creator.toString(),
        firstName: creator.firstName,
        lastName: creator.lastName,
        email: creator.email,
      };
    };

    return {
      id: q._id?.toString() || q.id,
      quoteNumber: q.quoteNumber,
      serviceType: q.serviceType,
      incoterm: q.incoterm,
      shippingMode: q.shippingMode,
      templateId: extractId(q.templateId),
      template: extractTemplate(q.templateId),
      clientId: extractId(q.clientId) || "",
      client: extractClient(q.clientId),
      companyId: extractId(q.companyId) || "",
      company: extractCompany(q.companyId),
      shippingLineId: extractId(q.shippingLineId) || "",
      shippingLine: extractShippingLine(q.shippingLineId),
      agentId: extractId(q.agentId),
      agent: extractAgent(q.agentId),
      portOfOrigin: extractId(q.portOfOrigin),
      portOfOriginData: extractPort(q.portOfOrigin),
      portOfDestination: extractId(q.portOfDestination),
      portOfDestinationData: extractPort(q.portOfDestination),
      headerFieldValues: q.headerFieldValues,
      items: q.items,
      equipmentItems: q.equipmentItems,
      pricingConfig: q.pricingConfig,
      legacyItems: q.legacyItems,
      notes: q.notes,
      validUntil: q.validUntil,
      summarize: q.summarize,
      total: q.total,
      showAgentToClient: q.showAgentToClient !== undefined ? q.showAgentToClient : true,
      showCarrierToClient: q.showCarrierToClient !== undefined ? q.showCarrierToClient : true,
      showCommodityToClient: q.showCommodityToClient !== undefined ? q.showCommodityToClient : true,
      showNotesToClient: q.showNotesToClient !== undefined ? q.showNotesToClient : true,
      status: q.status,
      createdBy: extractId(q.createdBy),
      creator: extractCreator(q.createdBy),
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };
  }

  static toListResponse(quotation: any): QuotationListResponse {
    return {
      id: quotation._id.toString(),
      quoteNumber: quotation.quoteNumber,
        serviceType: quotation.serviceType,
  incoterm: quotation.incoterm,
  shippingMode: quotation.shippingMode,
      clientId: quotation.clientId?._id?.toString() || quotation.clientId?.toString(),
      client: quotation.clientId?.name
        ? {
            id: quotation.clientId._id?.toString() || quotation.clientId?.toString(),
            name: quotation.clientId.name,
            email: quotation.clientId.email,
            phone: quotation.clientId.phone,
          }
        : undefined,
      companyId: quotation.companyId?._id?.toString() || quotation.companyId?.toString(),
      company: quotation.companyId?.name
        ? {
            id: quotation.companyId._id?.toString() || quotation.companyId?.toString(),
            name: quotation.companyId.name,
          }
        : undefined,
      shippingLineId: quotation.shippingLineId?._id?.toString() || quotation.shippingLineId?.toString(),
      shippingLine: quotation.shippingLineId?.name
        ? {
            id: quotation.shippingLineId._id?.toString() || quotation.shippingLineId?.toString(),
            name: quotation.shippingLineId.name,
          }
        : undefined,
      agentId: quotation.agentId?._id?.toString() || quotation.agentId?.toString(),
      agent: quotation.agentId
        ? {
            id: quotation.agentId._id?.toString() || quotation.agentId?.toString(),
            firstName: quotation.agentId.firstName,
            lastName: quotation.agentId.lastName,
            email: quotation.agentId.email,
          }
        : undefined,
      createdBy: quotation.createdBy?._id?.toString() || quotation.createdBy?.toString(),
      creator: quotation.createdBy
        ? {
            id: quotation.createdBy._id?.toString() || quotation.createdBy?.toString(),
            firstName: quotation.createdBy.firstName,
            lastName: quotation.createdBy.lastName,
            email: quotation.createdBy.email,
          }
        : undefined,
      portOfOrigin: quotation.portOfOrigin?._id?.toString() ?? quotation.portOfOrigin?.toString() ?? undefined,
      portOfDestination: quotation.portOfDestination?._id?.toString() ?? quotation.portOfDestination?.toString() ?? undefined,
      legacyItems: quotation.legacyItems,
      items: quotation.items || quotation.legacyItems,
      sourcePricelistId: quotation.sourcePricelistId,
      notes: quotation.notes,
      validUntil: quotation.validUntil,
      summarize: quotation.summarize,
      total: quotation.total,
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
      status: quotation.status
    };
  }
}