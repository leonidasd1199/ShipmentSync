import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { ShipmentService } from "./services/shipment.service";
import { ShipmentDocumentService } from "./services/shipment-document.service";
import { DocumentEngineService } from "./services/document-engine.service";
import {
  ShipmentLedgerService,
  LedgerUploadedFile,
} from "./services/shipment-ledger.service";
import { IncotermRequirementService } from "./services/incoterm-requirement.service";
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  ShipmentFiltersDto,
  ImportLedgerFromQuotationDto,
  CreateLedgerLineDto,
  UpdateLedgerLineDto,
  RejectLedgerLineDto,
  ApproveShipmentDto,
  RejectFinanceReviewDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { UserId } from "../auth/current-user.decorator";
import { DocumentType } from "../schemas/shipment-document.schema";
import { Permission } from "../common/enums/permission.enum";

@ApiTags("shipments")
@ApiBearerAuth("JWT-auth")
@Controller("shipments")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ShipmentsController {
  constructor(
    private readonly shipmentService: ShipmentService,
    private readonly documentService: ShipmentDocumentService,
    private readonly documentEngineService: DocumentEngineService,
    private readonly ledgerService: ShipmentLedgerService,
    private readonly incotermRequirementService: IncotermRequirementService,
  ) {}

  // =============================================================================
  // SHIPMENT CRUD
  // =============================================================================

  @Post()
  @RequirePermissionDecorator(Permission.SHIPMENT_CREATE)
  @ApiOperation({
    summary: "Create a new shipment",
    description: "Creates a new shipment in DRAFT status",
  })
  @ApiResponse({ status: 201, description: "Shipment created successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async create(
    @Body() dto: CreateShipmentDto,
    @UserId() userId: string,
  ) {
    return this.shipmentService.create(dto, userId);
  }

  @Get()
  @RequirePermissionDecorator(Permission.SHIPMENT_LIST)
  @ApiOperation({
    summary: "Get all shipments",
    description: "Returns list of shipments with optional filters",
  })
  @ApiResponse({ status: 200, description: "List of shipments" })
  async findAll(@Query() filters: ShipmentFiltersDto) {
    return this.shipmentService.findAll(filters);
  }

  @Get(":shipmentId")
  @RequirePermissionDecorator(Permission.SHIPMENT_READ)
  @ApiOperation({
    summary: "Get shipment by ID",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiResponse({ status: 200, description: "Shipment details" })
  @ApiResponse({ status: 404, description: "Shipment not found" })
  async findOne(@Param("shipmentId") shipmentId: string) {
    return this.shipmentService.findOne(shipmentId);
  }

  @Patch(":shipmentId")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @ApiOperation({
    summary: "Update shipment",
    description: "Only allowed if shipment status is DRAFT",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiResponse({ status: 200, description: "Shipment updated" })
  @ApiResponse({ status: 403, description: "Shipment not in DRAFT status" })
  async update(
    @Param("shipmentId") shipmentId: string,
    @Body() dto: UpdateShipmentDto,
    @UserId() userId: string,
  ) {
    return this.shipmentService.update(shipmentId, dto, userId);
  }

  // =============================================================================
  // WORKFLOW TRANSITIONS
  // =============================================================================

  @Post(":shipmentId/readyForFinance")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Transition to READY_FOR_FINANCE",
    description:
      "Validates required fields and documents, then locks shipment and documents",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiResponse({ status: 200, description: "Shipment ready for finance" })
  @ApiResponse({ status: 400, description: "Validation failed" })
  async readyForFinance(
    @Param("shipmentId") shipmentId: string,
    @UserId() userId: string,
  ) {
    return this.shipmentService.readyForFinance(shipmentId, userId);
  }

  @Post(":shipmentId/financeReview")
  @RequirePermissionDecorator(Permission.SHIPMENT_FINANCE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Transition to FINANCE_REVIEW",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiResponse({ status: 200, description: "Shipment in finance review" })
  async financeReview(
    @Param("shipmentId") shipmentId: string,
    @UserId() userId: string,
  ) {
    return this.shipmentService.financeReview(shipmentId, userId);
  }

  @Post(":shipmentId/approve")
  @RequirePermissionDecorator(Permission.SHIPMENT_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Approve shipment",
    description: "Optional note is stored on the shipment.",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiBody({ type: ApproveShipmentDto, required: false })
  @ApiResponse({ status: 200, description: "Shipment approved" })
  async approve(
    @Param("shipmentId") shipmentId: string,
    @Body() dto: ApproveShipmentDto,
    @UserId() userId: string,
  ) {
    return this.shipmentService.approve(shipmentId, userId, {
      note: dto?.note,
    });
  }

  @Post(":shipmentId/rejectFinanceReview")
  @RequirePermissionDecorator(Permission.SHIPMENT_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reject finance review (return to DRAFT)",
    description: "Requires a note explaining the rejection.",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiBody({ type: RejectFinanceReviewDto })
  @ApiResponse({ status: 200, description: "Shipment returned to DRAFT" })
  async rejectFinanceReview(
    @Param("shipmentId") shipmentId: string,
    @Body() dto: RejectFinanceReviewDto,
    @UserId() userId: string,
  ) {
    return this.shipmentService.rejectFinanceReview(
      shipmentId,
      userId,
      dto.note,
    );
  }

  @Post(":shipmentId/close")
  @RequirePermissionDecorator(Permission.SHIPMENT_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Close shipment",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiResponse({ status: 200, description: "Shipment closed" })
  async close(
    @Param("shipmentId") shipmentId: string,
    @UserId() userId: string,
  ) {
    return this.shipmentService.close(shipmentId, userId);
  }

  // =============================================================================
  // DOCUMENTS
  // =============================================================================

  @Get(":shipmentId/documents")
  @RequirePermissionDecorator(Permission.SHIPMENT_READ)
  @ApiOperation({
    summary: "Get shipment documents",
    description:
      "Returns generated documents list and required document types based on shipment mode",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  async getDocuments(@Param("shipmentId") shipmentId: string) {
    const result = await this.documentEngineService.getDocumentsWithRequired(
      shipmentId,
    );

    return {
      documents: result.documents.map((doc) => ({
        _id: doc._id,
        documentType: doc.documentType,
        version: doc.version,
        status: doc.status,
        generatedAt: doc.generatedAt,
        fileSize: doc.fileSize,
        lockedAt: doc.lockedAt,
        lockedBy: doc.lockedBy,
        downloadUrl: `/shipments/${shipmentId}/documents/${doc.documentType}/download?version=${doc.version}`,
      })),
      requiredDocumentTypes: result.requiredDocumentTypes,
    };
  }

  @Post(":shipmentId/documents/:documentType/generate")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Generate document",
    description:
      "Generates a new version of a document using HTML template. Only allowed if shipment is DRAFT and document is not locked.",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiParam({
    name: "documentType",
    enum: DocumentType,
    description: "Document type",
  })
  @ApiResponse({ status: 201, description: "Document generated" })
  @ApiResponse({ status: 400, description: "Invalid document type for mode or missing fields" })
  @ApiResponse({ status: 404, description: "Template not found" })
  @ApiResponse({ status: 409, description: "Document locked or shipment not DRAFT" })
  async generateDocument(
    @Param("shipmentId") shipmentId: string,
    @Param("documentType") documentType: DocumentType,
    @UserId() userId: string,
  ) {
    const document = await this.documentEngineService.generate(
      shipmentId,
      documentType,
      userId,
    );

    // Transform response to include download URL
    return {
      _id: document._id,
      shipmentId: document.shipmentId,
      documentType: document.documentType,
      version: document.version,
      status: document.status,
      storageKey: document.storageKey,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      hash: document.hash,
      generatedBy: document.generatedBy,
      generatedAt: document.generatedAt,
      lockedAt: document.lockedAt,
      lockedBy: document.lockedBy,
      downloadUrl: `/shipments/${shipmentId}/documents/${documentType}/download?version=${document.version}`,
    };
  }

  @Get(":shipmentId/documents/:documentType/download")
  @RequirePermissionDecorator(Permission.SHIPMENT_READ)
  @ApiOperation({
    summary: "Download document",
    description: "Downloads the latest version or specified version",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiParam({
    name: "documentType",
    enum: DocumentType,
    description: "Document type",
  })
  @ApiQuery({
    name: "version",
    required: false,
    type: Number,
    description: "Document version (defaults to latest)",
  })
  @ApiResponse({ status: 200, description: "PDF file" })
  @ApiResponse({ status: 404, description: "Document not found" })
  async downloadDocument(
    @Param("shipmentId") shipmentId: string,
    @Param("documentType") documentType: DocumentType,
    @Query("version") version: number | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.documentService.getDocumentFile(
      shipmentId,
      documentType,
      version,
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${documentType}-${shipmentId}${version ? `-v${version}` : ""}.pdf"`,
    );
    res.send(buffer);
  }

  // =============================================================================
  // LEDGER LINES
  // =============================================================================

  @Post(":shipmentId/ledger/importFromQuotation")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Import ledger lines from quotation",
    description: "Imports selected quotation items as ledger lines",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiResponse({ status: 201, description: "Ledger lines imported" })
  async importFromQuotation(
    @Param("shipmentId") shipmentId: string,
    @Body() dto: ImportLedgerFromQuotationDto,
    @UserId() userId: string,
  ) {
    return this.ledgerService.importFromQuotation(shipmentId, dto, userId);
  }

  @Get(":shipmentId/ledgerLines")
  @RequirePermissionDecorator(Permission.SHIPMENT_READ)
  @ApiOperation({
    summary: "Get ledger lines",
    description:
      "Returns all ledger lines for a shipment with optional filters. Each row includes documentsCount and hasDocuments (counts of active shipment_ledger_documents per ledgerLineId; CREDIT rows are typically 0).",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiQuery({
    name: "side",
    required: false,
    enum: ["DEBIT", "CREDIT"],
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
  })
  async getLedgerLines(
    @Param("shipmentId") shipmentId: string,
    @Query("side") side?: string,
    @Query("status") status?: string,
  ) {
    return this.ledgerService.findByShipmentId(shipmentId, {
      side: side as any,
      status: status as any,
    });
  }

  @Post(":shipmentId/ledgerLines")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create manual ledger line",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiResponse({ status: 201, description: "Ledger line created" })
  async createLedgerLine(
    @Param("shipmentId") shipmentId: string,
    @Body() dto: CreateLedgerLineDto,
    @UserId() userId: string,
  ) {
    return this.ledgerService.create(shipmentId, dto, userId);
  }

  @Patch(":shipmentId/ledgerLines/:lineId")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @ApiOperation({
    summary: "Update ledger line",
    description: "Only allowed if line status is DRAFT",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiParam({ name: "lineId", description: "Ledger line ID" })
  @ApiResponse({ status: 200, description: "Ledger line updated" })
  async updateLedgerLine(
    @Param("lineId") lineId: string,
    @Body() dto: UpdateLedgerLineDto,
    @UserId() userId: string,
  ) {
    return this.ledgerService.update(lineId, dto, userId);
  }

  @Post(":shipmentId/ledgerLines/:lineId/delete")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete ledger line",
    description: "Only allowed if line status is DRAFT",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiParam({ name: "lineId", description: "Ledger line ID" })
  @ApiResponse({ status: 204, description: "Ledger line deleted" })
  async deleteLedgerLine(@Param("lineId") lineId: string) {
    await this.ledgerService.delete(lineId);
  }

  @Post(":shipmentId/ledgerLines/:lineId/documents")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload supporting document for a ledger line",
    description:
      "Attaches a file to a DEBIT or CREDIT ledger line (same validation and limits for both).",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiParam({ name: "lineId", description: "Ledger line ID" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "PDF or image (jpeg, png, webp), max 15MB",
        },
        note: {
          type: "string",
          description: "Optional note (max 4000 characters)",
        },
      },
      required: ["file"],
    },
  })
  @ApiResponse({ status: 201, description: "Document metadata" })
  @ApiResponse({
    status: 400,
    description: "Invalid file or ledger line not eligible for attachments",
  })
  @ApiResponse({ status: 404, description: "Shipment or ledger line not found" })
  async uploadLedgerLineDocument(
    @Param("shipmentId") shipmentId: string,
    @Param("lineId") lineId: string,
    @UploadedFile() file: LedgerUploadedFile | undefined,
    @Body("note") note: string | undefined,
    @UserId() userId: string,
  ) {
    return this.ledgerService.uploadLedgerDocument(
      shipmentId,
      lineId,
      file,
      userId,
      note,
    );
  }

  @Get(":shipmentId/ledgerLines/:lineId/documents")
  @RequirePermissionDecorator(Permission.SHIPMENT_READ)
  @ApiOperation({
    summary: "List supporting documents for a ledger line",
    description:
      "Returns active attachments for a DEBIT or CREDIT line, newest first.",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiParam({ name: "lineId", description: "Ledger line ID" })
  @ApiResponse({ status: 200, description: "List of document metadata" })
  @ApiResponse({
    status: 400,
    description: "Ledger line not eligible or wrong shipment",
  })
  @ApiResponse({ status: 404, description: "Shipment or ledger line not found" })
  async listLedgerLineDocuments(
    @Param("shipmentId") shipmentId: string,
    @Param("lineId") lineId: string,
  ) {
    return this.ledgerService.listLedgerDocuments(shipmentId, lineId);
  }

  @Get(":shipmentId/ledgerLines/:lineId/documents/:documentId/download")
  @RequirePermissionDecorator(Permission.SHIPMENT_READ)
  @ApiOperation({
    summary: "Download a supporting document file for a ledger line",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiParam({ name: "lineId", description: "Ledger line ID" })
  @ApiParam({ name: "documentId", description: "Ledger document ID" })
  @ApiResponse({ status: 200, description: "File bytes" })
  @ApiResponse({
    status: 400,
    description: "Wrong shipment/line or line not eligible",
  })
  @ApiResponse({ status: 404, description: "Shipment, line, or document not found" })
  async downloadLedgerLineDocument(
    @Param("shipmentId") shipmentId: string,
    @Param("lineId") lineId: string,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    const { buffer, mimeType, originalFileName } =
      await this.ledgerService.downloadLedgerDocumentFile(
        shipmentId,
        lineId,
        documentId,
      );
    const safeName = (originalFileName || "document")
      .replace(/[/\\"]/g, "_")
      .slice(0, 200);
    res.setHeader("Content-Type", mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}"`,
    );
    res.send(buffer);
  }

  @Delete(":shipmentId/ledgerLines/:lineId/documents/:documentId")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Delete a supporting document from a ledger line",
    description:
      "Soft-deletes the document (isActive=false) and attempts to remove the stored file.",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiParam({ name: "lineId", description: "Ledger line ID" })
  @ApiParam({ name: "documentId", description: "Ledger document ID" })
  @ApiResponse({
    status: 200,
    description: "documentId and isActive=false",
  })
  @ApiResponse({
    status: 400,
    description: "Wrong shipment/line or line not eligible",
  })
  @ApiResponse({ status: 404, description: "Shipment, line, or document not found" })
  async deleteLedgerLineDocument(
    @Param("shipmentId") shipmentId: string,
    @Param("lineId") lineId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.ledgerService.deleteLedgerDocument(
      shipmentId,
      lineId,
      documentId,
    );
  }

  @Post(":shipmentId/ledgerLines/:lineId/submit")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Submit ledger line for approval",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiParam({ name: "lineId", description: "Ledger line ID" })
  async submitLedgerLine(
    @Param("lineId") lineId: string,
    @UserId() userId: string,
  ) {
    return this.ledgerService.submit(lineId, userId);
  }

  @Post(":shipmentId/ledgerLines/:lineId/approve")
  @RequirePermissionDecorator(Permission.SHIPMENT_FINANCE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Approve ledger line",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiParam({ name: "lineId", description: "Ledger line ID" })
  async approveLedgerLine(
    @Param("lineId") lineId: string,
    @UserId() userId: string,
  ) {
    return this.ledgerService.approve(lineId, userId);
  }

  @Post(":shipmentId/ledgerLines/:lineId/reject")
  @RequirePermissionDecorator(Permission.SHIPMENT_FINANCE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reject ledger line",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiParam({ name: "lineId", description: "Ledger line ID" })
  async rejectLedgerLine(
    @Param("lineId") lineId: string,
    @Body() dto: RejectLedgerLineDto,
    @UserId() userId: string,
  ) {
    return this.ledgerService.reject(lineId, dto, userId);
  }

  @Get(":shipmentId/profit")
  @RequirePermissionDecorator(Permission.SHIPMENT_READ)
  @ApiOperation({
    summary: "Calculate profit",
    description:
      "Calculates profit from approved ledger lines only. Profit = approved credits - approved debits",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment ID" })
  @ApiResponse({ status: 200, description: "Profit calculation" })
  async getProfit(@Param("shipmentId") shipmentId: string) {
    return this.ledgerService.calculateProfit(shipmentId);
  }
}
