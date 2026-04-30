import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { AgentPricingService } from "./agent-pricing.service";
import {
  UpsertPricelistDto,
  UpsertPricelistItemDto,
} from "../agents/dto/upsert-pricelist.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UserId, UserEmail } from "../auth/current-user.decorator";
import { AgentId } from "../auth/agent-id.decorator";
import { AgentGuard } from "../auth/agent.guard";
import { getWeekStart } from "../common/utils/week-calculation.util";
import { PortsService } from "../ports/ports.service";

@ApiTags("agent-pricing")
@ApiBearerAuth("JWT-auth")
@Controller("agents/pricing")
@UseGuards(JwtAuthGuard, AgentGuard)
export class AgentPricingController {
  constructor(
    private readonly agentPricingService: AgentPricingService,
    private readonly portsService: PortsService,
  ) {}

  @Get("ports")
  @ApiOperation({ summary: "List all active ports (agent access)" })
  async getPorts() {
    return this.portsService.findAll({ isActive: true });
  }

  @Get("suppliers")
  @ApiOperation({
    summary: "List suppliers that an agent can manage",
    description:
      "Returns paginated list of suppliers associated with the agent, with search support. Agent ID is extracted from JWT token.",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Search by supplier name (case-insensitive)",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 20)",
  })
  @ApiResponse({
    status: 200,
    description: "List of suppliers with pagination",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              supplierId: { type: "string" },
              name: { type: "string" },
              isApproved: { type: "boolean" },
            },
          },
        },
        page: { type: "number" },
        limit: { type: "number" },
        total: { type: "number" },
      },
    },
  })
  async listAgentSuppliers(
    @AgentId() agentId: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.agentPricingService.listAgentSuppliers(agentId, {
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("suppliers/:supplierId")
  @ApiOperation({
    summary: "Get pricelist for agent-supplier pair",
    description:
      "Returns pricelist items with filtering, sorting, and pagination support. Default sort: createdAt:desc. Returns empty items array if pricelist doesn't exist. Agent ID is extracted from JWT token.",
  })
  @ApiParam({
    name: "supplierId",
    description: "Supplier (Shipping) MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Search items by name (case-insensitive)",
  })
  @ApiQuery({
    name: "incoterm",
    required: false,
    description: "Filter items by incoterm (e.g., FOB, CIF)",
  })
  @ApiQuery({
    name: "currency",
    required: false,
    description: "Filter items by currency (e.g., USD, EUR)",
  })
  @ApiQuery({
    name: "sort",
    required: false,
    description: "Sort in format 'field:order' (e.g., 'createdAt:desc'). Default: 'createdAt:desc'",
    example: "createdAt:desc",
  })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["name", "incoterm", "cost", "currency", "createdAt"],
    description: "Field to sort by (default: createdAt). Ignored if 'sort' parameter is provided.",
  })
  @ApiQuery({
    name: "sortOrder",
    required: false,
    enum: ["asc", "desc"],
    description: "Sort direction (default: desc). Ignored if 'sort' parameter is provided.",
  })
  @ApiQuery({
    name: "from",
    required: false,
    description: "Date range start (ISO 8601 format, filters by item creation date)",
    example: "2024-01-01T00:00:00Z",
  })
  @ApiQuery({
    name: "to",
    required: false,
    description: "Date range end (ISO 8601 format, filters by item creation date)",
    example: "2024-12-31T23:59:59Z",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["draft", "approved"],
    description: "Filter by status (draft/approved). Note: Status field not yet implemented in schema.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 20, max: 100)",
  })
  @ApiResponse({
    status: 200,
    description: "Pricelist with items and pagination metadata",
    schema: {
      type: "object",
      properties: {
        supplierId: { type: "string" },
        pricelistId: { type: "string" },
        weekStart: { type: "string", format: "date-time" },
        weekEnd: { type: "string", format: "date-time" },
        status: { type: "string", enum: ["draft", "submitted", "approved", "rejected", "superseded"] },
        submittedAt: { type: "string", format: "date-time" },
        approvedAt: { type: "string", format: "date-time" },
        rejectedAt: { type: "string", format: "date-time" },
        totalCost: { type: "number" },
        itemCount: { type: "number" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              incoterm: { type: "string" },
              cost: { type: "number" },
              currency: { type: "string" },
              metadata: { type: "object" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
        pagination: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            total: { type: "number" },
            totalPages: { type: "number" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Agent is not associated with this supplier",
  })
  async getPricelist(
    @AgentId() agentId: string,
    @Param("supplierId") supplierId: string,
    @Query("search") search?: string,
    @Query("incoterm") incoterm?: string,
    @Query("currency") currency?: string,
    @Query("sort") sort?: string,
    @Query("sortBy") sortBy?: "name" | "incoterm" | "cost" | "currency" | "createdAt",
    @Query("sortOrder") sortOrder?: "asc" | "desc",
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.agentPricingService.getPricelist(agentId, supplierId, {
      search,
      incoterm,
      currency,
      sort,
      sortBy,
      sortOrder,
      from,
      to,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("suppliers/:supplierId/pricelists")
  @ApiOperation({
    summary: "Get list of pricelists (history) for agent-supplier pair",
    description:
      "Returns paginated list of pricelist summaries (not full items) with filtering by week range, status, and search. Agent ID is extracted from JWT token.",
  })
  @ApiParam({
    name: "supplierId",
    description: "Supplier (Shipping) MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiQuery({
    name: "weekFrom",
    required: false,
    description: "Filter pricelists from this week onwards (ISO 8601 date, will be normalized to Monday)",
    example: "2024-01-01",
  })
  @ApiQuery({
    name: "weekTo",
    required: false,
    description: "Filter pricelists up to this week (ISO 8601 date, will be normalized to Monday)",
    example: "2024-12-31",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["draft", "submitted", "approved", "rejected", "superseded"],
    description: "Filter by pricelist status",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Search pricelists by item name/concept (case-insensitive)",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Pricelists per page (default: 20, max: 100)",
  })
  @ApiResponse({
    status: 200,
    description: "List of pricelist summaries with pagination",
    schema: {
      type: "object",
      properties: {
        supplierId: { type: "string" },
        pricelists: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pricelistId: { type: "string" },
              weekStart: { type: "string", format: "date-time" },
              weekEnd: { type: "string", format: "date-time" },
              status: { type: "string", enum: ["draft", "submitted", "approved", "rejected", "superseded"] },
              submittedAt: { type: "string", format: "date-time" },
              approvedAt: { type: "string", format: "date-time" },
              rejectedAt: { type: "string", format: "date-time" },
              totalCost: { type: "number" },
              itemCount: { type: "number" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
        pagination: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            total: { type: "number" },
            totalPages: { type: "number" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Agent is not associated with this supplier",
  })
  async getPricelists(
    @AgentId() agentId: string,
    @Param("supplierId") supplierId: string,
    @Query("weekFrom") weekFrom?: string,
    @Query("weekTo") weekTo?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.agentPricingService.getPricelists(agentId, supplierId, {
      weekFrom,
      weekTo,
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("pricelists/:pricelistId")
  @ApiOperation({
    summary: "Get a specific pricelist by ID with full items",
    description:
      "Returns the complete pricelist with all items for a specific version/week. Agent ID is extracted from JWT token. Validates that the agent has access to this pricelist.",
  })
  @ApiParam({
    name: "pricelistId",
    description: "Pricelist MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiResponse({
    status: 200,
    description: "Pricelist with full items",
    schema: {
      type: "object",
      properties: {
        supplierId: { type: "string" },
        pricelistId: { type: "string" },
        weekStart: { type: "string", format: "date-time" },
        weekEnd: { type: "string", format: "date-time" },
        status: { type: "string", enum: ["draft", "submitted", "approved", "rejected", "superseded"] },
        submittedAt: { type: "string", format: "date-time" },
        approvedAt: { type: "string", format: "date-time" },
        rejectedAt: { type: "string", format: "date-time" },
        totalCost: { type: "number" },
        itemCount: { type: "number" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              incoterm: { type: "string" },
              cost: { type: "number" },
              currency: { type: "string" },
              metadata: { type: "object" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Agent does not have access to this pricelist",
  })
  @ApiResponse({
    status: 404,
    description: "Pricelist not found",
  })
  async getPricelistById(
    @AgentId() agentId: string,
    @Param("pricelistId") pricelistId: string,
  ) {
    return this.agentPricingService.getPricelistById(agentId, pricelistId);
  }

  @Put("suppliers/:supplierId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Save/Update pricelist for agent-supplier pair",
    description:
      "Creates or updates pricelist by replacing all items. Uses upsert operation. Agent ID is extracted from JWT token.",
  })
  @ApiParam({
    name: "supplierId",
    description: "Supplier (Shipping) MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiBody({ type: UpsertPricelistDto })
  @ApiResponse({
    status: 200,
    description: "Pricelist upserted successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Agent is not associated with this supplier",
  })
  async upsertPricelist(
    @AgentId() agentId: string,
    @Param("supplierId") supplierId: string,
    @Body() dto: UpsertPricelistDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.agentPricingService.upsertPricelist(
      agentId,
      supplierId,
      dto,
      userId,
      userEmail,
    );
  }

  @Post("suppliers/:supplierId/items")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Add a single item to the current week's pricelist",
    description:
      "Adds a new item to the current week's draft pricelist. Creates a draft pricelist if one doesn't exist. Only draft pricelists can be edited. Agent ID is extracted from JWT token.",
  })
  @ApiParam({
    name: "supplierId",
    description: "Supplier (Shipping) MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiBody({ type: UpsertPricelistItemDto })
  @ApiResponse({
    status: 200,
    description: "Item added successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request data",
  })
  @ApiResponse({
    status: 403,
    description: "Agent is not associated with this supplier",
  })
  @ApiResponse({
    status: 409,
    description: "A non-draft pricelist already exists for this week",
  })
  async addItem(
    @AgentId() agentId: string,
    @Param("supplierId") supplierId: string,
    @Body() itemDto: UpsertPricelistItemDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.agentPricingService.addItem(
      agentId,
      supplierId,
      itemDto,
      userId,
      userEmail,
    );
  }

  @Put("suppliers/:supplierId/items/:itemId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update a single item in the current week's pricelist",
    description:
      "Updates an existing item in the current week's draft pricelist. Only draft pricelists can be edited. Agent ID is extracted from JWT token.",
  })
  @ApiParam({
    name: "supplierId",
    description: "Supplier (Shipping) MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiParam({
    name: "itemId",
    description: "Item MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiBody({ type: UpsertPricelistItemDto })
  @ApiResponse({
    status: 200,
    description: "Item updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request data",
  })
  @ApiResponse({
    status: 403,
    description: "Agent is not associated with this supplier",
  })
  @ApiResponse({
    status: 404,
    description: "Pricelist or item not found",
  })
  async updateItem(
    @AgentId() agentId: string,
    @Param("supplierId") supplierId: string,
    @Param("itemId") itemId: string,
    @Body() itemDto: UpsertPricelistItemDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.agentPricingService.updateItem(
      agentId,
      supplierId,
      itemId,
      itemDto,
      userId,
      userEmail,
    );
  }

  @Delete("suppliers/:supplierId/items/:itemId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Delete item from pricelist",
    description:
      "Removes a specific item from the pricelist by item ID. Agent ID is extracted from JWT token. Only draft pricelists can be edited.",
  })
  @ApiParam({
    name: "supplierId",
    description: "Supplier (Shipping) MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiParam({
    name: "itemId",
    description: "Pricelist item MongoDB _id",
    example: "507f1f77bcf86cd799439013",
  })
  @ApiResponse({
    status: 200,
    description: "Item deleted successfully, returns updated items",
  })
  @ApiResponse({
    status: 404,
    description: "Pricelist or item not found",
  })
  @ApiResponse({
    status: 403,
    description: "Cannot edit pricelist - only draft pricelists can be edited",
  })
  async deleteItem(
    @AgentId() agentId: string,
    @Param("supplierId") supplierId: string,
    @Param("itemId") itemId: string,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.agentPricingService.deleteItem(
      agentId,
      supplierId,
      itemId,
      userId,
      userEmail,
    );
  }

  @Post("suppliers/:supplierId/submit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Submit pricelist for approval",
    description:
      "Submits a draft pricelist for operator approval. Only draft pricelists can be submitted. Uses the current week's pricelist. Agent ID is extracted from JWT token.",
  })
  @ApiParam({
    name: "supplierId",
    description: "Supplier (Shipping) MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiResponse({
    status: 200,
    description: "Pricelist submitted successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Pricelist cannot be submitted (wrong status)",
  })
  @ApiResponse({
    status: 404,
    description: "Pricelist not found",
  })
  async submitPricelist(
    @AgentId() agentId: string,
    @Param("supplierId") supplierId: string,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    // Always use current week - weekStart is calculated automatically
    const weekStartNormalized = getWeekStart(new Date());

    return this.agentPricingService.submitPricelist(
      agentId,
      supplierId,
      weekStartNormalized,
      userId,
      userEmail,
    );
  }
}
