import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Agent, AgentDocument } from "../schemas/agent.schema";
import { Shipping, ShippingDocument } from "../schemas/shipping.schema";
import {
  AgentPricelist,
  AgentPricelistDocument,
  PricelistItem,
  PricelistStatus,
} from "../schemas/agent-pricelist.schema";
import {
  UpsertPricelistDto,
  UpsertPricelistItemDto,
} from "../agents/dto/upsert-pricelist.dto";
import { HistoryService } from "../history/history.service";
import { getWeekStart, getWeekEnd } from "../common/utils/week-calculation.util";

export interface ListAgentSuppliersQuery {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListAgentSuppliersResponse {
  data: Array<{
    supplierId: string;
    name: string;
    isApproved: boolean;
  }>;
  page: number;
  limit: number;
  total: number;
}

export interface GetPricelistQuery {
  search?: string; // Search by item name (case-insensitive)
  incoterm?: string; // Filter by incoterm
  currency?: string; // Filter by currency
  sortBy?: "name" | "incoterm" | "cost" | "currency" | "createdAt"; // Sort field
  sortOrder?: "asc" | "desc"; // Sort direction (default: desc for createdAt, asc for others)
  sort?: string; // Sort in format "field:order" (e.g., "createdAt:desc")
  from?: string; // Date range start (ISO 8601 format, filters by item createdAt)
  to?: string; // Date range end (ISO 8601 format, filters by item createdAt)
  status?: string; // Status filter (draft/approved) - Note: Currently not implemented in schema
  page?: number; // Page number (default: 1)
  limit?: number; // Items per page (default: 20, max: 100)
}

export interface PricelistResponse {
  supplierId: string;
  pricelistId?: string;
  weekStart?: Date;
  weekEnd?: Date;
  status?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  totalCost?: number;
  itemCount?: number;
  items: Array<{
    id: string;
    name: string;
    chargeType: string;
    incoterm: string;
    equipmentType?: string;
    lane?: {
      originPortCode?: string;
      destinationPortCode?: string;
      originName?: string;
      destinationName?: string;
    };
    cost: number;
    currency: string;
    pricingUnit?: string;
    validFrom?: Date;
    validTo?: Date;
    freeTimeDays?: number;
    transitTimeDaysMin?: number;
    transitTimeDaysMax?: number;
    carrierName?: string;
    metadata?: any;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetPricelistsQuery {
  weekFrom?: string; // Week start date (ISO 8601) - filter pricelists from this week onwards
  weekTo?: string; // Week start date (ISO 8601) - filter pricelists up to this week
  status?: string; // Filter by status (draft/submitted/approved/rejected/superseded)
  search?: string; // Search by item name/concept within pricelists (optional)
  page?: number; // Page number (default: 1)
  limit?: number; // Pricelists per page (default: 20, max: 100)
}

export interface PricelistSummary {
  pricelistId: string;
  weekStart: Date;
  weekEnd?: Date;
  status: string;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  totalCost: number;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricelistsListResponse {
  supplierId: string;
  pricelists: PricelistSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class AgentPricingService {
  /**
   * Helper method to map pricelist item to response format
   */
  private mapItemToResponse(item: any, pricelistCreatedAt?: Date, pricelistUpdatedAt?: Date) {
    return {
      id: item._id?.toString() || "",
      name: item.name,
      chargeType: item.chargeType,
      incoterm: item.incoterm,
      equipmentType: item.equipmentType,
      lane: item.lane,
      cost: item.cost,
      profit: item.profit ?? 0,
      currency: item.currency,
      pricingUnit: item.pricingUnit,
      validFrom: item.validFrom,
      validTo: item.validTo,
      freeTimeDays: item.freeTimeDays,
      transitTimeDaysMin: item.transitTimeDaysMin,
      transitTimeDaysMax: item.transitTimeDaysMax,
      carrierName: item.carrierName,
      metadata: item.metadata,
      createdAt: pricelistCreatedAt || item.createdAt,
      updatedAt: pricelistUpdatedAt || item.updatedAt,
    };
  }
  constructor(
    @InjectModel(AgentPricelist.name)
    private pricelistModel: Model<AgentPricelistDocument>,
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
    @InjectModel(Shipping.name) private shippingModel: Model<ShippingDocument>,
    private historyService: HistoryService,
  ) {}

  /**
   * List suppliers that an agent is allowed to manage (associated with)
   * Supports pagination and search
   */
  async listAgentSuppliers(
    agentId: string,
    query: ListAgentSuppliersQuery = {},
  ): Promise<ListAgentSuppliersResponse> {
    // Validate agent exists
    let agentObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(agentId);
    } catch (error) {
      throw new BadRequestException(`Invalid agentId format: "${agentId}"`);
    }

    const agent = await this.agentModel.findById(agentObjectId).exec();
    if (!agent) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    if (!agent.isActive) {
      throw new BadRequestException("Agent is not active");
    }

    // Get suppliers associated with this agent
    // An agent is associated with a supplier if:
    // 1. agent.shippingLineId === supplier._id, OR
    // 2. supplier.agents array contains agent._id
    const associationFilter: any[] = [];

    if (agent.shippingLineId) {
      associationFilter.push({ _id: agent.shippingLineId });
    }
    if (agent.shippingLineIds?.length) {
      associationFilter.push({ _id: { $in: agent.shippingLineIds } });
    }
    associationFilter.push({ agents: agentObjectId });

    const queryFilter: any = {
      isActive: true,
      $or: associationFilter,
    };

    // Apply search filter (case-insensitive search on supplier name only)
    if (query.search) {
      queryFilter.name = { $regex: query.search, $options: "i" };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await this.shippingModel.countDocuments(queryFilter).exec();

    // Get paginated suppliers
    const suppliers = await this.shippingModel
      .find(queryFilter)
      .select("_id name isActive")
      .skip(skip)
      .limit(limit)
      .sort({ name: 1 })
      .lean()
      .exec();

    // Check which suppliers have pricelists (for isApproved flag)
    const supplierIds = suppliers.map((s) => s._id);
    const pricelists = await this.pricelistModel
      .find({
        agentId: agentObjectId,
        supplierId: { $in: supplierIds },
      })
      .select("supplierId")
      .lean()
      .exec();

    const suppliersWithPricelists = new Set(
      pricelists.map((p) => p.supplierId.toString()),
    );

    const data = suppliers.map((supplier) => ({
      supplierId: supplier._id.toString(),
      name: supplier.name,
      isApproved: suppliersWithPricelists.has(supplier._id.toString()),
    }));

    return {
      data,
      page,
      limit,
      total,
    };
  }

  /**
   * Get pricelist for an agent-supplier pair
   * Returns empty items array if pricelist doesn't exist
   * Supports filtering, sorting, and pagination
   */
  async getPricelist(
    agentId: string,
    supplierId: string,
    query: GetPricelistQuery = {},
  ): Promise<PricelistResponse> {
    // Validate agent exists
    let agentObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(agentId);
    } catch (error) {
      throw new BadRequestException(`Invalid agentId format: "${agentId}"`);
    }

    const agent = await this.agentModel.findById(agentObjectId).exec();
    if (!agent) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    // Validate supplier exists
    let supplierObjectId: Types.ObjectId;
    try {
      supplierObjectId = new Types.ObjectId(supplierId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid supplierId format: "${supplierId}"`,
      );
    }

    const supplier = await this.shippingModel.findById(supplierObjectId).exec();
    if (!supplier) {
      throw new NotFoundException(`Supplier with id "${supplierId}" not found`);
    }

    // Validate association
    const isAssociated =
      agent.shippingLineId?.toString() === supplierId ||
      agent.shippingLineIds?.some((id) => id.toString() === supplierId) ||
      supplier.agents.some((id) => id.toString() === agentId);

    if (!isAssociated) {
      throw new ForbiddenException(
        "Agent is not associated with this supplier",
      );
    }

    // Determine which week to query (default to current week if not specified)
    // For now, we'll get the most recent pricelist, but ideally we'd accept weekStart as parameter
    // TODO: Add weekStart parameter to GetPricelistQuery
    // Handle both old pricelists (without weekStart) and new ones (with weekStart)
    const pricelistDoc = await this.pricelistModel
      .findOne({
        agentId: agentObjectId,
        supplierId: supplierObjectId,
      })
      .sort({ 
        // Sort by weekStart if it exists, otherwise by createdAt
        weekStart: -1,
        createdAt: -1 
      }) // Get the most recent week's pricelist
      .exec() as AgentPricelistDocument | null;

    // If no pricelist document exists, return 404
    if (!pricelistDoc) {
      throw new NotFoundException(
        `No pricelist found for supplier ${supplierId} and agent ${agentId}`,
      );
    }

    // If pricelist exists but has no items, return empty items array with full metadata
    if (!pricelistDoc.items || pricelistDoc.items.length === 0) {
      const pricelistTyped = pricelistDoc as unknown as AgentPricelistDocument;
      const pricelistAnyResponse = pricelistTyped as any;
      return {
        supplierId: supplier._id.toString(),
        pricelistId: pricelistTyped._id.toString(),
        weekStart: pricelistAnyResponse.weekStart,
        weekEnd: pricelistAnyResponse.weekEnd,
        status: pricelistAnyResponse.status || PricelistStatus.APPROVED,
        submittedAt: pricelistAnyResponse.submittedAt,
        approvedAt: pricelistAnyResponse.approvedAt,
        rejectedAt: pricelistAnyResponse.rejectedAt,
        rejectionReason: pricelistAnyResponse.rejectionReason,
        totalCost: pricelistAnyResponse.totalCost || 0,
        itemCount: pricelistAnyResponse.itemCount || 0,
        items: [],
        pagination: {
          page: query.page || 1,
          limit: query.limit || 20,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const pricelist = pricelistDoc as AgentPricelistDocument;

    // Filter by status if specified (at pricelist level)
    const pricelistAny = pricelist as any;
    const pricelistStatus = pricelistAny.status || PricelistStatus.APPROVED; // Default for old pricelists
    if (query.status && pricelistStatus !== query.status) {
      return {
        supplierId: supplier._id.toString(),
        pricelistId: pricelistAny._id.toString(),
        weekStart: pricelistAny.weekStart,
        weekEnd: pricelistAny.weekEnd,
        status: pricelistStatus,
        submittedAt: pricelistAny.submittedAt,
        approvedAt: pricelistAny.approvedAt,
        rejectedAt: pricelistAny.rejectedAt,
        rejectionReason: pricelistAny.rejectionReason,
        items: [],
        pagination: {
          page: query.page || 1,
          limit: query.limit || 20,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Parse sort parameter if provided in "field:order" format
    let sortBy = query.sortBy;
    let sortOrder = query.sortOrder;
    
    if (query.sort) {
      const sortParts = query.sort.split(":");
      if (sortParts.length === 2) {
        sortBy = sortParts[0] as "name" | "incoterm" | "cost" | "currency" | "createdAt";
        sortOrder = sortParts[1] as "asc" | "desc";
      } else if (sortParts.length === 1) {
        sortBy = sortParts[0] as "name" | "incoterm" | "cost" | "currency" | "createdAt";
      }
    }

    // Apply filters
    let filteredItems = [...pricelist.items];

    // Filter by search (item name)
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredItems = filteredItems.filter((item) =>
        item.name.toLowerCase().includes(searchLower),
      );
    }

    // Filter by incoterm
    if (query.incoterm) {
      filteredItems = filteredItems.filter(
        (item) => item.incoterm === query.incoterm,
      );
    }

    // Filter by currency
    if (query.currency) {
      filteredItems = filteredItems.filter(
        (item) => item.currency === query.currency,
      );
    }

    // Filter by date range (from/to)
    if (query.from || query.to) {
      filteredItems = filteredItems.filter((item) => {
        if (!item._id) return false;
        
        let itemDate: Date;
        if (Types.ObjectId.isValid(item._id)) {
          itemDate = new Types.ObjectId(item._id).getTimestamp();
        } else {
          return false;
        }

        if (query.from) {
          const fromDate = new Date(query.from);
          if (itemDate < fromDate) return false;
        }

        if (query.to) {
          const toDate = new Date(query.to);
          // Include the entire day for 'to' date
          toDate.setHours(23, 59, 59, 999);
          if (itemDate > toDate) return false;
        }

        return true;
      });
    }

    // Filter by status
    if (query.status) {
      // Note: This filters pricelists by status, but since we're getting items from a single pricelist,
      // we need to check the pricelist status first
      const pricelistAny = pricelist as any;
      const pricelistStatus = pricelistAny.status || PricelistStatus.APPROVED; // Default for old pricelists
      if (pricelistStatus !== query.status) {
        // If status doesn't match, return empty items
        filteredItems = [];
      }
    }

    // Sort items - default to createdAt:desc
    sortBy = sortBy || "createdAt";
    sortOrder = sortOrder || (sortBy === "createdAt" ? "desc" : "asc");

    filteredItems.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "incoterm":
          aValue = a.incoterm;
          bValue = b.incoterm;
          break;
        case "cost":
          aValue = a.cost;
          bValue = b.cost;
          break;
        case "currency":
          aValue = a.currency;
          bValue = b.currency;
          break;
        case "createdAt":
          // Use MongoDB ObjectId timestamp to get item creation date
          // ObjectId contains a timestamp of when it was created
          // If _id is not available, fall back to pricelist updatedAt
          if (a._id && Types.ObjectId.isValid(a._id)) {
            aValue = new Types.ObjectId(a._id).getTimestamp().getTime();
          } else {
            aValue = pricelist.updatedAt?.getTime() || 0;
          }
          if (b._id && Types.ObjectId.isValid(b._id)) {
            bValue = new Types.ObjectId(b._id).getTimestamp().getTime();
          } else {
            bValue = pricelist.updatedAt?.getTime() || 0;
          }
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) {
        return sortOrder === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOrder === "asc" ? 1 : -1;
      }
      return 0;
    });

    // Pagination
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100); // Max 100 items per page
    const total = filteredItems.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    const paginatedItems = filteredItems.slice(skip, skip + limit);

    // Map items to response format
    const items = paginatedItems.map((item) =>
      this.mapItemToResponse(item, pricelist.createdAt, pricelist.updatedAt),
    );

    const pricelistTyped = pricelist as unknown as AgentPricelistDocument;
    const pricelistAnyResponse = pricelistTyped as any;
    return {
      supplierId: supplier._id.toString(),
      pricelistId: pricelistTyped._id.toString(),
      weekStart: pricelistAnyResponse.weekStart,
      weekEnd: pricelistAnyResponse.weekEnd,
      status: pricelistAnyResponse.status || PricelistStatus.APPROVED, // Default for old pricelists
      submittedAt: pricelistAnyResponse.submittedAt,
      approvedAt: pricelistAnyResponse.approvedAt,
      rejectedAt: pricelistAnyResponse.rejectedAt,
      rejectionReason: pricelistAnyResponse.rejectionReason,
      totalCost: pricelistAnyResponse.totalCost,
      itemCount: pricelistAnyResponse.itemCount,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get list of pricelists (history) for an agent-supplier pair
   * Returns summaries of pricelists with filtering and pagination
   */
  async getPricelists(
    agentId: string,
    supplierId: string,
    query: GetPricelistsQuery = {},
  ): Promise<PricelistsListResponse> {
    // Validate agent exists
    let agentObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(agentId);
    } catch (error) {
      throw new BadRequestException(`Invalid agentId format: "${agentId}"`);
    }

    const agent = await this.agentModel.findById(agentObjectId).exec();
    if (!agent) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    // Validate supplier exists
    let supplierObjectId: Types.ObjectId;
    try {
      supplierObjectId = new Types.ObjectId(supplierId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid supplierId format: "${supplierId}"`,
      );
    }

    const supplier = await this.shippingModel.findById(supplierObjectId).exec();
    if (!supplier) {
      throw new NotFoundException(`Supplier with id "${supplierId}" not found`);
    }

    // Validate association
    const isAssociated =
      agent.shippingLineId?.toString() === supplierId ||
      agent.shippingLineIds?.some((id) => id.toString() === supplierId) ||
      supplier.agents.some((id) => id.toString() === agentId);

    if (!isAssociated) {
      throw new ForbiddenException(
        "Agent is not associated with this supplier",
      );
    }

    // Build query filter
    const filter: any = {
      agentId: agentObjectId,
      supplierId: supplierObjectId,
    };

    // Filter by week range (weekFrom and weekTo)
    if (query.weekFrom || query.weekTo) {
      filter.weekStart = {};
      if (query.weekFrom) {
        const weekFromDate = getWeekStart(new Date(query.weekFrom));
        filter.weekStart.$gte = weekFromDate;
      }
      if (query.weekTo) {
        const weekToDate = getWeekStart(new Date(query.weekTo));
        // Add 7 days to get the end of that week
        const weekToEnd = new Date(weekToDate);
        weekToEnd.setDate(weekToEnd.getDate() + 6);
        filter.weekStart.$lte = weekToEnd;
      }
    }

    // Filter by status
    if (query.status) {
      filter.status = query.status;
    }

    // Build search filter for items (if q is provided)
    // We'll filter pricelists that have items matching the search term
    let searchFilter: any = {};
    if (query.search) {
      searchFilter = {
        "items.name": {
          $regex: query.search,
          $options: "i", // Case-insensitive
        },
      };
    }

    // Combine filters
    const finalFilter = { ...filter, ...searchFilter };

    // Get total count for pagination
    const total = await this.pricelistModel.countDocuments(finalFilter).exec();

    // Pagination
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100); // Max 100 pricelists per page
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Fetch pricelists with pagination
    const pricelists = await this.pricelistModel
      .find(finalFilter)
      .sort({ weekStart: -1, createdAt: -1 }) // Most recent weeks first
      .skip(skip)
      .limit(limit)
      .exec() as AgentPricelistDocument[];

    // Map to summary format
    const pricelistSummaries: PricelistSummary[] = pricelists.map((pricelist) => {
      const pricelistAny = pricelist as any;
      
      // If search filter is provided, filter items to only include matching ones for itemCount
      let itemCount = pricelistAny.itemCount || 0;
      let totalCost = pricelistAny.totalCost || 0;
      
      if (query.search && pricelistAny.items) {
        const matchingItems = pricelistAny.items.filter((item: any) =>
          item.name?.toLowerCase().includes(query.search!.toLowerCase())
        );
        itemCount = matchingItems.length;
        totalCost = matchingItems.reduce((sum: number, item: any) => sum + (item.cost || 0), 0);
      }

      return {
        pricelistId: pricelistAny._id.toString(),
        weekStart: pricelistAny.weekStart || pricelistAny.createdAt,
        weekEnd: pricelistAny.weekEnd,
        status: pricelistAny.status || PricelistStatus.APPROVED,
        submittedAt: pricelistAny.submittedAt,
        approvedAt: pricelistAny.approvedAt,
        rejectedAt: pricelistAny.rejectedAt,
        totalCost,
        itemCount,
        createdAt: pricelistAny.createdAt,
        updatedAt: pricelistAny.updatedAt,
      };
    });

    return {
      supplierId: supplier._id.toString(),
      pricelists: pricelistSummaries,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get a specific pricelist by ID with full items
   * Returns the complete pricelist for a specific version/week
   */
  async getPricelistById(
    agentId: string,
    pricelistId: string,
  ): Promise<PricelistResponse> {
    // Validate agent exists
    let agentObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(agentId);
    } catch (error) {
      throw new BadRequestException(`Invalid agentId format: "${agentId}"`);
    }

    const agent = await this.agentModel.findById(agentObjectId).exec();
    if (!agent) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    // Validate pricelist ID
    let pricelistObjectId: Types.ObjectId;
    try {
      pricelistObjectId = new Types.ObjectId(pricelistId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid pricelistId format: "${pricelistId}"`,
      );
    }

    // Find pricelist
    const pricelistDoc = await this.pricelistModel
      .findById(pricelistObjectId)
      .exec() as AgentPricelistDocument | null;

    if (!pricelistDoc) {
      throw new NotFoundException(
        `Pricelist with id "${pricelistId}" not found`,
      );
    }

    const pricelist = pricelistDoc as unknown as AgentPricelistDocument;

    // Verify the pricelist belongs to this agent
    const pricelistAgentId = (pricelist as any).agentId?.toString();
    if (pricelistAgentId !== agentId) {
      throw new ForbiddenException(
        "You do not have access to this pricelist",
      );
    }

    // Get supplier to validate association
    const supplierId = (pricelist as any).supplierId?.toString();
    if (!supplierId) {
      throw new NotFoundException("Supplier not found for this pricelist");
    }

    let supplierObjectId: Types.ObjectId;
    try {
      supplierObjectId = new Types.ObjectId(supplierId);
    } catch (error) {
      throw new BadRequestException(`Invalid supplierId format: "${supplierId}"`);
    }

    const supplier = await this.shippingModel.findById(supplierObjectId).exec();
    if (!supplier) {
      throw new NotFoundException(`Supplier with id "${supplierId}" not found`);
    }

    // Validate association (double-check)
    const isAssociated =
      agent.shippingLineId?.toString() === supplierId ||
      agent.shippingLineIds?.some((id) => id.toString() === supplierId) ||
      supplier.agents.some((id) => id.toString() === agentId);

    if (!isAssociated) {
      throw new ForbiddenException(
        "Agent is not associated with this supplier",
      );
    }

    // Map items to response format
    const pricelistAny = pricelist as any;
    const items = (pricelistAny.items || []).map((item: any) => ({
      id: item._id?.toString() || "",
      name: item.name,
      incoterm: item.incoterm,
      cost: item.cost,
      currency: item.currency,
      metadata: item.metadata,
      createdAt: pricelistAny.createdAt,
      updatedAt: pricelistAny.updatedAt,
    }));

    return {
      supplierId: supplier._id.toString(),
      pricelistId: pricelistAny._id.toString(),
      weekStart: pricelistAny.weekStart,
      weekEnd: pricelistAny.weekEnd,
      status: pricelistAny.status || PricelistStatus.APPROVED,
      submittedAt: pricelistAny.submittedAt,
      approvedAt: pricelistAny.approvedAt,
      rejectedAt: pricelistAny.rejectedAt,
      rejectionReason: pricelistAny.rejectionReason,
      totalCost: pricelistAny.totalCost || 0,
      itemCount: pricelistAny.itemCount || items.length,
      items,
    };
  }

  /**
   * Upsert pricelist (replace items fully)
   * Now supports weekly identity and status management
   */
  async upsertPricelist(
    agentId: string,
    supplierId: string,
    dto: UpsertPricelistDto,
    userId: string,
    userEmail: string,
  ): Promise<PricelistResponse> {
    // Validate agent exists
    let agentObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(agentId);
    } catch (error) {
      throw new BadRequestException(`Invalid agentId format: "${agentId}"`);
    }

    const agent = await this.agentModel.findById(agentObjectId).exec();
    if (!agent) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    // Validate supplier exists
    let supplierObjectId: Types.ObjectId;
    try {
      supplierObjectId = new Types.ObjectId(supplierId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid supplierId format: "${supplierId}"`,
      );
    }

    const supplier = await this.shippingModel.findById(supplierObjectId).exec();
    if (!supplier) {
      throw new NotFoundException(`Supplier with id "${supplierId}" not found`);
    }

    // Validate association
    const isAssociated =
      agent.shippingLineId?.toString() === supplierId ||
      agent.shippingLineIds?.some((id) => id.toString() === supplierId) ||
      supplier.agents.some((id) => id.toString() === agentId);

    if (!isAssociated) {
      throw new ForbiddenException(
        "Agent is not associated with this supplier",
      );
    }

    // Validate items (DTO validation already handles this, but double-check)
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException("Items array cannot be empty");
    }

    // Calculate weekStart and weekEnd automatically (always use current week)
    // weekStart is always calculated, never provided by the user
    const weekStart = getWeekStart(new Date());
    const weekEnd = getWeekEnd(weekStart);

    // Check for existing active pricelist in the same week
    // Only check for pricelists that have weekStart (new schema)
    const existingPricelistDoc = await this.pricelistModel
      .findOne({
        agentId: agentObjectId,
        supplierId: supplierObjectId,
        weekStart: weekStart,
        status: {
          $in: [
            PricelistStatus.DRAFT,
            PricelistStatus.SUBMITTED,
            PricelistStatus.APPROVED,
          ],
        },
      })
      .exec() as AgentPricelistDocument | null;
    
    const existingPricelist = existingPricelistDoc as unknown as AgentPricelistDocument | null;

    // If existing pricelist exists
    if (existingPricelist) {
      // Only allow editing if status is DRAFT
      const existingStatus = (existingPricelist as any).status || PricelistStatus.DRAFT;
      if (existingStatus !== PricelistStatus.DRAFT) {
        throw new ConflictException(
          `A pricelist with status "${existingStatus}" already exists for this week. Only draft pricelists can be edited.`,
        );
      }
      // If it's draft, we'll update it below
    }

    // Convert DTO items to schema format
    const items: PricelistItem[] = dto.items.map((item) => ({
      name: item.name,
      chargeType: item.chargeType,
      incoterm: item.incoterm,
      equipmentType: item.equipmentType,
      lane: item.lane,
      cost: item.cost,
      currency: item.currency,
      pricingUnit: item.pricingUnit,
      validFrom: item.validFrom ? new Date(item.validFrom) : undefined,
      validTo: item.validTo ? new Date(item.validTo) : undefined,
      freeTimeDays: item.freeTimeDays,
      transitTimeDaysMin: item.transitTimeDaysMin,
      transitTimeDaysMax: item.transitTimeDaysMax,
      carrierName: item.carrierName,
      metadata: item.metadata,
    }));

    // Calculate totals (will also be computed by pre-save hook, but set here for clarity)
    const totalCost = items.reduce((sum, item) => sum + (item.cost || 0), 0);
    const itemCount = items.length;

    // Upsert pricelist (replace items fully)
    let pricelist: AgentPricelistDocument;

    if (existingPricelist && (existingPricelist as any).status === PricelistStatus.DRAFT) {
      // Update existing draft pricelist
      const updated = await this.pricelistModel
        .findByIdAndUpdate(
          (existingPricelist as any)._id,
          {
            $set: {
              items,
              weekStart,
              weekEnd,
              totalCost,
              itemCount,
              status: PricelistStatus.DRAFT,
            },
          },
          { new: true },
        )
        .exec();
      if (!updated) {
        throw new NotFoundException("Failed to update pricelist");
      }
      pricelist = updated as AgentPricelistDocument;
    } else {
      // Create new pricelist
      pricelist = (await this.pricelistModel.create({
        agentId: agentObjectId,
        supplierId: supplierObjectId,
        weekStart,
        weekEnd,
        items,
        totalCost,
        itemCount,
        status: PricelistStatus.DRAFT,
      })) as AgentPricelistDocument;
    }

    // Log history
    await this.historyService.log({
      action: pricelist.createdAt === pricelist.updatedAt ? "create" : "update",
      entityType: "agent_pricelist",
      entityId: pricelist._id.toString(),
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Pricelist ${pricelist.createdAt === pricelist.updatedAt ? "created" : "updated"} for agent ${agentId} and supplier ${supplierId}`,
      after: pricelist,
    });

    const pricelistTyped = pricelist as unknown as AgentPricelistDocument;
    return {
      supplierId: supplier._id.toString(),
      pricelistId: pricelistTyped._id.toString(),
      weekStart: pricelistTyped.weekStart,
      weekEnd: pricelistTyped.weekEnd,
      status: pricelistTyped.status,
      submittedAt: pricelistTyped.submittedAt,
      approvedAt: pricelistTyped.approvedAt,
      rejectedAt: pricelistTyped.rejectedAt,
      rejectionReason: pricelistTyped.rejectionReason,
      totalCost: pricelistTyped.totalCost,
      itemCount: pricelistTyped.itemCount,
      items: pricelistTyped.items.map((item) =>
        this.mapItemToResponse(item),
      ),
    };
  }

  /**
   * Submit pricelist for approval (agent action)
   */
  async submitPricelist(
    agentId: string,
    supplierId: string,
    weekStart: Date,
    userId: string,
    userEmail: string,
  ): Promise<PricelistResponse> {
    const pricelist = await this.findPricelistByWeek(
      agentId,
      supplierId,
      weekStart,
    );

    const pricelistTyped = pricelist as unknown as AgentPricelistDocument;
    if (pricelistTyped.status !== PricelistStatus.DRAFT) {
      throw new BadRequestException(
        `Pricelist with status "${pricelistTyped.status}" cannot be submitted. Only draft pricelists can be submitted.`,
      );
    }

    pricelistTyped.status = PricelistStatus.SUBMITTED;
    pricelistTyped.submittedAt = new Date();
    await pricelistTyped.save();

    await this.historyService.log({
      action: "submit",
      entityType: "agent_pricelist",
      entityId: pricelist._id.toString(),
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Pricelist submitted for approval`,
      after: pricelist,
    });

    return this.mapPricelistToResponse(pricelist);
  }

  /**
   * Approve pricelist (operator action)
   */
  async approvePricelist(
    pricelistId: string,
    userId: string,
    userEmail: string,
  ): Promise<PricelistResponse> {
    let pricelistObjectId: Types.ObjectId;
    try {
      pricelistObjectId = new Types.ObjectId(pricelistId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid pricelistId format: "${pricelistId}"`,
      );
    }

    const pricelistDoc = await this.pricelistModel
      .findById(pricelistObjectId)
      .exec() as AgentPricelistDocument | null;

    if (!pricelistDoc) {
      throw new NotFoundException(`Pricelist with id "${pricelistId}" not found`);
    }

    const pricelist = pricelistDoc as unknown as AgentPricelistDocument;

    if ((pricelist as AgentPricelistDocument).status !== PricelistStatus.SUBMITTED) {
      throw new BadRequestException(
        `Pricelist with status "${(pricelist as AgentPricelistDocument).status}" cannot be approved. Only submitted pricelists can be approved.`,
      );
    }

    let approverObjectId: Types.ObjectId;
    try {
      approverObjectId = new Types.ObjectId(userId);
    } catch (error) {
      throw new BadRequestException(`Invalid userId format: "${userId}"`);
    }

    (pricelist as AgentPricelistDocument).status = PricelistStatus.APPROVED;
    (pricelist as AgentPricelistDocument).approvedAt = new Date();
    (pricelist as AgentPricelistDocument).approvedBy = approverObjectId;
    await (pricelist as AgentPricelistDocument).save();

    await this.historyService.log({
      action: "approve",
      entityType: "agent_pricelist",
      entityId: pricelist._id.toString(),
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Pricelist approved`,
      after: pricelist,
    });

    return this.mapPricelistToResponse(pricelist);
  }

  /**
   * Reject pricelist (operator action)
   */
  async rejectPricelist(
    pricelistId: string,
    rejectionReason: string,
    userId: string,
    userEmail: string,
  ): Promise<PricelistResponse> {
    let pricelistObjectId: Types.ObjectId;
    try {
      pricelistObjectId = new Types.ObjectId(pricelistId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid pricelistId format: "${pricelistId}"`,
      );
    }

    const pricelistDoc = await this.pricelistModel
      .findById(pricelistObjectId)
      .exec() as AgentPricelistDocument | null;

    if (!pricelistDoc) {
      throw new NotFoundException(`Pricelist with id "${pricelistId}" not found`);
    }

    const pricelist = pricelistDoc as unknown as AgentPricelistDocument;

    if ((pricelist as AgentPricelistDocument).status !== PricelistStatus.SUBMITTED) {
      throw new BadRequestException(
        `Pricelist with status "${(pricelist as AgentPricelistDocument).status}" cannot be rejected. Only submitted pricelists can be rejected.`,
      );
    }

    let rejectorObjectId: Types.ObjectId;
    try {
      rejectorObjectId = new Types.ObjectId(userId);
    } catch (error) {
      throw new BadRequestException(`Invalid userId format: "${userId}"`);
    }

    // Set status back to DRAFT so agent can fix and resubmit
    (pricelist as AgentPricelistDocument).status = PricelistStatus.DRAFT;
    // Keep rejection metadata for audit trail
    (pricelist as AgentPricelistDocument).rejectedAt = new Date();
    (pricelist as AgentPricelistDocument).rejectedBy = rejectorObjectId;
    (pricelist as AgentPricelistDocument).rejectionReason = rejectionReason;
    await (pricelist as AgentPricelistDocument).save();

    await this.historyService.log({
      action: "reject",
      entityType: "agent_pricelist",
      entityId: pricelist._id.toString(),
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Pricelist rejected: ${rejectionReason}`,
      after: pricelist,
    });

    return this.mapPricelistToResponse(pricelist);
  }

  /**
   * Supersede pricelist (mark old pricelist as superseded when creating new one)
   */
  async supersedePricelist(
    pricelistId: string,
    userId: string,
    userEmail: string,
  ): Promise<void> {
    let pricelistObjectId: Types.ObjectId;
    try {
      pricelistObjectId = new Types.ObjectId(pricelistId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid pricelistId format: "${pricelistId}"`,
      );
    }

    const pricelistDoc = await this.pricelistModel
      .findById(pricelistObjectId)
      .exec() as AgentPricelistDocument | null;

    if (!pricelistDoc) {
      throw new NotFoundException(`Pricelist with id "${pricelistId}" not found`);
    }

    const pricelist = pricelistDoc as unknown as AgentPricelistDocument;
    (pricelist as AgentPricelistDocument).status = PricelistStatus.SUPERSEDED;
    await (pricelist as AgentPricelistDocument).save();

    await this.historyService.log({
      action: "supersede",
      entityType: "agent_pricelist",
      entityId: pricelist._id.toString(),
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Pricelist superseded by new pricelist`,
      after: pricelist,
    });
  }

  /**
   * Helper: Find pricelist by week
   */
  private async findPricelistByWeek(
    agentId: string,
    supplierId: string,
    weekStart: Date,
  ): Promise<AgentPricelistDocument> {
    let agentObjectId: Types.ObjectId;
    let supplierObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(agentId);
      supplierObjectId = new Types.ObjectId(supplierId);
    } catch (error) {
      throw new BadRequestException("Invalid agentId or supplierId format");
    }

    const pricelist = await this.pricelistModel
      .findOne({
        agentId: agentObjectId,
        supplierId: supplierObjectId,
        weekStart: weekStart,
      })
      .exec();

    if (!pricelist) {
      throw new NotFoundException(
        `Pricelist not found for agent ${agentId}, supplier ${supplierId}, week ${weekStart.toISOString()}`,
      );
    }

    return pricelist;
  }

  /**
   * Helper: Map pricelist to response format
   */
  private mapPricelistToResponse(
    pricelist: AgentPricelistDocument,
  ): PricelistResponse {
    const pricelistTyped = pricelist as unknown as AgentPricelistDocument;
    return {
      supplierId: pricelistTyped.supplierId.toString(),
      pricelistId: pricelistTyped._id.toString(),
      weekStart: pricelistTyped.weekStart,
      weekEnd: pricelistTyped.weekEnd,
      status: pricelistTyped.status,
      submittedAt: pricelistTyped.submittedAt,
      approvedAt: pricelistTyped.approvedAt,
      rejectedAt: pricelistTyped.rejectedAt,
      rejectionReason: pricelistTyped.rejectionReason,
      totalCost: pricelistTyped.totalCost,
      itemCount: pricelistTyped.itemCount,
      items: pricelistTyped.items.map((item) =>
        this.mapItemToResponse(item),
      ),
    };
  }

  /**
   * Add a single item to the current week's pricelist
   * Creates a draft pricelist if one doesn't exist for the current week
   */
  async addItem(
    agentId: string,
    supplierId: string,
    itemDto: UpsertPricelistItemDto,
    userId: string,
    userEmail: string,
  ): Promise<PricelistResponse> {
    // Validate agent exists
    let agentObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(agentId);
    } catch (error) {
      throw new BadRequestException(`Invalid agentId format: "${agentId}"`);
    }

    const agent = await this.agentModel.findById(agentObjectId).exec();
    if (!agent) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    // Validate supplier exists
    let supplierObjectId: Types.ObjectId;
    try {
      supplierObjectId = new Types.ObjectId(supplierId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid supplierId format: "${supplierId}"`,
      );
    }

    const supplier = await this.shippingModel.findById(supplierObjectId).exec();
    if (!supplier) {
      throw new NotFoundException(`Supplier with id "${supplierId}" not found`);
    }

    // Validate association
    const isAssociated =
      agent.shippingLineId?.toString() === supplierId ||
      agent.shippingLineIds?.some((id) => id.toString() === supplierId) ||
      supplier.agents.some((id) => id.toString() === agentId);

    if (!isAssociated) {
      throw new ForbiddenException(
        "Agent is not associated with this supplier",
      );
    }

    // Calculate weekStart and weekEnd for current week
    const weekStart = getWeekStart(new Date());
    const weekEnd = getWeekEnd(weekStart);

    // Find or create draft pricelist for current week
    let pricelistDoc = await this.pricelistModel
      .findOne({
        agentId: agentObjectId,
        supplierId: supplierObjectId,
        weekStart: weekStart,
        status: PricelistStatus.DRAFT,
      })
      .exec() as AgentPricelistDocument | null;

    if (!pricelistDoc) {
      // Check if there's an active pricelist (non-draft) for this week
      const existingActive = await this.pricelistModel
        .findOne({
          agentId: agentObjectId,
          supplierId: supplierObjectId,
          weekStart: weekStart,
          status: {
            $in: [
              PricelistStatus.SUBMITTED,
              PricelistStatus.APPROVED,
            ],
          },
        })
        .exec();

      if (existingActive) {
        throw new ConflictException(
          `A pricelist with status "${(existingActive as any).status}" already exists for this week. Only draft pricelists can be edited.`,
        );
      }

      // Create new draft pricelist
      pricelistDoc = await this.pricelistModel.create({
        agentId: agentObjectId,
        supplierId: supplierObjectId,
        weekStart,
        weekEnd,
        items: [],
        status: PricelistStatus.DRAFT,
        totalCost: 0,
        itemCount: 0,
      });
    }

    const pricelist = pricelistDoc as unknown as AgentPricelistDocument;

    // Prepare new item
    const newItem = {
      name: itemDto.name,
      chargeType: itemDto.chargeType,
      incoterm: itemDto.incoterm,
      equipmentType: itemDto.equipmentType,
      lane: itemDto.lane,
      cost: itemDto.cost,
      profit: itemDto.profit ?? 0,
      currency: itemDto.currency,
      pricingUnit: itemDto.pricingUnit,
      validFrom: itemDto.validFrom ? new Date(itemDto.validFrom) : undefined,
      validTo: itemDto.validTo ? new Date(itemDto.validTo) : undefined,
      freeTimeDays: itemDto.freeTimeDays,
      transitTimeDaysMin: itemDto.transitTimeDaysMin,
      transitTimeDaysMax: itemDto.transitTimeDaysMax,
      carrierName: itemDto.carrierName,
      metadata: itemDto.metadata,
    };

    // Add item using $push
    const updatedDoc = await this.pricelistModel
      .findByIdAndUpdate(
        pricelist._id,
        {
          $push: { items: newItem },
        },
        { new: true },
      )
      .exec() as AgentPricelistDocument | null;

    if (!updatedDoc) {
      throw new NotFoundException("Pricelist not found after update");
    }

    const updatedTyped = updatedDoc as unknown as AgentPricelistDocument;

    // Log history (non-blocking — agent JWT may lack email/userId fields)
    try {
      await this.historyService.log({
        action: "update",
        entityType: "agent_pricelist",
        entityId: updatedTyped._id.toString(),
        actorUserId: userId || agentId,
        actorEmail: userEmail || undefined,
        actorName: userEmail || agentId,
        origin: "api",
        status: "success",
        summary: `Item "${itemDto.name}" added to pricelist for agent ${agentId} and supplier ${supplierId}`,
        after: updatedTyped,
      });
    } catch { /* history logging is non-critical */ }

    return {
      supplierId: supplier._id.toString(),
      pricelistId: updatedTyped._id.toString(),
      weekStart: updatedTyped.weekStart,
      weekEnd: updatedTyped.weekEnd,
      status: updatedTyped.status,
      submittedAt: updatedTyped.submittedAt,
      approvedAt: updatedTyped.approvedAt,
      rejectedAt: updatedTyped.rejectedAt,
      rejectionReason: updatedTyped.rejectionReason,
      totalCost: updatedTyped.totalCost,
      itemCount: updatedTyped.itemCount,
      items: updatedTyped.items.map((item) =>
        this.mapItemToResponse(item),
      ),
    };
  }

  /**
   * Update a single item in the current week's pricelist
   * Only allows updating items in draft pricelists
   */
  async updateItem(
    agentId: string,
    supplierId: string,
    itemId: string,
    itemDto: UpsertPricelistItemDto,
    userId: string,
    userEmail: string,
  ): Promise<PricelistResponse> {
    // Validate agent exists
    let agentObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(agentId);
    } catch (error) {
      throw new BadRequestException(`Invalid agentId format: "${agentId}"`);
    }

    const agent = await this.agentModel.findById(agentObjectId).exec();
    if (!agent) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    // Validate supplier exists
    let supplierObjectId: Types.ObjectId;
    try {
      supplierObjectId = new Types.ObjectId(supplierId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid supplierId format: "${supplierId}"`,
      );
    }

    const supplier = await this.shippingModel.findById(supplierObjectId).exec();
    if (!supplier) {
      throw new NotFoundException(`Supplier with id "${supplierId}" not found`);
    }

    // Validate association
    const isAssociated =
      agent.shippingLineId?.toString() === supplierId ||
      agent.shippingLineIds?.some((id) => id.toString() === supplierId) ||
      supplier.agents.some((id) => id.toString() === agentId);

    if (!isAssociated) {
      throw new ForbiddenException(
        "Agent is not associated with this supplier",
      );
    }

    // Validate itemId
    let itemObjectId: Types.ObjectId;
    try {
      itemObjectId = new Types.ObjectId(itemId);
    } catch (error) {
      throw new BadRequestException(`Invalid itemId format: "${itemId}"`);
    }

    // Calculate weekStart for current week
    const weekStart = getWeekStart(new Date());

    // First check if ANY pricelist exists for current week (any status)
    const anyPricelistDoc = await this.pricelistModel
      .findOne({
        agentId: agentObjectId,
        supplierId: supplierObjectId,
        weekStart: weekStart,
      })
      .exec() as AgentPricelistDocument | null;

    if (!anyPricelistDoc) {
      throw new NotFoundException(
        "No pricelist found for this week.",
      );
    }

    // If pricelist exists but is not DRAFT, throw ConflictException
    if (anyPricelistDoc.status !== PricelistStatus.DRAFT) {
      throw new ConflictException(
        `Cannot edit pricelist. Pricelist is ${anyPricelistDoc.status} and can only be edited when in draft status.`,
      );
    }

    const pricelist = anyPricelistDoc as unknown as AgentPricelistDocument;

    // Check if item exists
    const itemIndex = pricelist.items.findIndex(
      (item) => item._id?.toString() === itemId,
    );

    if (itemIndex === -1) {
      throw new NotFoundException(`Item with id "${itemId}" not found`);
    }

    // Update item using positional operator $set
    const updatedDoc = await this.pricelistModel
      .findByIdAndUpdate(
        pricelist._id,
        {
          $set: {
            [`items.${itemIndex}.name`]: itemDto.name,
            [`items.${itemIndex}.chargeType`]: itemDto.chargeType,
            [`items.${itemIndex}.incoterm`]: itemDto.incoterm,
            [`items.${itemIndex}.equipmentType`]: itemDto.equipmentType,
            [`items.${itemIndex}.lane`]: itemDto.lane,
            [`items.${itemIndex}.cost`]: itemDto.cost,
            [`items.${itemIndex}.profit`]: itemDto.profit ?? 0,
            [`items.${itemIndex}.currency`]: itemDto.currency,
            [`items.${itemIndex}.pricingUnit`]: itemDto.pricingUnit,
            [`items.${itemIndex}.validFrom`]: itemDto.validFrom
              ? new Date(itemDto.validFrom)
              : undefined,
            [`items.${itemIndex}.validTo`]: itemDto.validTo
              ? new Date(itemDto.validTo)
              : undefined,
            [`items.${itemIndex}.freeTimeDays`]: itemDto.freeTimeDays,
            [`items.${itemIndex}.transitTimeDaysMin`]: itemDto.transitTimeDaysMin,
            [`items.${itemIndex}.transitTimeDaysMax`]: itemDto.transitTimeDaysMax,
            [`items.${itemIndex}.carrierName`]: itemDto.carrierName,
            [`items.${itemIndex}.metadata`]: itemDto.metadata,
          },
        },
        { new: true },
      )
      .exec() as AgentPricelistDocument | null;

    if (!updatedDoc) {
      throw new NotFoundException("Pricelist not found after update");
    }

    const updatedTyped = updatedDoc as unknown as AgentPricelistDocument;

    // Log history (non-blocking — agent JWT may lack email/userId fields)
    try {
      await this.historyService.log({
        action: "update",
        entityType: "agent_pricelist",
        entityId: updatedTyped._id.toString(),
        actorUserId: userId || agentId,
        actorEmail: userEmail || undefined,
        actorName: userEmail || agentId,
        origin: "api",
        status: "success",
        summary: `Item "${itemDto.name}" updated in pricelist for agent ${agentId} and supplier ${supplierId}`,
        after: updatedTyped,
      });
    } catch { /* history logging is non-critical */ }

    return {
      supplierId: supplier._id.toString(),
      pricelistId: updatedTyped._id.toString(),
      weekStart: updatedTyped.weekStart,
      weekEnd: updatedTyped.weekEnd,
      status: updatedTyped.status,
      submittedAt: updatedTyped.submittedAt,
      approvedAt: updatedTyped.approvedAt,
      rejectedAt: updatedTyped.rejectedAt,
      rejectionReason: updatedTyped.rejectionReason,
      totalCost: updatedTyped.totalCost,
      itemCount: updatedTyped.itemCount,
      items: updatedTyped.items.map((item) =>
        this.mapItemToResponse(item),
      ),
    };
  }

  /**
   * Delete item from pricelist
   * Only allows deleting items from draft pricelists
   */
  async deleteItem(
    agentId: string,
    supplierId: string,
    itemId: string,
    userId: string,
    userEmail: string,
  ): Promise<PricelistResponse> {
    // Validate agent exists
    let agentObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(agentId);
    } catch (error) {
      throw new BadRequestException(`Invalid agentId format: "${agentId}"`);
    }

    const agent = await this.agentModel.findById(agentObjectId).exec();
    if (!agent) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    // Validate supplier exists
    let supplierObjectId: Types.ObjectId;
    try {
      supplierObjectId = new Types.ObjectId(supplierId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid supplierId format: "${supplierId}"`,
      );
    }

    const supplier = await this.shippingModel.findById(supplierObjectId).exec();
    if (!supplier) {
      throw new NotFoundException(`Supplier with id "${supplierId}" not found`);
    }

    // Validate association
    const isAssociated =
      agent.shippingLineId?.toString() === supplierId ||
      agent.shippingLineIds?.some((id) => id.toString() === supplierId) ||
      supplier.agents.some((id) => id.toString() === agentId);

    if (!isAssociated) {
      throw new ForbiddenException(
        "Agent is not associated with this supplier",
      );
    }

    // Validate itemId
    let itemObjectId: Types.ObjectId;
    try {
      itemObjectId = new Types.ObjectId(itemId);
    } catch (error) {
      throw new BadRequestException(`Invalid itemId format: "${itemId}"`);
    }

    // Calculate weekStart for current week
    const weekStart = getWeekStart(new Date());

    // First check if ANY pricelist exists for current week (any status)
    const anyPricelistDoc = await this.pricelistModel
      .findOne({
        agentId: agentObjectId,
        supplierId: supplierObjectId,
        weekStart: weekStart,
      })
      .exec() as AgentPricelistDocument | null;

    if (!anyPricelistDoc) {
      throw new NotFoundException(
        "No pricelist found for this week.",
      );
    }

    // If pricelist exists but is not DRAFT, throw ConflictException
    if (anyPricelistDoc.status !== PricelistStatus.DRAFT) {
      throw new ConflictException(
        `Cannot delete items from pricelist. Pricelist is ${anyPricelistDoc.status} and can only be edited when in draft status.`,
      );
    }

    const pricelist = anyPricelistDoc as unknown as AgentPricelistDocument;

    // Check if item exists
    const itemExists = pricelist.items.some(
      (item) => item._id?.toString() === itemId,
    );

    if (!itemExists) {
      throw new NotFoundException(`Item with id "${itemId}" not found`);
    }

    // Remove item using $pull
    const updatedDoc = await this.pricelistModel
      .findByIdAndUpdate(
        pricelist._id,
        {
          $pull: { items: { _id: itemObjectId } },
        },
        { new: true },
      )
      .exec() as AgentPricelistDocument | null;

    if (!updatedDoc) {
      throw new NotFoundException("Pricelist not found after update");
    }

    const updatedTyped = updatedDoc as unknown as AgentPricelistDocument;

    // Log history (non-blocking — agent JWT may lack email/userId fields)
    try {
      await this.historyService.log({
        action: "update",
        entityType: "agent_pricelist",
        entityId: updatedTyped._id.toString(),
        actorUserId: userId || agentId,
        actorEmail: userEmail || undefined,
        actorName: userEmail || agentId,
        origin: "api",
        status: "success",
        summary: `Item ${itemId} deleted from pricelist for agent ${agentId} and supplier ${supplierId}`,
        after: updatedTyped,
      });
    } catch { /* history logging is non-critical */ }
    return {
      supplierId: supplier._id.toString(),
      pricelistId: updatedTyped._id.toString(),
      weekStart: updatedTyped.weekStart,
      weekEnd: updatedTyped.weekEnd,
      status: updatedTyped.status,
      submittedAt: updatedTyped.submittedAt,
      approvedAt: updatedTyped.approvedAt,
      rejectedAt: updatedTyped.rejectedAt,
      rejectionReason: updatedTyped.rejectionReason,
      totalCost: updatedTyped.totalCost,
      itemCount: updatedTyped.itemCount,
      items: updatedTyped.items.map((item) =>
        this.mapItemToResponse(item),
      ),
    };
  }
}
