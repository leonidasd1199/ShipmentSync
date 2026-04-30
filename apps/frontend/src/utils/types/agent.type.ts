export type ObjectId = string;

export type AgentAddress = {
  street: string;
  city: string;
  country: string;
  state?: string;
  zip?: string;
};

export type ShippingLineRef = {
  id: ObjectId;
  name: string;
};

export type Agent = {
  id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string | null;
  address: AgentAddress;
  notes?: string | null;
  shippingLines: ShippingLineRef[];

  isActive: boolean;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
};

export type CreateAgentDto = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  address: AgentAddress;
  notes?: string;
  shippingLineId?: ObjectId; // opcional
};

export type UpdateAgentDto = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: Partial<AgentAddress>;
  notes?: string;
  shippingLineId?: ObjectId; 
  isActive?: boolean;
};

export type PaginatedAgentsResponse = {
  items: Agent[];
  page: number;
  pageSize: number;
  total: number;
};
