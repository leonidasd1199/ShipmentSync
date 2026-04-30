import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from "@nestjs/swagger";
import { OperatorPricingService } from "./operator-pricing.service";
import { AgentPricingService } from "./agent-pricing.service";
import { QuotationsService } from "../quotations/quotations.service";
import { SendToClientsDto } from "./dto/send-to-clients.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { NonAgentGuard } from "../auth/non-agent.guard";
import { UserId, UserEmail } from "../auth/current-user.decorator";

@ApiTags("operator-pricing")
@ApiBearerAuth("JWT-auth")
@Controller("pricing")
@UseGuards(JwtAuthGuard, PermissionGuard, NonAgentGuard)
export class OperatorPricingController {
  constructor(
    private readonly operatorPricingService: OperatorPricingService,
    private readonly agentPricingService: AgentPricingService,
    private readonly quotationsService: QuotationsService,
  ) {}

  @Get("suppliers/:supplierId")
  @RequirePermissionDecorator("shipping:read")
  @ApiOperation({
    summary: "Get pricelist for operator view (read-only)",
    description:
      "Returns all pricelists for a supplier, optionally filtered by agent, incoterm, or currency. Only accessible to non-agents (operators).",
  })
  @ApiParam({
    name: "supplierId",
    description: "Supplier (Shipping) MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiQuery({
    name: "agentId",
    required: false,
    description: "Filter by specific agent ID",
  })
  @ApiQuery({
    name: "incoterm",
    required: false,
    description: "Filter items by incoterm",
  })
  @ApiQuery({
    name: "currency",
    required: false,
    description: "Filter items by currency",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["draft", "submitted", "approved", "rejected", "superseded"],
    description: "Filter pricelists by status (e.g., 'submitted' to see pending approvals)",
  })
  @ApiResponse({
    status: 200,
    description: "Supplier pricelists with all agent pricelists, including pricelist metadata (pricelistId, weekStart, weekEnd, status, etc.)",
    schema: {
      type: "object",
      properties: {
        supplier: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
          },
        },
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
              rejectionReason: { type: "string", description: "Reason for rejection (if rejected)" },
              totalCost: { type: "number" },
              itemCount: { type: "number" },
              agent: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                },
              },
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
                  },
                },
              },
              updatedAt: { type: "string", format: "date-time" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid supplierId, agentId, or status format",
  })
  @ApiResponse({
    status: 403,
    description: "This endpoint is not available for agents",
  })
  async getPricelistForOperator(
    @Param("supplierId") supplierId: string,
    @Query("agentId") agentId?: string,
    @Query("incoterm") incoterm?: string,
    @Query("currency") currency?: string,
    @Query("status") status?: string,
  ) {
    return this.operatorPricingService.getPricelistForOperator(supplierId, {
      agentId,
      incoterm,
      currency,
      status,
    });
  }

  @Post("pricelists/:pricelistId/approve")
  @RequirePermissionDecorator("shipping:update")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Approve pricelist",
    description:
      "Approves a submitted pricelist. Only operators can approve pricelists. Only submitted pricelists can be approved.",
  })
  @ApiParam({
    name: "pricelistId",
    description: "Pricelist MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiResponse({
    status: 200,
    description: "Pricelist approved successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Pricelist cannot be approved (wrong status)",
  })
  @ApiResponse({
    status: 403,
    description: "This endpoint is not available for agents",
  })
  @ApiResponse({
    status: 404,
    description: "Pricelist not found",
  })
  async approvePricelist(
    @Param("pricelistId") pricelistId: string,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.agentPricingService.approvePricelist(
      pricelistId,
      userId,
      userEmail,
    );
  }

  @Post("pricelists/:pricelistId/reject")
  @RequirePermissionDecorator("shipping:update")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reject pricelist",
    description:
      "Rejects a submitted pricelist and sets status back to DRAFT so the agent can fix and resubmit. Only operators can reject pricelists. Only submitted pricelists can be rejected. The rejection reason and metadata are stored for audit purposes.",
  })
  @ApiParam({
    name: "pricelistId",
    description: "Pricelist MongoDB _id",
    example: "507f1f77bcf86cd799439012",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        rejectionReason: {
          type: "string",
          description: "Reason for rejection",
          example: "Pricing does not meet requirements",
        },
      },
      required: ["rejectionReason"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Pricelist rejected successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Pricelist cannot be rejected (wrong status) or missing rejection reason",
  })
  @ApiResponse({
    status: 403,
    description: "This endpoint is not available for agents",
  })
  @ApiResponse({
    status: 404,
    description: "Pricelist not found",
  })
  async rejectPricelist(
    @Param("pricelistId") pricelistId: string,
    @Body() body: { rejectionReason: string },
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    if (!body.rejectionReason || body.rejectionReason.trim().length === 0) {
      throw new BadRequestException("Rejection reason is required");
    }

    return this.agentPricingService.rejectPricelist(
      pricelistId,
      body.rejectionReason,
      userId,
      userEmail,
    );
  }

  @Post("send-to-clients")
  @RequirePermissionDecorator("shipping:update")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("pdf"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Send to clients (quotation or pricelist)",
    description:
      "Send a quotation to its client (quotationId: creates QuotationDelivery, sets status to sent, sends email) OR distribute an approved pricelist PDF (pricelistId + pdf + clientIds/sendToAll). For pricelist, PDF must be uploaded as 'pdf' field. Only approved pricelists can be distributed. Distribution/delivery is tracked for audit.",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        quotationId: {
          type: "string",
          description: "Quotation ID to send to its client. When set, no PDF or pricelistId required.",
          example: "507f1f77bcf86cd799439015",
        },
        pricelistId: {
          type: "string",
          description: "Pricelist ID to distribute (required when not sending a quotation)",
          example: "507f1f77bcf86cd799439012",
        },
        clientIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional. Array of client IDs; when provided, only these clients receive the pricelist. When omitted, set sendToAll true to send to all active clients.",
          example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439013"],
        },
        sendToAll: {
          type: "boolean",
          description:
            "When clientIds is omitted: if true, send to all active clients; if false, request is invalid. Ignored when clientIds is provided.",
          example: false,
          default: false,
        },
        pdf: {
          type: "string",
          format: "binary",
          description: "PDF file (required for pricelist distribution)",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Quotation sent to client or pricelist distributed successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        quotationId: { type: "string" },
        pricelistId: { type: "string" },
        totalClients: { type: "number" },
        clientIds: {
          type: "array",
          items: { type: "string" },
        },
        sentAt: { type: "string", format: "date-time" },
        distributionId: { type: "string" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request - Pricelist not approved, invalid clientIds, missing PDF (for pricelist), or missing quotationId/pricelistId",
  })
  @ApiResponse({
    status: 403,
    description: "This endpoint is not available for agents",
  })
  @ApiResponse({
    status: 404,
    description: "Quotation, pricelist, or clients not found",
  })
  async sendPricelistToClients(
    @Body() body: SendToClientsDto,
    @UploadedFile() pdfFile: any,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    // Quotation-only flow: send an existing quotation to its own client
    if (body.quotationId && !body.pricelistId) {
      const result = await this.quotationsService.sendQuotationToClient(
        body.quotationId,
        userId,
        userEmail,
      );
      return {
        success: true,
        message: "Quotation sent to client",
        quotationId: result.quotationId,
        clientId: result.clientId,
        sentAt: result.sentAt,
      };
    }

    if (!body.pricelistId) {
      throw new BadRequestException(
        "Either quotationId or pricelistId is required",
      );
    }
    if (!pdfFile) {
      throw new BadRequestException("PDF file is required for pricelist distribution");
    }

    if (pdfFile.mimetype !== "application/pdf") {
      throw new BadRequestException("File must be a PDF");
    }

    let quoteSnapshotPayload: Record<string, unknown> | undefined;
    if (body.quoteSnapshot?.trim()) {
      try {
        quoteSnapshotPayload = JSON.parse(body.quoteSnapshot) as Record<string, unknown>;
        // Prefer dedicated array field so legacyItems are never truncated
        if (body.quoteSnapshotLegacyItems?.trim()) {
          try {
            const legacyItems = JSON.parse(body.quoteSnapshotLegacyItems) as unknown;
            if (Array.isArray(legacyItems)) {
              quoteSnapshotPayload = { ...quoteSnapshotPayload, legacyItems };
            }
          } catch {
            // ignore invalid JSON, keep quoteSnapshot.legacyItems
          }
        }
      } catch {
        throw new BadRequestException("quoteSnapshot must be valid JSON");
      }
    }
    // When only quoteSnapshotLegacyItems is sent (no quoteSnapshot body), still build payload so service gets full array
    if (quoteSnapshotPayload == null && body.quoteSnapshotLegacyItems?.trim()) {
      try {
        const legacyItems = JSON.parse(body.quoteSnapshotLegacyItems) as unknown;
        if (Array.isArray(legacyItems)) {
          quoteSnapshotPayload = { legacyItems };
        }
      } catch {
        // ignore
      }
    }

    return this.operatorPricingService.sendPricelistToClients(
      body.quotationId,
      body.pricelistId,
      body.clientIds,
      body.sendToAll,
      userId,
      userEmail,
      pdfFile.buffer,
      pdfFile.originalname || `pricelist-${body.pricelistId}.pdf`,
      quoteSnapshotPayload,
    );
  }
}
