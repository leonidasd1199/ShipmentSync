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
  ApiBody,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { AgentsService, type AgentResponse } from "./agents.service";
import type { CreateAgentDto, UpdateAgentDto } from "./agents.service";
import { MagicLinkService } from "./magic-link.service";
import {
  GenerateMagicLinkDto,
  MagicLinkResponseDto,
} from "./dto/magic-link.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { UserId, UserEmail } from "../auth/current-user.decorator";

@ApiTags("agents")
@ApiBearerAuth("JWT-auth")
@Controller("agents")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly magicLinkService: MagicLinkService,
  ) {}

  @Get()
  @RequirePermissionDecorator("agent:list")
  @ApiOperation({ summary: "Get all agents with filtering and pagination" })
  @ApiQuery({
    name: "assigned",
    required: false,
    enum: ["all", "true", "false"],
    description:
      "Filter by assignment status: 'all' (default), 'true' (only assigned), 'false' (only unassigned)",
    example: "all",
  })
  @ApiQuery({
    name: "shippingLineId",
    required: false,
    description: "Filter agents by specific shipping line ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
    example: 1,
  })
  @ApiQuery({
    name: "pageSize",
    required: false,
    type: Number,
    description: "Items per page (default: 50)",
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: "List of agents with pagination",
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                example: "507f1f77bcf86cd799439011",
                description: "MongoDB ObjectId",
              },
              firstName: { type: "string", example: "Juan" },
              lastName: { type: "string", example: "Ramírez" },
              email: { type: "string", example: "juan@agencia.com" },
              phone: { type: "string", example: "+504 9999-9999" },
              shippingLines: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      example: "507f1f77bcf86cd799439011",
                    },
                    name: { type: "string", example: "Maersk Line" },
                  },
                },
                example: [
                  { id: "507f1f77bcf86cd799439011", name: "Maersk Line" },
                ],
              },
            },
          },
        },
        page: { type: "number", example: 1 },
        pageSize: { type: "number", example: 50 },
        total: { type: "number", example: 2 },
      },
    },
  })
  @ApiResponse({ status: 403, description: "Forbidden" })
  // async findAll(
  //   @Query("assigned") assigned?: "all" | "true" | "false",
  //   @Query("shippingLineId") shippingLineId?: string,
  //   @Query("page") page?: string,
  //   @Query("pageSize") pageSize?: string,
  // ) {
  //   return this.agentsService.findAll(
  //     assigned || "all",
  //     shippingLineId,
  //     page ? parseInt(page, 10) : 1,
  //     pageSize ? parseInt(pageSize, 10) : 50,
  //   );
  // }
  async findAll(
    @Query("assigned") assigned?: "all" | "true" | "false",
    @Query("shippingLineId") shippingLineId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ): Promise<{
    items: AgentResponse[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    return this.agentsService.findAll(
      assigned || "all",
      shippingLineId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50
    );
  }

  @Post()
  @RequirePermissionDecorator("agent:create")
  @ApiOperation({ summary: "Create a new agent" })
  @ApiBody({
    description: "Agent creation data",
    schema: {
      type: "object",
      properties: {
        firstName: { type: "string", example: "Juan" },
        lastName: { type: "string", example: "Ramírez" },
        email: { type: "string", example: "juan@agencia.com" },
        phone: { type: "string", example: "+504 9999-9999" },
        whatsapp: { type: "string", example: "+504 8888-8888" },
        address: {
          type: "object",
          properties: {
            street: { type: "string", example: "Blvd. del Sur" },
            city: { type: "string", example: "San Pedro Sula" },
            state: { type: "string", example: "Cortés" },
            zipCode: { type: "string", example: "21101" },
            country: { type: "string", example: "Honduras" },
          },
          required: ["street", "city", "country"],
        },
        notes: {
          type: "string",
          example: "Agente operativo en Puerto Cortés.",
        },
        shippingLineId: {
          type: "string",
          example: "507f1f77bcf86cd799439011",
          description: "MongoDB ObjectId of shipping line (optional)",
        },
      },
      required: ["firstName", "lastName", "email", "phone", "address"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Agent created successfully (with shippingLineId)",
    schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          example: "507f1f77bcf86cd799439011",
          description: "MongoDB ObjectId",
        },
        firstName: { type: "string", example: "Juan" },
        lastName: { type: "string", example: "Ramírez" },
        shippingLineId: {
          type: "string",
          example: "507f1f77bcf86cd799439011",
        },
        createdAt: { type: "string", example: "2025-11-03T20:00:00Z" },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "Agent created successfully (without shippingLineId)",
    schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          example: "507f1f77bcf86cd799439011",
          description: "MongoDB ObjectId",
        },
        firstName: { type: "string", example: "Laura" },
        lastName: { type: "string", example: "Martínez" },
        createdAt: { type: "string", example: "2025-11-03T20:01:00Z" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({
    status: 404,
    description: "Shipping line not found (if shippingLineId provided)",
  })
  async create(
    @Body() createAgentDto: CreateAgentDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string
  ) {
    return this.agentsService.create(createAgentDto, userId, userEmail);
  }

  @Put(":agentId")
  @RequirePermissionDecorator("agent:update")
  @ApiOperation({ summary: "Update agent" })
  @ApiParam({
    name: "agentId",
    description: "Agent MongoDB _id",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({
    description: "Agent update data",
    schema: {
      type: "object",
      properties: {
        firstName: { type: "string", example: "Juan" },
        lastName: { type: "string", example: "Ramírez" },
        email: { type: "string", example: "contacto@agencia.com" },
        phone: { type: "string", example: "+504 7777-6666" },
        whatsapp: { type: "string", example: "+504 8888-8888" },
        address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            zipCode: { type: "string" },
            country: { type: "string" },
          },
        },
        notes: {
          type: "string",
          example: "Actualización de contacto",
        },
        shippingLineId: {
          type: "string",
          example: "507f1f77bcf86cd799439011",
        },
        isActive: { type: "boolean" },
      },
    },
  })
  @ApiResponse({ status: 200, description: "Agent updated successfully" })
  @ApiResponse({ status: 404, description: "Agent not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async update(
    @Param("agentId") agentId: string,
    @Body() updateAgentDto: UpdateAgentDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string
  ) {
    return this.agentsService.update(
      agentId,
      updateAgentDto,
      userId,
      userEmail
    );
  }

  @Delete()
  @RequirePermissionDecorator("agent:delete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete multiple agents" })
  @ApiBody({
    description: "Agent IDs to delete",
    schema: {
      type: "object",
      properties: {
        agentIds: {
          type: "array",
          items: { type: "string" },
          example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
          description: "Array of Agent MongoDB ObjectIds",
        },
      },
      required: ["agentIds"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Agents deleted successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        removed: { type: "number", example: 2 },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({
    status: 404,
    description: "No agents found with the provided IDs",
  })
  async removeAgents(
    @Body() body: { agentIds: string[] },
    @UserId() userId: string,
    @UserEmail() userEmail: string
  ) {
    return this.agentsService.removeAgents(body.agentIds, userId, userEmail);
  }

  @Post(":agentId/magic-link")
  @RequirePermissionDecorator("agent:update")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Generate magic link for agent",
    description:
      "Generate a secure passwordless login link for an agent. The link will be sent to the agent's email.",
  })
  @ApiParam({
    name: "agentId",
    description: "Agent MongoDB _id",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({
    description: "Magic link generation options",
    schema: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          enum: ["onboarding", "support", "temporary"],
          example: "onboarding",
          description: "Purpose of the magic link",
        },
        notes: {
          type: "string",
          example: "Agent onboarding for new shipping line",
          description: "Optional notes",
        },
        expiresInHours: {
          type: "number",
          example: 24,
          description: "Expiration time in hours (default: 24)",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "Magic link generated successfully",
    type: MagicLinkResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Agent not found" })
  async generateMagicLink(
    @Param("agentId") agentId: string,
    @Body() dto: Omit<GenerateMagicLinkDto, "agentId">,
    @UserEmail() userEmail: string,
  ): Promise<MagicLinkResponseDto> {
    return this.magicLinkService.generateMagicLink(
      { ...dto, agentId },
      userEmail,
    );
  }

  @Get(":agentId/magic-links")
  @RequirePermissionDecorator("agent:read")
  @ApiOperation({
    summary: "Get active magic links for an agent",
    description: "Retrieve list of magic links (active and used) for an agent",
  })
  @ApiParam({
    name: "agentId",
    description: "Agent MongoDB _id",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiResponse({
    status: 200,
    description: "List of magic links",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          purpose: { type: "string" },
          expiresAt: { type: "string", format: "date-time" },
          used: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          createdBy: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getAgentMagicLinks(@Param("agentId") agentId: string) {
    return this.magicLinkService.getAgentMagicLinks(agentId);
  }

  @Post(":agentId/magic-links/revoke")
  @RequirePermissionDecorator("agent:update")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Revoke all active magic links for an agent",
    description: "Invalidate all unused magic links for an agent",
  })
  @ApiParam({
    name: "agentId",
    description: "Agent MongoDB _id",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiResponse({
    status: 200,
    description: "Magic links revoked successfully",
    schema: {
      type: "object",
      properties: {
        revoked: { type: "number", example: 3 },
      },
    },
  })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async revokeMagicLinks(@Param("agentId") agentId: string) {
    return this.magicLinkService.revokeAgentMagicLinks(agentId);
  }
}
