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
  BadRequestException,
  Res,
} from "@nestjs/common";
import { type Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiExtraModels,
} from "@nestjs/swagger";
import { QuotationsService } from "./quotations.service";
import {
  CreateQuotationDto,
  UpdateQuotationDto,
  QuotationFiltersDto,
} from "./dto";
import {
  QuotationResponseDto,
  QuotationListResponseDto,
} from "./dto/quotation-response.dto";
import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  NotFoundErrorDto,
} from "./dto/error-response.dto";
import {
  ShippingLineHelperDto,
  AgentHelperDto,
  CompanyHelperDto,
  ClientHelperDto,
} from "./dto/helper-response.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { UserId, UserEmail } from "../auth/current-user.decorator";

@ApiTags("quotations")
@ApiBearerAuth("JWT-auth")
@Controller("quotations")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  // ========== Helper Routes (must be before :id route) ==========
  @Get("helpers/shipping-lines")
  @RequirePermissionDecorator("quotation:create")
  @ApiOperation({
    summary: "Get shipping lines for quotation form",
    description: "Returns list of active shipping lines with _id and name",
  })
  @ApiOkResponse({
    description: "List of shipping lines",
    type: [ShippingLineHelperDto],
  })
  async getShippingLinesHelper(@UserId() userId: string) {
    return this.quotationsService.getShippingLinesHelper(userId);
  }

  @Get("helpers/agents")
  @RequirePermissionDecorator("quotation:create")
  @ApiOperation({
    summary: "Get agents for quotation form",
    description: "Returns list of active agents with _id and name",
  })
  @ApiOkResponse({
    description: "List of agents",
    type: [AgentHelperDto],
  })
  async getAgentsHelper() {
    return this.quotationsService.getAgentsHelper();
  }

  @Get("helpers/company")
  @RequirePermissionDecorator("quotation:create")
  @ApiOperation({
    summary: "Get company profile for quotation form",
    description: "Returns the authenticated user's company profile information",
  })
  @ApiOkResponse({
    description: "Company profile information",
    type: CompanyHelperDto,
  })
  @ApiResponse({
    status: 404,
    description: "Company not found",
    type: NotFoundErrorDto,
  })
  async getCompanyHelper(@UserId() userId: string) {
    return this.quotationsService.getCompanyHelper(userId);
  }

  @Get("helpers/clients")
  @RequirePermissionDecorator("quotation:create")
  @ApiOperation({
    summary: "Get clients for quotation form",
    description:
      "Returns list of active clients from user's offices with _id and clientName",
  })
  @ApiOkResponse({
    description: "List of clients",
    type: [ClientHelperDto],
  })
  async getClientsHelper(@UserId() userId: string) {
    return this.quotationsService.getClientsHelper(userId);
  }

  // ========== PDF Route (must be before :id route) ==========
  @Get(":id/pdf")
  @RequirePermissionDecorator("quotation:read")
  @ApiOperation({
    summary: "Download quotation as PDF",
    description:
      "Generates and downloads a PDF document of the quotation.",
  })
  @ApiParam({
    name: "id",
    description: "Quotation ID (MongoDB ObjectId)",
    example: "507f1f77bcf86cd799439015",
  })
  @ApiResponse({
    status: 200,
    description: "PDF file downloaded successfully",
    content: {
      "application/pdf": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - Cannot download PDFs for quotations from other companies",
    type: ForbiddenErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Quotation not found",
    type: NotFoundErrorDto,
  })
  async downloadPDF(
    @Param("id") id: string,
    @UserId() userId: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const pdfBuffer = await this.quotationsService.generatePDF(id, userId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="quotation-${id}.pdf"`,
    );
    res.setHeader("Content-Length", pdfBuffer.length.toString());

    res.send(pdfBuffer);
  }

  // ========== CRUD Routes ==========
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissionDecorator("quotation:create")
  @ApiOperation({ summary: "Create a new quotation" })
  @ApiExtraModels(
    CreateQuotationDto,
    QuotationResponseDto,
    BadRequestErrorDto,
    ForbiddenErrorDto,
    NotFoundErrorDto,
  )
  @ApiBody({ type: CreateQuotationDto })
  @ApiResponse({
    status: 201,
    description: "Quotation created successfully",
    type: QuotationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden",
    type: ForbiddenErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Referenced entity not found",
    type: NotFoundErrorDto,
  })
  async create(
    @Body() createQuotationDto: CreateQuotationDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.quotationsService.create(createQuotationDto, userId, userEmail);
  }

  @Get(":id")
  @RequirePermissionDecorator("quotation:read")
  @ApiOperation({
    summary: "Get a quotation by ID",
    description: "Retrieve a single quotation with all its details",
  })
  @ApiParam({
    name: "id",
    description: "Quotation ID (MongoDB ObjectId)",
    example: "507f1f77bcf86cd799439015",
  })
  @ApiOkResponse({
    description: "Quotation details",
    type: QuotationResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Cannot view quotations from other companies",
    type: ForbiddenErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Quotation not found",
    type: NotFoundErrorDto,
  })
  async findOne(@Param("id") id: string, @UserId() userId: string) {
    return this.quotationsService.findOne(id, userId);
  }

  @Get()
  @RequirePermissionDecorator("quotation:list")
  @ApiOperation({
    summary: "Get all quotations with filters and pagination",
    description:
      "Retrieve quotations with optional filters (clientId, createdBy, chargeType, shippingLineId, createdAt range) and pagination support",
  })
  @ApiOkResponse({
    description: "List of quotations with pagination",
    type: QuotationListResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid filter parameters",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden",
    type: ForbiddenErrorDto,
  })
  async findAll(
    @Query() filters: QuotationFiltersDto,
    @UserId() userId?: string,
  ) {
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }

    return this.quotationsService.findAll(
      userId,
      {
        clientId: filters.clientId,
        createdBy: filters.createdBy,
        chargeType: filters.chargeType,
        createdAtFrom: filters.createdAtFrom,
        createdAtTo: filters.createdAtTo,
        shippingLineId: filters.shippingLineId,
        sourcePricelistId: filters.sourcePricelistId,
      },
      filters.page ?? 1,
      filters.limit ?? 50,
      filters.sort ?? "createdAt",
      filters.order ?? "DESC",
    );
  }

  @Put(":id")
  @RequirePermissionDecorator("quotation:update")
  @ApiOperation({
    summary: "Update a quotation",
    description:
      "Update a quotation. Only quotations in draft or sent status can be updated. If status is changed to 'sent', an email will be sent to the client.",
  })
  @ApiExtraModels(
    UpdateQuotationDto,
    QuotationResponseDto,
    BadRequestErrorDto,
    ForbiddenErrorDto,
    NotFoundErrorDto,
  )
  @ApiParam({
    name: "id",
    description: "Quotation ID (MongoDB ObjectId)",
    example: "507f1f77bcf86cd799439015",
  })
  @ApiBody({ type: UpdateQuotationDto })
  @ApiOkResponse({
    description: "Quotation updated successfully",
    type: QuotationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad Request - Cannot update quotation. Only quotations in draft or sent status can be updated, or invalid data provided.",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Cannot update quotations from other companies",
    type: ForbiddenErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Quotation or referenced entity not found",
    type: NotFoundErrorDto,
  })
  async update(
    @Param("id") id: string,
    @Body() updateQuotationDto: UpdateQuotationDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.quotationsService.update(
      id,
      updateQuotationDto,
      userId,
      userEmail,
    );
  }

  @Delete(":id")
  @RequirePermissionDecorator("quotation:delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete a quotation",
    description:
      "Delete a quotation. Only quotations in draft status can be deleted.",
  })
  @ApiParam({
    name: "id",
    description: "Quotation ID (MongoDB ObjectId)",
    example: "507f1f77bcf86cd799439015",
  })
  @ApiResponse({
    status: 204,
    description: "Quotation deleted successfully",
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad Request - Cannot delete quotation. Only quotations in draft status can be deleted.",
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Cannot delete quotations from other companies",
    type: ForbiddenErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: "Quotation not found",
    type: NotFoundErrorDto,
  })
  async remove(
    @Param("id") id: string,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ): Promise<void> {
    await this.quotationsService.remove(id, userId, userEmail);
  }
}
