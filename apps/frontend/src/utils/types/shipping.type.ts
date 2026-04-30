export interface ShippingLine {
    _id: string;
    name: string;
    legalName?: string;
    email?: string;
    phone?: string;
    website?: string;
    notes?: string;
    shippingModes?: string[];
    createdAt: string;
    updatedAt: string;
    agents?: ShippingAgentSummary[];
  }
  
  export interface ShippingAgentSummary {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    country?: string;
  }
  
  export interface CreateShippingDto {
    name: string;
    legalName?: string;
    email?: string;
    phone?: string;
    website?: string;
    shippingModes?: string[];
    notes?: string;
  }
  
  export interface UpdateShippingDto {
    name?: string;
    legalName?: string;
    email?: string;
    phone?: string;
    website?: string;
    shippingModes?: string[];
    notes?: string;
  }
  
  export interface AddAgentsDto {
    agentIds: string[];
  }
  