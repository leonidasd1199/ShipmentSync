import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { resolve } from "path";
import * as Handlebars from "handlebars";
import {
  Shipment,
  ShipmentDocument,
  ShipmentStatus,
  ShipmentMode,
} from "../../schemas/shipment.schema";
import {
  ShipmentDocument as ShipmentDoc,
  ShipmentDocumentDocument,
  DocumentType,
  DocumentStatus,
} from "../../schemas/shipment-document.schema";
import {
  DocumentTemplate,
  DocumentTemplateDocument,
} from "../../schemas/document-template.schema";
import {
  ShipmentLedgerLine,
  ShipmentLedgerLineDocument,
} from "../../schemas/shipment-ledger-line.schema";
import { Company, CompanyDocument } from "../../schemas/company.schema";
import { StorageService } from "./storage.service";
import { readImageFileAsDataUri } from "../utils/branding.util";
import {
  BL_STANDARD_CSS,
  BL_STANDARD_HTML,
} from "../templates/bl-standard.template";
import {
  MANIFIESTO_CARGA_STANDARD_CSS,
  MANIFIESTO_CARGA_STANDARD_HTML,
} from "../templates/manifiesto-carga-standard.template";
import {
  CARTA_PORTE_STANDARD_CSS,
  CARTA_PORTE_STANDARD_HTML,
} from "../templates/carta-porte-standard.template";
import {
  HAWB_STANDARD_CSS,
  HAWB_STANDARD_HTML,
} from "../templates/hawb-standard.template";

/**
 * Mapping of shipment modes to allowed document types
 */
const COMMON_DOCUMENT_TYPES = [
  DocumentType.COMMERCIAL_INVOICE,
  DocumentType.PACKING_LIST,
  DocumentType.DEBIT_PDF,
  DocumentType.CREDIT_PDF,
];

const MODE_DOCUMENT_MAP: Record<ShipmentMode, DocumentType[]> = {
  [ShipmentMode.OCEAN]: [
    DocumentType.BL,
    DocumentType.MBL,
    DocumentType.HBL,
    ...COMMON_DOCUMENT_TYPES,
  ],
  [ShipmentMode.LAND]: [
    DocumentType.CARTA_PORTE,
    DocumentType.MANIFIESTO_CARGA,
    ...COMMON_DOCUMENT_TYPES,
  ],
  [ShipmentMode.AIR]: [DocumentType.HAWB, ...COMMON_DOCUMENT_TYPES],
  [ShipmentMode.MULTIMODAL]: [
    DocumentType.BL,
    DocumentType.CARTA_PORTE,
    DocumentType.MANIFIESTO_CARGA,
    DocumentType.HAWB,
    ...COMMON_DOCUMENT_TYPES,
  ],
};

/**
 * Required documents per mode for readyForFinance transition
 */
const REQUIRED_DOCUMENTS: Record<ShipmentMode, DocumentType[]> = {
  [ShipmentMode.OCEAN]: [DocumentType.BL],
  [ShipmentMode.LAND]: [
    DocumentType.CARTA_PORTE,
    DocumentType.MANIFIESTO_CARGA,
  ],
  [ShipmentMode.AIR]: [DocumentType.HAWB],
  [ShipmentMode.MULTIMODAL]: [DocumentType.BL], // Default to BL for multimodal
};

@Injectable()
export class DocumentEngineService {
  private readonly logger = new Logger(DocumentEngineService.name);

  constructor(
    @InjectModel(Shipment.name)
    private shipmentModel: Model<ShipmentDocument>,
    @InjectModel(ShipmentDoc.name)
    private documentModel: Model<ShipmentDocumentDocument>,
    @InjectModel(DocumentTemplate.name)
    private templateModel: Model<DocumentTemplateDocument>,
    @InjectModel(ShipmentLedgerLine.name)
    private ledgerLineModel: Model<ShipmentLedgerLineDocument>,
    @InjectModel(Company.name)
    private companyModel: Model<CompanyDocument>,
    private storageService: StorageService,
    private configService: ConfigService,
  ) {}

  /**
   * Get required document types for a shipment mode
   */
  getRequiredDocuments(mode: ShipmentMode): DocumentType[] {
    return REQUIRED_DOCUMENTS[mode] || [];
  }

  /**
   * Validate document type is allowed for shipment mode
   */
  validateDocumentTypeForMode(
    documentType: DocumentType,
    mode: ShipmentMode,
  ): void {
    const allowedTypes = MODE_DOCUMENT_MAP[mode] || [];
    if (!allowedTypes.includes(documentType)) {
      throw new BadRequestException(
        `Document type ${documentType} is not allowed for shipment mode ${mode}. Allowed types: ${allowedTypes.join(", ")}`,
      );
    }
  }

  /**
   * Build template context from shipment data
   */
  private async buildTemplateContext(
    shipment: ShipmentDocument,
    ledgerLines?: any[],
  ): Promise<any> {
    const shipmentPlain = shipment.toObject
      ? shipment.toObject({ flattenMaps: true })
      : JSON.parse(JSON.stringify(shipment));

    const companyDoc = await this.companyModel.findById(shipment.companyId).lean();

    const displayName = companyDoc?.name ?? "SHIPSYNC LOGISTICS";
    const legalName =
      companyDoc?.legalName ?? companyDoc?.name ?? "SHIPSYNC LOGISTICS S. DE R.L.";
    const shortName = displayName.split(/\s+/)[0]?.toUpperCase() ?? "SHIPSYNC";

    let logoDataUri: string | null = null;
    let logoUrl: string | null = null;
    const logoFile = this.configService.get<string>("BL_LOGO_FILE");
    if (logoFile) {
      const abs =
        logoFile.startsWith("/") || /^[A-Za-z]:[\\/]/.test(logoFile)
          ? logoFile
          : resolve(process.cwd(), logoFile);
      logoDataUri = readImageFileAsDataUri(abs);
      if (!logoDataUri) {
        this.logger.warn(`BL_LOGO_FILE not found or unreadable: ${abs}`);
      }
    }
    const defaultLogoCandidates = [
      resolve(process.cwd(), "assets/branding/logo.png"),
      resolve(__dirname, "../../../assets/branding/logo.png"),
      resolve(__dirname, "../../assets/branding/logo.png"),
    ];
    for (const p of defaultLogoCandidates) {
      if (!logoDataUri && existsSync(p)) {
        logoDataUri = readImageFileAsDataUri(p);
        if (logoDataUri) break;
      }
    }

    if (!logoDataUri) {
      logoUrl =
        this.configService.get<string>("BL_LOGO_URL") ??
        companyDoc?.brandLogoUrl ??
        null;
    }

    const context: any = {
      company: {
        name: displayName,
        legalName,
        shortName,
      },
      document: {
        preparedByName: shipment.operator?.name ?? "",
      },
      shipment: {
        _id: shipment._id?.toString(),
        companyId: shipment.companyId?.toString(),
        officeId: shipment.officeId?.toString(),
        quotationId: shipment.quotationId?.toString(),
        mode: shipment.mode,
        incoterm: shipment.incoterm,
        movementType: shipment.movementType,
        bookingNumber: shipment.bookingNumber,
        mblNumber: shipment.mblNumber,
        hblNumber: shipment.hblNumber,
        status: shipment.status,
      },
      branding: {
        logoDataUri,
        logoUrl,
      },
      parties: shipmentPlain.parties,
      cargo: shipmentPlain.cargo,
      dates: shipmentPlain.dates,
      transport: {},
      now: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };

    // Add mode-specific transport fields
    if (shipment.mode === ShipmentMode.OCEAN) {
      context.transport = {
        vesselName: shipment.transport?.vesselName,
        voyageNumber: shipment.transport?.voyageNumber,
        portOfLoadingId: shipment.transport?.portOfLoadingId?.toString(),
        portOfDischargeId: shipment.transport?.portOfDischargeId?.toString(),
        placeOfReceipt: shipment.transport?.placeOfReceipt,
        placeOfDelivery: shipment.transport?.placeOfDelivery,
        portOfDischarge: shipment.transport?.portOfDischarge,
        preCarriageBy: shipment.transport?.preCarriageBy,
        loadingPierTerminal: shipment.transport?.loadingPierTerminal,
        countryOfOriginGoods: shipment.transport?.countryOfOriginGoods,
      };
    } else if (shipment.mode === ShipmentMode.LAND) {
      const landTransport = shipment.transport?.land || {};
      context.transport = {
        cartaPorteNumber: landTransport.cartaPorteNumber,
        manifestNumber: landTransport.manifestNumber,
        documentDate: landTransport.documentDate
          ? new Date(landTransport.documentDate).toISOString()
          : null,
        placeOfLoading: landTransport.placeOfLoading,
        placeOfUnloading: landTransport.placeOfUnloading,
        driverName: landTransport.driverName,
        driverLicense: landTransport.driverLicense,
        truckPlate: landTransport.truckPlate,
        trailerPlate: landTransport.trailerPlate,
        destinationCountry: landTransport.destinationCountry,
        destinationWarehouse: landTransport.destinationWarehouse,
        customsExit: landTransport.customsExit,
        customsEntry: landTransport.customsEntry,
        exportInvoiceNumber: landTransport.exportInvoiceNumber,
        freightPayment: landTransport.freightPayment,
      };
    } else if (shipment.mode === ShipmentMode.AIR) {
      const airTransport = shipment.transport?.air || {};
      context.transport = {
        hawbNumber: airTransport.hawbNumber,
        airportOfDeparture: airTransport.airportOfDeparture,
        airportOfDestination: airTransport.airportOfDestination,
        firstCarrier: airTransport.firstCarrier,
        routing: airTransport.routing || [],
        requestedFlight: airTransport.requestedFlight,
        requestedFlightDate: airTransport.requestedFlightDate
          ? new Date(airTransport.requestedFlightDate).toISOString()
          : null,
        currency: airTransport.currency,
        chargesCode: airTransport.chargesCode,
        declaredValueCarriage: airTransport.declaredValueCarriage,
        declaredValueCustoms: airTransport.declaredValueCustoms,
        insuranceAmount: airTransport.insuranceAmount,
        paymentTerm: airTransport.paymentTerm,
      };
    }

    // Format dates as readable strings (e.g. "17 Mar 2026")
    if (context.dates) {
      Object.keys(context.dates).forEach((key) => {
        if (context.dates[key]) {
          context.dates[key] = new Date(context.dates[key]).toLocaleDateString(
            "en-GB",
            { day: "2-digit", month: "short", year: "numeric" },
          );
        }
      });
    }

    // Add ledger context if provided (for DEBIT_PDF / CREDIT_PDF)
    if (ledgerLines) {
      const debits = ledgerLines.filter((l) => l.side === "DEBIT");
      const credits = ledgerLines.filter((l) => l.side === "CREDIT");
      context.ledger = {
        all: ledgerLines,
        debits,
        credits,
        totalDebits: debits.reduce((sum, l) => sum + (l.baseAmount || 0), 0),
        totalCredits: credits.reduce((sum, l) => sum + (l.baseAmount || 0), 0),
        currency: ledgerLines[0]?.baseCurrency ?? "USD",
      };
    }

    return context;
  }

  /**
   * If Mongo still has legacy BL/MANIFIESTO HTML, use canonical templates from code
   * so PDFs match migrations/seed without requiring migrate-mongo to have run first.
   */
  private resolveCanonicalTemplateForRendering(
    documentType: DocumentType,
    html: string,
    css: string | undefined,
  ): { html: string; css: string | undefined } {
    if (documentType === DocumentType.BL) {
      if (
        html.includes("bl-document") ||
        html.includes("bl-header") ||
        html.includes("bl-main-title")
      ) {
        return { html, css };
      }
      return { html: BL_STANDARD_HTML, css: BL_STANDARD_CSS };
    }
    if (documentType === DocumentType.MANIFIESTO_CARGA) {
      if (html.includes("mc-document") || html.includes("mc-title-row")) {
        return { html, css };
      }
      return {
        html: MANIFIESTO_CARGA_STANDARD_HTML,
        css: MANIFIESTO_CARGA_STANDARD_CSS,
      };
    }
    if (documentType === DocumentType.CARTA_PORTE) {
      if (html.includes("cp-document") || html.includes("cp-header")) {
        return { html, css };
      }
      return {
        html: CARTA_PORTE_STANDARD_HTML,
        css: CARTA_PORTE_STANDARD_CSS,
      };
    }
    if (documentType === DocumentType.HAWB) {
      if (html.includes("hawb-document") || html.includes("hawb-topline")) {
        return { html, css };
      }
      return {
        html: HAWB_STANDARD_HTML,
        css: HAWB_STANDARD_CSS,
      };
    }
    return { html, css };
  }

  /**
   * Render HTML from Handlebars template
   */
  private renderTemplate(
    html: string,
    css: string | undefined,
    context: any,
    documentType: DocumentType,
  ): string {
    const template = Handlebars.compile(html);
    const renderedHtml = template(context, {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true,
    });

    const companyHeader = `<div style="text-align:center;padding:10px 0 12px;border-bottom:3px solid #000;margin-bottom:18px;"><span style="font-family:Arial,sans-serif;font-size:22px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">SHIPSYNC LOGISTICS</span></div>`;

    const omitOuterBanner =
      (documentType === DocumentType.BL &&
        (renderedHtml.includes("bl-document") ||
          renderedHtml.includes("bl-header"))) ||
      (documentType === DocumentType.HAWB &&
        (renderedHtml.includes("hawb-document") ||
          renderedHtml.includes("hawb-topline"))) ||
      (documentType === DocumentType.CARTA_PORTE &&
        (renderedHtml.includes("cp-document") ||
          renderedHtml.includes("cp-header"))) ||
      (documentType === DocumentType.MANIFIESTO_CARGA &&
        (renderedHtml.includes("mc-document") ||
          renderedHtml.includes("mc-title-row")));

    const bodyInner = omitOuterBanner ? renderedHtml : `${companyHeader}${renderedHtml}`;

    if (css) {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${css}</style>
</head>
<body>
  ${bodyInner}
</body>
</html>`;
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
  ${bodyInner}
</body>
</html>`;
  }

  /**
   * Convert HTML to PDF buffer using Playwright
   * Uses Chromium headless browser to render HTML/CSS and generate PDF
   * Falls back to simple PDF-like buffer if Playwright is not available (for tests)
   */
  private async htmlToPdf(html: string): Promise<Buffer> {
    // Try to use Playwright
    let playwright: any;
    try {
      playwright = require("playwright");
    } catch (error) {
      this.logger.warn(
        `Playwright not available, using fallback PDF generation. Error: ${error instanceof Error ? error.message : String(error)}. Install with: npm install playwright && npx playwright install chromium`,
      );
      return this.getFallbackPdf();
    }

    try {
      this.logger.debug("Launching Chromium browser for PDF generation...");
      const browser = await playwright.chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"], // Required for some environments (Docker, CI)
      });

      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle" });

        this.logger.debug("Generating PDF from HTML content...");
        // Generate PDF with A4 format
        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true, // Include CSS backgrounds
          margin: {
            top: "10mm",
            right: "10mm",
            bottom: "10mm",
            left: "10mm",
          },
        });

        this.logger.debug(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);
        return Buffer.from(pdfBuffer);
      } finally {
        await browser.close();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Playwright PDF generation failed: ${errorMessage}${errorStack ? `\nStack: ${errorStack}` : ""}`,
      );
      this.logger.warn("Falling back to placeholder PDF. Ensure Playwright Chromium is installed: npx playwright install chromium");
      return this.getFallbackPdf();
    }
  }

  /**
   * Generate a fallback PDF when Playwright is not available
   */
  private getFallbackPdf(): Buffer {
    // Fallback: Generate a simple PDF-like buffer for testing
    // This creates a minimal valid PDF structure
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Generated Document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000306 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
400
%%EOF`;
    return Buffer.from(pdfContent);
  }

  /**
   * Validate required fields for document type
   */
  private validateRequiredFields(
    shipment: ShipmentDocument,
    documentType: DocumentType,
  ): void {
    const missingFields: string[] = [];

    // Basic validations
    if (!shipment.parties?.shipper?.name) {
      missingFields.push("parties.shipper.name");
    }
    if (!shipment.parties?.consignee?.name) {
      missingFields.push("parties.consignee.name");
    }
    if (!shipment.cargo?.containers || shipment.cargo.containers.length === 0) {
      if (shipment.mode === ShipmentMode.OCEAN) {
        missingFields.push("cargo.containers");
      }
    }

    // Mode-specific validations
    if (shipment.mode === ShipmentMode.LAND) {
      if (documentType === DocumentType.CARTA_PORTE) {
        if (!shipment.transport?.land?.cartaPorteNumber) {
          missingFields.push("transport.land.cartaPorteNumber");
        }
        if (!shipment.transport?.land?.placeOfLoading) {
          missingFields.push("transport.land.placeOfLoading");
        }
      }
    } else if (shipment.mode === ShipmentMode.AIR) {
      if (documentType === DocumentType.HAWB) {
        if (!shipment.transport?.air?.hawbNumber) {
          missingFields.push("transport.air.hawbNumber");
        }
        if (!shipment.transport?.air?.airportOfDeparture) {
          missingFields.push("transport.air.airportOfDeparture");
        }
      }
    }

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: "Required fields are missing for document generation",
        missingFields,
      });
    }
  }

  /**
   * Generate a document
   */
  async generate(
    shipmentId: string,
    documentType: DocumentType,
    userId: string,
  ): Promise<ShipmentDocumentDocument> {
    // 1) Load shipment
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${shipmentId} not found`);
    }

    // 2) Validate shipment.status === DRAFT
    // If shipment is not DRAFT, deny generation (409)
    if (shipment.status !== ShipmentStatus.DRAFT) {
      throw new ConflictException(
        `Cannot generate documents for shipment with status ${shipment.status}. Only DRAFT shipments allow document generation.`,
      );
    }

    // 3) Validate documentType is allowed for shipment.mode
    this.validateDocumentTypeForMode(documentType, shipment.mode);

    // 4) Check if latest document for this type is locked
    // Find the latest document for this documentType
    const latestDocument = await this.documentModel
      .findOne({
        shipmentId: new Types.ObjectId(shipmentId),
        documentType,
      })
      .sort({ version: -1 })
      .exec();

    // If latest document exists and is LOCKED, deny generation (409)
    if (latestDocument && latestDocument.status === DocumentStatus.LOCKED) {
      throw new ConflictException(
        `Document ${documentType} is locked (latest version ${latestDocument.version}) and cannot be regenerated`,
      );
    }

    // 5) Find active template — mode-specific first, then fall back to any mode
    let template = await this.templateModel
      .findOne({ mode: shipment.mode, documentType, isActive: true })
      .exec();

    if (!template) {
      template = await this.templateModel
        .findOne({ documentType, isActive: true })
        .exec();
    }

    if (!template) {
      throw new NotFoundException(
        `No active template found for mode ${shipment.mode} and document type ${documentType}`,
      );
    }

    // 6) Validate required fields
    this.validateRequiredFields(shipment, documentType);

    try {
      // 7) Build template context — fetch ledger lines for financial documents
      let ledgerLines: any[] | undefined;
      if (
        documentType === DocumentType.DEBIT_PDF ||
        documentType === DocumentType.CREDIT_PDF
      ) {
        const lines = await this.ledgerLineModel
          .find({ shipmentId: shipment._id })
          .sort({ createdAt: 1 })
          .lean()
          .exec();
        ledgerLines = lines.map((l) => ({
          ...l,
          _id: l._id?.toString(),
          shipmentId: l.shipmentId?.toString(),
          submittedBy: l.submittedBy?.toString(),
          approvedBy: l.approvedBy?.toString(),
          rejectedBy: l.rejectedBy?.toString(),
          createdBy: l.createdBy?.toString(),
          updatedBy: l.updatedBy?.toString(),
        }));
      }
      const context = await this.buildTemplateContext(shipment, ledgerLines);

      // 8) Render HTML (use canonical layout when DB row is still legacy)
      const { html: tplHtml, css: tplCss } = this.resolveCanonicalTemplateForRendering(
        documentType,
        template.html,
        template.css,
      );
      const html = this.renderTemplate(tplHtml, tplCss, context, documentType);

      // 9) Convert HTML to PDF
      const pdfBuffer = await this.htmlToPdf(html);

      // 10) Calculate next version
      // Reuse latestDocument query result if available, otherwise query again
      const latest = latestDocument || await this.documentModel
        .findOne({
          shipmentId: new Types.ObjectId(shipmentId),
          documentType,
        })
        .sort({ version: -1 })
        .exec();

      const nextVersion = latest ? latest.version + 1 : 1;

      // 11) Generate storage key and save file
      const storageKey = this.storageService.generateStorageKey(
        shipmentId,
        documentType,
        nextVersion,
      );
      await this.storageService.saveFile(storageKey, pdfBuffer);

      // Compute hash
      const hash = createHash("sha256").update(pdfBuffer).digest("hex");

      // 12) Create document record
      const document = await this.documentModel.create({
        shipmentId: new Types.ObjectId(shipmentId),
        documentType,
        version: nextVersion,
        status: DocumentStatus.GENERATED,
        storageKey,
        mimeType: "application/pdf",
        fileSize: pdfBuffer.length,
        hash,
        generatedBy: new Types.ObjectId(userId),
        generatedAt: new Date(),
        shipmentUpdatedAtSnapshot: (shipment as any).updatedAt || new Date(),
      });

      return document;
    } catch (error) {
      // Create failed document record
      const latest = await this.documentModel
        .findOne({
          shipmentId: new Types.ObjectId(shipmentId),
          documentType,
        })
        .sort({ version: -1 })
        .exec();

      const nextVersion = latest ? latest.version + 1 : 1;

      const failedStorageKey = `shipments/${shipmentId}/${documentType}/v${nextVersion}_failed`;
      const failedDoc = await this.documentModel.create({
        shipmentId: new Types.ObjectId(shipmentId),
        documentType,
        version: nextVersion,
        status: DocumentStatus.FAILED,
        storageKey: failedStorageKey,
        mimeType: "application/pdf",
        generatedBy: new Types.ObjectId(userId),
        generatedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : String(error),
        errorAt: new Date(),
      });

      throw new InternalServerErrorException({
        message: "Document generation failed",
        error: error instanceof Error ? error.message : String(error),
        documentId: failedDoc._id.toString(),
      });
    }
  }

  /**
   * Lock documents for a shipment
   */
  async lockDocuments(
    shipmentId: string,
    userId: string,
    documentTypes: DocumentType[],
  ): Promise<ShipmentDocumentDocument[]> {
    const lockedDocs: ShipmentDocumentDocument[] = [];

    for (const documentType of documentTypes) {
      const latest = await this.documentModel
        .findOne({
          shipmentId: new Types.ObjectId(shipmentId),
          documentType,
        })
        .sort({ version: -1 })
        .exec();

      if (latest && latest.status !== DocumentStatus.LOCKED) {
        const locked = await this.documentModel
          .findByIdAndUpdate(
            latest._id,
            {
              status: DocumentStatus.LOCKED,
              lockedBy: new Types.ObjectId(userId),
              lockedAt: new Date(),
            },
            { new: true },
          )
          .exec();

        if (locked) {
          lockedDocs.push(locked);
        }
      } else if (latest && latest.status === DocumentStatus.LOCKED) {
        lockedDocs.push(latest);
      }
    }

    return lockedDocs;
  }

  /**
   * Get documents for a shipment with required document types
   */
  async getDocumentsWithRequired(
    shipmentId: string,
  ): Promise<{
    documents: ShipmentDocumentDocument[];
    requiredDocumentTypes: DocumentType[];
  }> {
    const shipment = await this.shipmentModel.findById(shipmentId).exec();
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${shipmentId} not found`);
    }

    const requiredDocumentTypes = this.getRequiredDocuments(shipment.mode);

    // Get latest document for each type
    const documents = await this.documentModel
      .aggregate([
        {
          $match: {
            shipmentId: new Types.ObjectId(shipmentId),
          },
        },
        {
          $sort: { documentType: 1, version: -1 },
        },
        {
          $group: {
            _id: "$documentType",
            latest: { $first: "$$ROOT" },
          },
        },
        {
          $replaceRoot: { newRoot: "$latest" },
        },
      ])
      .exec();

    return {
      documents: documents as ShipmentDocumentDocument[],
      requiredDocumentTypes,
    };
  }
}
