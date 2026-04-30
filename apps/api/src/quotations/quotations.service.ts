import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Quotation, QuotationDocument } from "../schemas/quotation.schema";
import { Client, ClientDocument } from "../schemas/client.schema";
import { Company, CompanyDocument } from "../schemas/company.schema";
import { Shipping, ShippingDocument } from "../schemas/shipping.schema";
import { Agent, AgentDocument } from "../schemas/agent.schema";
import { User, UserDocument } from "../schemas/user.schema";
import { Office, OfficeDocument } from "../schemas/office.schema";
import { Template, TemplateDocument } from "../schemas/template.schema";
import { Port, PortDocument } from "../schemas/port.schema";
import {
  QuotationDelivery,
  QuotationDeliveryDocument,
} from "../schemas/quotation-delivery.schema";
import {
  AgentPricelist,
  AgentPricelistDocument,
} from "../schemas/agent-pricelist.schema";
import { Counter, CounterDocument } from "../schemas/counter.schema";
import { normalizeQuotationSnapshotForComparison } from "./quotation-snapshot-normalizer";
import isEqual from "lodash/isEqual";
import { HistoryService } from "../history/history.service";
import { MailService } from "../mail/mail.service";
import type { CreateQuotationDto } from "./dto";
import { QuotationFiltersDto, UpdateQuotationDto } from "./dto";
import { QuotationSerializer } from "./serializers";
import PDFDocument from "pdfkit";

@Injectable()
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);

  constructor(
    @InjectModel(Quotation.name)
    private quotationModel: Model<QuotationDocument>,
    @InjectModel(Client.name)
    private clientModel: Model<ClientDocument>,
    @InjectModel(Company.name)
    private companyModel: Model<CompanyDocument>,
    @InjectModel(Shipping.name)
    private shippingModel: Model<ShippingDocument>,
    @InjectModel(Agent.name)
    private agentModel: Model<AgentDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Office.name)
    private officeModel: Model<OfficeDocument>,
    @InjectModel(Template.name)
    private templateModel: Model<TemplateDocument>,
    @InjectModel(Port.name)
    private portModel: Model<PortDocument>,
    @InjectModel(QuotationDelivery.name)
    private quotationDeliveryModel: Model<QuotationDeliveryDocument>,
    @InjectModel(AgentPricelist.name)
    private pricelistModel: Model<AgentPricelistDocument>,
    @InjectModel(Counter.name)
    private counterModel: Model<CounterDocument>,
    private historyService: HistoryService,
    private mailService: MailService
  ) { }

  /**
   * Atomically generates the next sequential quote number.
   * Format: QT-YYYY-NNNN (e.g. "QT-2026-0001")
   * Uses a per-year counter key so numbering resets each year.
   */
  private async getNextQuoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counterId = `quotationNumber_${year}`;
    const counter = await this.counterModel.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    const seq = String(counter.seq).padStart(4, "0");
    return `QT-${year}-${seq}`;
  }

  /**
   * Record a quotation delivery when a quotation is sent to a client.
   * Creates a new delivery only if the new snapshot is not deeply equal to the
   * latest stored snapshot for this quotationId (after normalizing out volatile fields).
   * Snapshot is serialized to a plain object so BSON types (ObjectId, Date) don't cause write issues.
   */
  private async recordQuotationDelivery(params: {
    quotationId: Types.ObjectId;
    quotationSnapshot: Record<string, unknown>;
    clientId: Types.ObjectId;
    companyId: Types.ObjectId;
    officeId?: Types.ObjectId;
    sentBy: string;
    operatorEmail?: string;
    operatorName?: string;
    pdfData?: Buffer;
  }): Promise<void> {
    try {
      const inputSnapshot = (params.quotationSnapshot || {}) as Record<string, unknown>;
      // Deep clone so we preserve all quotation fields (quoteNumber, legacyItems, total, etc.)
      let snapshotPlain: Record<string, unknown>;
      try {
        snapshotPlain = JSON.parse(
          JSON.stringify(inputSnapshot),
        ) as Record<string, unknown>;
      } catch {
        snapshotPlain = { ...inputSnapshot };
      }
      // Ensure array fields are real arrays so length is never lost in MongoDB Mixed
      if (Array.isArray(inputSnapshot.legacyItems)) {
        const arr: unknown[] = [];
        for (let i = 0; i < inputSnapshot.legacyItems.length; i++) {
          const item = inputSnapshot.legacyItems[i];
          arr.push(
            typeof item === "object" && item !== null ? { ...(item as object) } : item,
          );
        }
        snapshotPlain.legacyItems = arr;
      }
      if (Array.isArray(inputSnapshot.items)) {
        const arr: unknown[] = [];
        for (let i = 0; i < inputSnapshot.items.length; i++) {
          const item = inputSnapshot.items[i];
          arr.push(
            typeof item === "object" && item !== null ? { ...(item as object) } : item,
          );
        }
        snapshotPlain.items = arr;
      }
      if (Array.isArray(inputSnapshot.equipmentItems)) {
        const arr: unknown[] = [];
        for (let i = 0; i < inputSnapshot.equipmentItems.length; i++) {
          const item = inputSnapshot.equipmentItems[i];
          arr.push(
            typeof item === "object" && item !== null ? { ...(item as object) } : item,
          );
        }
        snapshotPlain.equipmentItems = arr;
      }
      // Never store delivery-level fields inside the snapshot
      const deliveryOnlyKeys = ["sentBy", "sentAt", "createdAt", "updatedAt", "__v"];
      for (const k of deliveryOnlyKeys) {
        delete snapshotPlain[k];
      }

      const latestDelivery = await this.quotationDeliveryModel
        .findOne({ quotationId: params.quotationId, clientId: params.clientId })
        .sort({ sentAt: -1 })
        .lean()
        .exec();

      if (latestDelivery?.quotationSnapshot) {
        const normalizedNew =
          normalizeQuotationSnapshotForComparison(snapshotPlain);
        const normalizedPrevious = normalizeQuotationSnapshotForComparison(
          latestDelivery.quotationSnapshot as Record<string, unknown>
        );
        if (isEqual(normalizedNew, normalizedPrevious)) {
          return;
        }
      }

      await this.quotationDeliveryModel.create({
        quotationId: params.quotationId,
        quotationSnapshot: snapshotPlain,
        clientId: params.clientId,
        companyId: params.companyId,
        officeId: params.officeId,
        sentBy: new Types.ObjectId(params.sentBy),
        operator: {
          id: new Types.ObjectId(params.sentBy),
          ...(params.operatorEmail ? { email: params.operatorEmail } : {}),
          ...(params.operatorName ? { name: params.operatorName } : {}),
        },
        sentAt: new Date(),
        isActive: true,
        ...(params.pdfData ? { pdfData: params.pdfData } : {}),
      });
    } catch (err) {
      this.logger.error("Failed to record quotation delivery", {
        quotationId: params.quotationId?.toString(),
        error: err instanceof Error ? err.message : String(err),
      });
      // Don't rethrow - quotation create/update should still succeed
    }
  }

  /**
   * Send a quotation to its client: record delivery, set status to "sent", and send email.
   * Used when explicitly sending via POST /pricing/send-to-clients with quotationId.
   */
  async sendQuotationToClient(
    quotationId: string,
    userId: string,
    userEmail: string,
  ): Promise<{ quotationId: string; clientId: string; sentAt: Date }> {
    const operatorUser = await this.userModel
      .findById(userId)
      .select("firstName lastName")
      .lean()
      .exec();
    const operatorName = operatorUser
      ? `${(operatorUser as any).firstName || ""} ${(operatorUser as any).lastName || ""}`.trim()
      : undefined;

    const quotationObjectId = new Types.ObjectId(quotationId);
    const quotation = await this.quotationModel
      .findById(quotationObjectId)
      .populate("portOfOrigin", "name unlocode city countryName")
      .populate("portOfDestination", "name unlocode city countryName")
      .lean()
      .exec();
    if (!quotation) {
      throw new NotFoundException("Quotation not found");
    }
    const client = await this.clientModel
      .findById((quotation as any).clientId)
      .lean()
      .exec();
    if (!client) {
      throw new NotFoundException("Client not found for this quotation");
    }
    if (!(client as any).email?.trim()) {
      throw new BadRequestException(
        "Client has no email address; cannot send quotation",
      );
    }
    const company = await this.companyModel
      .findById((quotation as any).companyId)
      .lean()
      .exec();
    if (!company) {
      throw new NotFoundException("Company not found for this quotation");
    }

    const officeId =
      (client as any).office &&
      typeof (client as any).office === "object" &&
      (client as any).office._id
        ? (client as any).office._id
        : (client as any).office;

    // Build a plain snapshot with explicit array copies so delivery stores full legacyItems/items/equipmentItems
    const quotationPlain = quotation as Record<string, unknown>;
    const snapshotForDelivery: Record<string, unknown> = {
      ...quotationPlain,
      legacyItems: Array.isArray(quotationPlain.legacyItems)
        ? quotationPlain.legacyItems.map((item: unknown) =>
            typeof item === "object" && item !== null ? { ...(item as object) } : item,
          )
        : [],
      items: Array.isArray(quotationPlain.items)
        ? quotationPlain.items.map((item: unknown) =>
            typeof item === "object" && item !== null ? { ...(item as object) } : item,
          )
        : [],
      equipmentItems: Array.isArray(quotationPlain.equipmentItems)
        ? quotationPlain.equipmentItems.map((item: unknown) =>
            typeof item === "object" && item !== null ? { ...(item as object) } : item,
          )
        : [],
    };

    await this.recordQuotationDelivery({
      quotationId: quotationObjectId,
      quotationSnapshot: snapshotForDelivery,
      clientId: (quotation as any).clientId,
      companyId: (quotation as any).companyId,
      officeId: officeId ? new Types.ObjectId(officeId.toString()) : undefined,
      sentBy: userId,
      operatorEmail: userEmail,
      operatorName,
    });

    const sentAt = new Date();

    await this.quotationModel
      .findByIdAndUpdate(quotationObjectId, { status: "sent" })
      .exec();

    try {
      let companyAddress = "";
      if ((company as any).address) {
        const addr = (company as any).address;
        companyAddress = [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
          .filter(Boolean)
          .join(", ");
      }
      const validUntilFormatted = new Date((quotation as any).validUntil).toLocaleDateString(
        "en-US",
        { year: "numeric", month: "long", day: "numeric" },
      );
      const quotationDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const quotationForEmail = await this.quotationModel
        .findById(quotationObjectId)
        .lean()
        .exec();
      const formattedItems = await this.formatItemsForClientEmail(
        quotationForEmail || quotation,
      );
      const finalTotal = (quotationForEmail as any)?.total ?? (quotation as any).total;
      await this.mailService.sendQuotationEmail((client as any).email, {
        quotationId: quotationId,
        clientName: (client as any).name,
        quotationDate,
        items: formattedItems,
        total: finalTotal,
        showTotal: (quotation as any).summarize && finalTotal !== undefined,
        validUntil: validUntilFormatted,
        notes: (quotation as any).notes,
        companyName: (company as any).name,
        companyEmail: (company as any).email,
        companyPhone: (company as any).phone,
        companyAddress,
        companyTaxId: (company as any).taxId,
      });
    } catch (error) {
      this.logger.error("Failed to send quotation email", {
        error: error instanceof Error ? error.message : String(error),
        quotationId,
        clientEmail: (client as any).email,
      });
    }

    return {
      quotationId,
      clientId: (quotation as any).clientId.toString(),
      sentAt,
    };
  }

  /**
   * When a pricelist is distributed via POST /pricing/send-to-clients (pricelistId + PDF + clientIds),
   * create one Quotation + QuotationDelivery per client so that quotation_deliveries is populated
   * and client price-list views can show the send.
   */
  async recordQuotationDeliveriesForPricelistSend(
    sourceQuotationId: string | undefined,
    pricelistId: string,
    clientIds: Types.ObjectId[],
    userId: string,
    operatorEmail: string,
    quoteSnapshotPayload?: Record<string, unknown>,
    pdfBuffer?: Buffer,
  ): Promise<void> {
    const operatorUser = await this.userModel
      .findById(userId)
      .select("firstName lastName")
      .lean()
      .exec();
    const operatorName = operatorUser
      ? `${(operatorUser as any).firstName || ""} ${(operatorUser as any).lastName || ""}`.trim()
      : undefined;

    const pricelist = await this.pricelistModel
      .findById(pricelistId)
      .select("supplierId")
      .lean()
      .exec();
    if (!pricelist || !(pricelist as any).supplierId) {
      return;
    }
    const shippingLineId = new Types.ObjectId((pricelist as any).supplierId);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const canonicalQuotationObjectId =
      sourceQuotationId && Types.ObjectId.isValid(sourceQuotationId)
        ? new Types.ObjectId(sourceQuotationId)
        : undefined;
    const canonicalQuotation = canonicalQuotationObjectId
      ? await this.quotationModel
          .findById(canonicalQuotationObjectId)
          .populate("portOfOrigin", "name unlocode city countryName")
          .populate("portOfDestination", "name unlocode city countryName")
          .lean()
          .exec()
      : null;

    const canonicalLegacyItems = Array.isArray((canonicalQuotation as any)?.legacyItems)
      ? (canonicalQuotation as any).legacyItems
      : [];
    for (const clientId of clientIds) {
      try {
        const client = await this.clientModel
          .findById(clientId)
          .select("name email office")
          .lean()
          .exec();
        if (!client || !(client as any).office) continue;

        const office = await this.officeModel
          .findById((client as any).office)
          .select("company")
          .lean()
          .exec();
        if (!office || !(office as any).company) continue;

        const companyId = new Types.ObjectId((office as any).company);
        const officeId = new Types.ObjectId((client as any).office.toString());

        const companyDoc = await this.companyModel
          .findById(companyId)
          .select("name")
          .lean()
          .exec();

        // When we have a canonical quotation, always use its full legacyItems for the delivery snapshot so we never truncate (e.g. frontend may send 1 aggregated item per route; DB has full item list).
        // Use payload only when there is no canonical quotation (legacy per-client placeholder path).
        const sourceLegacyItems =
          canonicalQuotationObjectId && canonicalQuotation
            ? canonicalLegacyItems
            : Array.isArray(quoteSnapshotPayload?.legacyItems) &&
                quoteSnapshotPayload.legacyItems.length > 0
              ? quoteSnapshotPayload.legacyItems
              : canonicalLegacyItems;
        const legacyItems: unknown[] = sourceLegacyItems.map((item: unknown) =>
          typeof item === "object" && item !== null
            ? (JSON.parse(JSON.stringify(item)) as unknown)
            : item,
        );
        const totalFromPayload =
          typeof quoteSnapshotPayload?.total === "number" ? quoteSnapshotPayload.total : 0;
        const validUntilFromPayload =
          quoteSnapshotPayload?.validUntil != null
            ? new Date(quoteSnapshotPayload.validUntil as string | number)
            : validUntil;

        // If a canonical quotationId was provided (Create Quote screen), reuse it for ALL deliveries.
        // Do not create per-client placeholder quotations.
        if (canonicalQuotationObjectId && canonicalQuotation) {
          const base = canonicalQuotation as Record<string, unknown>;
          const snapshotForDelivery: Record<string, unknown> = {
            ...base,
            _id: canonicalQuotationObjectId.toString(),
            quotationId: canonicalQuotationObjectId.toString(),
            // recipient-scoped identifiers
            clientId: clientId.toString(),
            companyId: companyId.toString(),
            shippingLineId: shippingLineId.toString(),
            // payload overrides (matches PDF)
            legacyItems,
            total: totalFromPayload,
            validUntil: validUntilFromPayload,
            status: "sent",
            client: client
              ? {
                  _id: (client as any)._id?.toString(),
                  name: (client as any).name,
                  email: (client as any).email,
                }
              : undefined,
            company: companyDoc
              ? { _id: companyId.toString(), name: (companyDoc as any).name }
              : undefined,
            lineItems:
              legacyItems.length > 0
                ? legacyItems.map((item: any) =>
                    typeof item === "object" &&
                    item !== null &&
                    "description" in item &&
                    "price" in item
                      ? {
                          description: item.description,
                          price: item.price,
                          notes: item.notes,
                        }
                      : item,
                  )
                : [],
          };
          await this.recordQuotationDelivery({
            quotationId: canonicalQuotationObjectId,
            quotationSnapshot: snapshotForDelivery,
            clientId,
            companyId,
            officeId,
            sentBy: userId,
            operatorEmail,
            operatorName,
            pdfData: pdfBuffer,
          });
        } else {
          // Legacy behavior: create per-client placeholder quotation
          const quotation = new this.quotationModel({
            clientId,
            companyId,
            shippingLineId,
            createdBy: new Types.ObjectId(userId),
            validUntil: validUntilFromPayload,
            status: "sent",
            legacyItems,
            total: totalFromPayload,
            summarize: false,
            isActive: true,
          });
          const saved = await quotation.save();
          const snapshot = await this.quotationModel
            .findById(saved._id)
            .lean()
            .exec();
          if (snapshot) {
            const snapshotPlain = JSON.parse(
              JSON.stringify(snapshot),
            ) as Record<string, unknown>;
            const enrichedSnapshot: Record<string, unknown> = {
              ...snapshotPlain,
              legacyItems,
              total: totalFromPayload,
              validUntil: validUntilFromPayload,
              client: client
                ? {
                    _id: (client as any)._id?.toString(),
                    name: (client as any).name,
                    email: (client as any).email,
                  }
                : undefined,
              company: companyDoc
                ? { _id: companyId.toString(), name: (companyDoc as any).name }
                : undefined,
              lineItems:
                legacyItems.length > 0
                  ? legacyItems.map((item: any) =>
                      typeof item === "object" &&
                      item !== null &&
                      "description" in item &&
                      "price" in item
                        ? {
                            description: item.description,
                            price: item.price,
                            notes: item.notes,
                          }
                        : item,
                    )
                  : [],
            };
            await this.recordQuotationDelivery({
              quotationId: saved._id,
              quotationSnapshot: enrichedSnapshot,
              clientId,
              companyId,
              officeId,
              sentBy: userId,
              operatorEmail,
              operatorName,
              pdfData: pdfBuffer,
            });
          }
        }
      } catch (err) {
        this.logger.error("Failed to create QuotationDelivery for pricelist send", {
          pricelistId,
          clientId: clientId.toString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Format items for client email (handles legacy items, template items, and equipment items)
   */
  private async formatItemsForClientEmail(quotation: any): Promise<
    Array<{
      description: string;
      price: number;
      originalPrice?: number;
      quantity?: number;
      discount?: number;
      notes?: string;
      transitType?: string;
    }>
  > {
    // Use unified pricing breakdown - single source of truth
    const breakdown = await this.getPricingBreakdown(quotation);

    // Map breakdown line items to email format
    return breakdown.lineItems.map((item) => ({
      description: item.description,
      price: item.lineTotal, // Final line total (includes discounts and taxes)
      originalPrice: item.unitPrice * item.quantity, // Original price before any discounts
      quantity: item.quantity,
      discount: item.discountPct ?? undefined,
      notes: item.notes,
      transitType: item.transitType,
    }));
  }

  /**
   * Calculate quotation total with discounts and taxes
   * SINGLE SOURCE OF TRUTH for all total calculations
   * Now delegates to getPricingBreakdown() for consistency
   * Handles:
   * - Template-based items (with quantity, discount, tax flags)
   * - Equipment items (with quantity, discount, tax flags)
   * - Legacy items (normalized to quantity=1, discount=0)
   * - Template-level pricing config (templatePrice, templateDiscount, templateTaxRate)
   */
  private async calculateQuotationTotal(
    items: Array<{
      price?: number | null;
      quantity?: number | null;
      discount?: number | null;
      applyTemplateDiscount?: boolean;
      applyTaxes?: boolean;
      taxRate?: number | null;
    }>,
    equipmentItems: Array<{
      price?: number | null;
      quantity?: number | null;
      discount?: number | null;
      applyTemplateDiscount?: boolean;
      applyTaxes?: boolean;
      taxRate?: number | null;
    }>,
    pricingConfig?: {
      currency?: string;
      templatePrice?: number | null;
      templateDiscount?: number | null;
      applyTemplateDiscount?: boolean;
      templateTaxRate?: number | null;
      applyTemplateTaxes?: boolean;
    },
    legacyItems?: Array<{
      price?: number | null;
      quantity?: number | null;
      discount?: number | null;
      applyTaxes?: boolean;
      taxRate?: number | null;
      applyDiscount?: boolean; // For legacy items
    }>
  ): Promise<number> {
    // Build a quotation-like object to use with getPricingBreakdown
    // This ensures we use the same calculation logic everywhere
    const quotationLike = {
      items: items || [],
      equipmentItems: equipmentItems || [],
      legacyItems: legacyItems || [],
      pricingConfig: pricingConfig || {},
      templateId: null, // No template lookup needed - we're calculating from normalized data
    };

    // Use unified pricing breakdown - single source of truth
    const breakdown = await this.getPricingBreakdown(quotationLike);
    return breakdown.totals.total;
  }

  /**
   * Round to 2 decimal places - consistent rounding policy
   */
  private roundTo2Decimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Unified pricing breakdown function - SINGLE SOURCE OF TRUTH for all pricing displays
   * Returns normalized line items with complete pricing details and totals
   * Used by: emails, PDFs, notifications, and any other display format
   *
   * @param quotation - Quotation object (or quotation-like object with items/equipmentItems/legacyItems/pricingConfig/templateId)
   * @param templateItems - Optional: pre-fetched template items (avoids DB hit)
   * @param templateEquipmentItems - Optional: pre-fetched template equipment items (avoids DB hit)
   */
  private async getPricingBreakdown(
    quotation: any,
    templateItems?: any[],
    templateEquipmentItems?: any[]
  ): Promise<{
    lineItems: Array<{
      type: "legacy" | "item" | "equipment" | "template_fee";
      description: string;
      quantity: number;
      unitPrice: number;
      discountPct: number | null;
      templateDiscountApplied: boolean;
      taxRate: number | null;
      lineSubtotal: number; // After item discount, before template discount
      lineTaxes: number; // Item-level taxes only
      lineTotal: number; // Final line total (subtotal + taxes)
      taxableBaseAfterTemplateDiscount: number; // Rounded taxable base for template tax (only for items without item-level taxes)
      notes?: string;
      transitType?: string;
    }>;
    totals: {
      subtotal: number; // Sum of all line subtotals (after item discounts, before template discount)
      templateDiscountAmount: number; // Amount of template discount applied
      subtotalAfterTemplateDiscount: number; // After template discount
      itemTaxes: number; // Sum of all item-level taxes
      templateTaxAmount: number; // Template-level tax amount
      totalTaxes: number; // Sum of item taxes + template tax
      total: number; // Final total
    };
  }> {
    // Use provided template items or fetch if needed
    let resolvedTemplateItems: any[] = templateItems || [];
    let resolvedTemplateEquipmentItems: any[] = templateEquipmentItems || [];
    const templateId = quotation.templateId;

    // Only fetch if not provided and templateId exists
    if (!templateItems && !templateEquipmentItems && templateId) {
      const templateIdValue =
        typeof templateId === "string"
          ? templateId
          : (templateId as any)._id
            ? (templateId as any)._id.toString()
            : templateId.toString();

      const template = await this.templateModel
        .findById(templateIdValue)
        .select("items equipmentItems")
        .lean()
        .exec();

      if (template) {
        resolvedTemplateItems = (template as any).items || [];
        resolvedTemplateEquipmentItems = (template as any).equipmentItems || [];
      }
    } else {
      resolvedTemplateItems = templateItems || [];
      resolvedTemplateEquipmentItems = templateEquipmentItems || [];
    }

    const pricingConfig = quotation.pricingConfig || {};
    const lineItems: Array<{
      type: "legacy" | "item" | "equipment" | "template_fee";
      description: string;
      quantity: number;
      unitPrice: number;
      discountPct: number | null;
      templateDiscountApplied: boolean;
      taxRate: number | null;
      lineSubtotal: number;
      lineTaxes: number;
      lineTotal: number;
      taxableBaseAfterTemplateDiscount: number;
      notes?: string;
      transitType?: string;
    }> = [];

    // Process legacy items
    for (const item of quotation.legacyItems || []) {
      const unitPrice = item.price ?? 0;
      const quantity = item.quantity ?? 1;
      // Check applyDiscount flag - if false, don't apply discount
      const applyDiscount = item.applyDiscount !== false; // Default to true if not explicitly false
      const discount = applyDiscount ? (item.discount ?? 0) : 0;
      const discountPct =
        applyDiscount && discount > 0 && discount <= 100 ? discount : null;

      // Calculate line subtotal (after item discount, before template discount)
      let lineSubtotal = unitPrice * quantity;
      if (discountPct) {
        lineSubtotal = lineSubtotal * (1 - discountPct / 100);
      }
      lineSubtotal = this.roundTo2Decimals(lineSubtotal); // Round subtotal

      // Legacy items always opt-in to template discount
      const templateDiscountApplied =
        pricingConfig?.applyTemplateDiscount &&
        pricingConfig?.templateDiscount &&
        pricingConfig.templateDiscount > 0;

      // Item-level taxes for legacy items
      const taxRate =
        item.applyTaxes && item.taxRate && item.taxRate > 0
          ? item.taxRate
          : null;

      // Calculate item-level taxes (on lineSubtotal, before template discount)
      // Template discount is applied at aggregate level, not per-item
      let lineTaxes = 0;
      if (taxRate) {
        lineTaxes = lineSubtotal * (taxRate / 100);
        lineTaxes = this.roundTo2Decimals(lineTaxes); // Round taxes
      }

      // Line total = subtotal + item taxes (template discount applied at aggregate level)
      const lineTotal = this.roundTo2Decimals(lineSubtotal + lineTaxes); // Round final line total

      // Calculate taxable base for template tax (only for items without item-level taxes)
      // Template discount will be applied at aggregate level, so use lineSubtotal here
      let taxableBaseAfterTemplateDiscount = 0;
      if (!taxRate) {
        // Only items without item-level taxes contribute to template tax base
        // Use lineSubtotal (template discount applied at aggregate level)
        taxableBaseAfterTemplateDiscount = lineSubtotal; // Already rounded
      }

      lineItems.push({
        type: "legacy",
        description: item.description || "N/A",
        quantity,
        unitPrice,
        discountPct,
        templateDiscountApplied,
        taxRate,
        lineSubtotal,
        lineTaxes,
        lineTotal,
        taxableBaseAfterTemplateDiscount,
        notes: item.notes,
        transitType: item.transitType,
      });
    }

    // Process template-based items
    for (const item of quotation.items || []) {
      const templateItem = resolvedTemplateItems.find(
        (ti: any) =>
          String(ti.id) === String(item.itemId) ||
          String(ti._id) === String(item.itemId)
      );
      const description = templateItem?.label ?? item.description ?? `Item ${String(item.itemId)}`;

      const unitPrice = item.price ?? 0;
      const quantity = item.quantity ?? 1;
      const discount = item.discount ?? 0;
      const discountPct = discount > 0 && discount <= 100 ? discount : null;

      // Calculate line subtotal (after item discount, before template discount)
      let lineSubtotal = unitPrice * quantity;
      if (discountPct) {
        lineSubtotal = lineSubtotal * (1 - discountPct / 100);
      }
      lineSubtotal = this.roundTo2Decimals(lineSubtotal); // Round subtotal

      // Template discount opt-in/out
      const templateDiscountApplied =
        item.applyTemplateDiscount !== false &&
        pricingConfig?.applyTemplateDiscount &&
        pricingConfig?.templateDiscount &&
        pricingConfig.templateDiscount > 0;

      // Item-level taxes
      const taxRate =
        item.applyTaxes && item.taxRate && item.taxRate > 0
          ? item.taxRate
          : null;

      // Calculate item-level taxes (on lineSubtotal, before template discount)
      // Template discount is applied at aggregate level, not per-item
      let lineTaxes = 0;
      if (taxRate) {
        lineTaxes = lineSubtotal * (taxRate / 100);
        lineTaxes = this.roundTo2Decimals(lineTaxes); // Round taxes
      }

      // Line total = subtotal + item taxes (template discount applied at aggregate level)
      const lineTotal = this.roundTo2Decimals(lineSubtotal + lineTaxes); // Round final line total

      // Calculate taxable base for template tax (only for items without item-level taxes)
      // Template discount will be applied at aggregate level, so use lineSubtotal here
      let taxableBaseAfterTemplateDiscount = 0;
      if (!taxRate) {
        // Only items without item-level taxes contribute to template tax base
        // Use lineSubtotal (template discount applied at aggregate level)
        taxableBaseAfterTemplateDiscount = lineSubtotal; // Already rounded
      }

      lineItems.push({
        type: "item",
        description,
        quantity,
        unitPrice,
        discountPct,
        templateDiscountApplied,
        taxRate,
        lineSubtotal,
        lineTaxes,
        lineTotal,
        taxableBaseAfterTemplateDiscount,
        notes: item.notes,
        transitType: templateItem?.transitType,
      });
    }

    // Process equipment items
    for (const eqItem of quotation.equipmentItems || []) {
      const templateEquipmentItem = resolvedTemplateEquipmentItems.find(
        (tei: any) =>
          String(tei.id) === String(eqItem.equipmentItemId) ||
          String(tei._id) === String(eqItem.equipmentItemId)
      );
      const description =
        templateEquipmentItem?.label || `Equipment ${eqItem.equipmentItemId}`;

      const unitPrice = eqItem.price ?? 0;
      const quantity = eqItem.quantity ?? 1;
      const discount = eqItem.discount ?? 0;
      const discountPct = discount > 0 && discount <= 100 ? discount : null;

      // Calculate line subtotal (after item discount, before template discount)
      let lineSubtotal = unitPrice * quantity;
      if (discountPct) {
        lineSubtotal = lineSubtotal * (1 - discountPct / 100);
      }
      lineSubtotal = this.roundTo2Decimals(lineSubtotal); // Round subtotal

      // Template discount opt-in/out
      const templateDiscountApplied =
        eqItem.applyTemplateDiscount !== false &&
        pricingConfig?.applyTemplateDiscount &&
        pricingConfig?.templateDiscount &&
        pricingConfig.templateDiscount > 0;

      // Item-level taxes
      const taxRate =
        eqItem.applyTaxes && eqItem.taxRate && eqItem.taxRate > 0
          ? eqItem.taxRate
          : null;

      // Calculate item-level taxes (on lineSubtotal, before template discount)
      // Template discount is applied at aggregate level, not per-item
      let lineTaxes = 0;
      if (taxRate) {
        lineTaxes = lineSubtotal * (taxRate / 100);
        lineTaxes = this.roundTo2Decimals(lineTaxes); // Round taxes
      }

      // Line total = subtotal + item taxes (template discount applied at aggregate level)
      const lineTotal = this.roundTo2Decimals(lineSubtotal + lineTaxes); // Round final line total

      // Calculate taxable base for template tax (only for items without item-level taxes)
      // Template discount will be applied at aggregate level, so use lineSubtotal here
      let taxableBaseAfterTemplateDiscount = 0;
      if (!taxRate) {
        // Only items without item-level taxes contribute to template tax base
        // Use lineSubtotal (template discount applied at aggregate level)
        taxableBaseAfterTemplateDiscount = lineSubtotal; // Already rounded
      }

      lineItems.push({
        type: "equipment",
        description,
        quantity,
        unitPrice,
        discountPct,
        templateDiscountApplied,
        taxRate,
        lineSubtotal,
        lineTaxes,
        lineTotal,
        taxableBaseAfterTemplateDiscount,
        notes: eqItem.notes,
      });
    }

    // Add template price as synthetic line item (if present)
    // Template price always opts-in to template discount and is taxable for template tax
    if (pricingConfig?.templatePrice && pricingConfig.templatePrice > 0) {
      const templatePrice = pricingConfig.templatePrice;
      const lineSubtotal = this.roundTo2Decimals(templatePrice);

      // Template price always opts-in to template discount
      const templateDiscountApplied =
        pricingConfig?.applyTemplateDiscount &&
        pricingConfig?.templateDiscount &&
        pricingConfig.templateDiscount > 0;

      // Template price has no item-level taxes (taxRate: null)
      // Template-level tax will apply to it
      // Template discount is applied at aggregate level, not per-item
      const lineTaxes = 0; // No item-level taxes
      const lineTotal = this.roundTo2Decimals(lineSubtotal + lineTaxes); // Round final line total

      // Template fee always contributes to template tax base (no item-level taxes)
      // Use lineSubtotal (template discount applied at aggregate level)
      const taxableBaseAfterTemplateDiscount = lineSubtotal; // Already rounded

      lineItems.push({
        type: "template_fee",
        description: "Template Fee",
        quantity: 1,
        unitPrice: templatePrice,
        discountPct: templateDiscountApplied
          ? pricingConfig.templateDiscount
          : null,
        templateDiscountApplied,
        taxRate: null, // Template-level tax applies, not item-level
        lineSubtotal,
        lineTaxes,
        lineTotal,
        taxableBaseAfterTemplateDiscount,
      });
    }

    // Calculate totals
    // Subtotal = sum of all line subtotals (after item discounts, before template discount)
    const subtotal = this.roundTo2Decimals(
      lineItems.reduce((sum, item) => sum + item.lineSubtotal, 0)
    );

    // Calculate template discount amount (only on items that opted in)
    let templateDiscountAmount = 0;
    if (
      pricingConfig?.applyTemplateDiscount &&
      pricingConfig?.templateDiscount &&
      pricingConfig.templateDiscount > 0
    ) {
      const optInItems = lineItems.filter(
        (item) => item.templateDiscountApplied
      );
      const optInSubtotal = this.roundTo2Decimals(
        optInItems.reduce((sum, item) => sum + item.lineSubtotal, 0),
      );
      templateDiscountAmount = this.roundTo2Decimals(
        optInSubtotal * (pricingConfig.templateDiscount / 100),
      );
    }

    const subtotalAfterTemplateDiscount = this.roundTo2Decimals(
      subtotal - templateDiscountAmount
    );

    // Sum item-level taxes (these are already calculated on discounted amounts in lineTaxes)
    const itemTaxes = this.roundTo2Decimals(
      lineItems.reduce((sum, item) => sum + item.lineTaxes, 0)
    );

    // Calculate template-level tax (on taxable base - items without item-level taxes)
    // Taxable base = sum of lineSubtotals for items without item-level taxes
    // Template discount is applied at aggregate level before calculating tax
    let templateTaxAmount = 0;

    if (
      pricingConfig?.applyTemplateTaxes &&
      pricingConfig?.templateTaxRate &&
      pricingConfig.templateTaxRate > 0
    ) {
      // Template tax should be applied to the entire subtotal after template discount
      // This ensures template tax is applied at the end as expected
      // Note: This applies template tax to ALL items, including those with item-level taxes
      // If you want to exclude items with item-level taxes, use the commented code below

      // Apply template tax to subtotal after template discount
      const taxableBaseForTemplateTax = subtotalAfterTemplateDiscount;

      templateTaxAmount = this.roundTo2Decimals(
        taxableBaseForTemplateTax * (pricingConfig.templateTaxRate / 100),
      );

      // ALTERNATIVE: If you want template tax to apply only to items WITHOUT item-level taxes:
      // Uncomment the code below and comment out the code above
      /*
      // Sum lineSubtotals for items without item-level taxes (these contribute to template tax base)
      const taxableBaseBeforeDiscount = lineItems
        .filter((item) => !item.taxRate)
        .reduce((sum, item) => sum + item.lineSubtotal, 0);

      // Apply template discount to taxable base at aggregate level
      let taxableBaseAfterDiscount = taxableBaseBeforeDiscount;
      if (
        pricingConfig?.applyTemplateDiscount &&
        pricingConfig?.templateDiscount &&
        pricingConfig.templateDiscount > 0
      ) {
        // Calculate which items opted in to template discount
        const optInTaxableBase = lineItems
          .filter((item) => !item.taxRate && item.templateDiscountApplied)
          .reduce((sum, item) => sum + item.lineSubtotal, 0);
        const optOutTaxableBase = taxableBaseBeforeDiscount - optInTaxableBase;

        // Apply discount only to opt-in items
        const discountedOptInBase = this.roundTo2Decimals(
          optInTaxableBase * (1 - pricingConfig.templateDiscount / 100)
        );
        taxableBaseAfterDiscount = this.roundTo2Decimals(
          discountedOptInBase + optOutTaxableBase
        );
      }

      templateTaxAmount = this.roundTo2Decimals(
        taxableBaseAfterDiscount * (pricingConfig.templateTaxRate / 100)
      );
      */
    }

    const totalTaxes = this.roundTo2Decimals(itemTaxes + templateTaxAmount);
    // Total = subtotal after template discount + all taxes
    const total = this.roundTo2Decimals(
      subtotalAfterTemplateDiscount + totalTaxes
    );

    return {
      lineItems,
      totals: {
        subtotal,
        templateDiscountAmount,
        subtotalAfterTemplateDiscount,
        itemTaxes,
        templateTaxAmount,
        totalTaxes,
        total,
      },
    };
  }

  /**
   * Ensure port exists, create if needed
   */
  private async ensurePortExists(
    portId: string | undefined,
    companyId: Types.ObjectId
  ): Promise<Types.ObjectId | undefined> {
    if (!portId) {
      return undefined;
    }

    // Check if it's a valid ObjectId
    let portObjectId: Types.ObjectId;
    try {
      portObjectId = new Types.ObjectId(portId);
    } catch (error) {
      throw new BadRequestException(`Invalid portId format: "${portId}".`);
    }

    // Check if port exists
    const port = await this.portModel.findById(portObjectId).exec();
    if (port) {
      return portObjectId;
    }

    // Port doesn't exist - this shouldn't happen if UI creates it first
    // But we'll throw an error to be safe
    throw new NotFoundException(
      `Port with id "${portId}" not found. Please create the port first.`
    );
  }

  async create(
    createQuotationDto: CreateQuotationDto,
    userId: string,
    userEmail: string
  ) {
    // Validate required fields
    if (!createQuotationDto.clientId) {
      throw new BadRequestException("clientId is required");
    }
    if (!createQuotationDto.companyId) {
      throw new BadRequestException("companyId is required");
    }
    if (!createQuotationDto.shippingLineId) {
      throw new BadRequestException("shippingLineId is required");
    }
    // Check if this is a template-based quotation
    const isTemplateBased = !!createQuotationDto.templateId;

    // Validate items/legacyItems based on mode
    if (!isTemplateBased) {
      const hasItems = createQuotationDto.items && createQuotationDto.items.length > 0;
      const hasLegacyItems = createQuotationDto.legacyItems && createQuotationDto.legacyItems.length > 0;
      if (!hasItems && !hasLegacyItems) {
        throw new BadRequestException(
          "It is not allowed to create quotations without items."
        );
      }
    }
    if (!createQuotationDto.validUntil) {
      throw new BadRequestException("validUntil is required");
    }

    // Get authenticated user to verify company access
    const user = await this.userModel.findById(userId).select("company").exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Validate and convert IDs to ObjectIds
    let companyObjectId: Types.ObjectId;
    try {
      companyObjectId = new Types.ObjectId(createQuotationDto.companyId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid companyId format: "${createQuotationDto.companyId}".`
      );
    }

    // Validate that companyId matches the authenticated user's companyId
    if (user.company.toString() !== companyObjectId.toString()) {
      throw new ForbiddenException(
        "You can only create quotations for your own company."
      );
    }

    // Validate and convert IDs to ObjectIds
    let clientObjectId: Types.ObjectId;
    let shippingLineObjectId: Types.ObjectId;
    let agentObjectId: Types.ObjectId | undefined;

    try {
      clientObjectId = new Types.ObjectId(createQuotationDto.clientId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid clientId format: "${createQuotationDto.clientId}".`
      );
    }

    try {
      shippingLineObjectId = new Types.ObjectId(
        createQuotationDto.shippingLineId
      );
    } catch (error) {
      throw new BadRequestException(
        `Invalid shippingLineId format: "${createQuotationDto.shippingLineId}".`
      );
    }

    if (createQuotationDto.agentId) {
      try {
        agentObjectId = new Types.ObjectId(createQuotationDto.agentId);
      } catch (error) {
        throw new BadRequestException(
          `Invalid agentId format: "${createQuotationDto.agentId}".`
        );
      }
    }

    // Validate that referenced entities exist and belong to the company
    const [client, company, shipping, agent] = await Promise.all([
      this.clientModel.findById(clientObjectId).exec(),
      this.companyModel.findById(companyObjectId).exec(),
      this.shippingModel.findById(shippingLineObjectId).exec(),
      agentObjectId
        ? this.agentModel.findById(agentObjectId).exec()
        : Promise.resolve(null),
    ]);

    if (!client) {
      throw new NotFoundException(
        `Client with id "${createQuotationDto.clientId}" not found.`
      );
    }

    // Validate client belongs to user's company (via office) and is active
    if (!client.isActive) {
      throw new BadRequestException(
        `Client with id "${createQuotationDto.clientId}" is not active.`
      );
    }
    const clientOffice = await this.officeModel
      .findById(client.office)
      .select("company")
      .exec();
    if (!clientOffice) {
      throw new NotFoundException(
        `Office for client "${createQuotationDto.clientId}" not found.`
      );
    }
    if (clientOffice.company.toString() !== companyObjectId.toString()) {
      throw new ForbiddenException(
        `Client with id "${createQuotationDto.clientId}" does not belong to your company.`
      );
    }

    if (!company) {
      throw new NotFoundException(
        `Company with id "${createQuotationDto.companyId}" not found.`
      );
    }
    if (!shipping) {
      throw new NotFoundException(
        `Shipping line with id "${createQuotationDto.shippingLineId}" not found.`
      );
    }
    if (!shipping.isActive) {
      throw new BadRequestException(
        `Shipping line with id "${createQuotationDto.shippingLineId}" is not active.`
      );
    }
    if (agentObjectId && !agent) {
      throw new NotFoundException(
        `Agent with id "${createQuotationDto.agentId}" not found.`
      );
    }
    if (agentObjectId && agent && !agent.isActive) {
      throw new BadRequestException(
        `Agent with id "${createQuotationDto.agentId}" is not active.`
      );
    }

    // Load template if templateId is provided
    let template: TemplateDocument | null = null;
    let templateObjectId: Types.ObjectId | undefined;

    if (isTemplateBased) {
      try {
        templateObjectId = new Types.ObjectId(createQuotationDto.templateId);
      } catch (error) {
        throw new BadRequestException(
          `Invalid templateId format: "${createQuotationDto.templateId}".`
        );
      }

      template = await this.templateModel.findById(templateObjectId).exec();
      if (!template) {
        throw new NotFoundException(
          `Template with id "${createQuotationDto.templateId}" not found.`
        );
      }

      // Validate template belongs to same company
      if (template.companyId.toString() !== companyObjectId.toString()) {
        throw new ForbiddenException(
          "You can only use templates from your own company."
        );
      }

      // Validate template is active
      if (!template.isActive) {
        throw new BadRequestException("Template is not active.");
      }
    }

    // Handle ports
    const portOfOriginObjectId = await this.ensurePortExists(
      (createQuotationDto as any).originPortId,
      companyObjectId
    );

    const portOfDestinationObjectId = await this.ensurePortExists(
      (createQuotationDto as any).destinationPortId,
      companyObjectId
    );

    // Process items based on mode
    let legacyItems: any[] | undefined = undefined;
    let templateItems: any[] | undefined = undefined;
    let equipmentItems: any[] | undefined = undefined;
    let pricingConfig: any | undefined = undefined;
    let visibilityFlags: any = {};

    if (isTemplateBased && template) {
      // Template-based quotation
      // Copy pricing config from template (can be overridden)
      pricingConfig = createQuotationDto.pricingConfig || {
        currency: template.pricingConfig.currency,
        templatePrice: template.pricingConfig.templatePrice,
        templateDiscount: template.pricingConfig.templateDiscount,
        applyTemplateDiscount: template.pricingConfig.applyTemplateDiscount,
        templateTaxRate: template.pricingConfig.templateTaxRate,
        applyTemplateTaxes: template.pricingConfig.applyTemplateTaxes,
      };

      // Copy visibility flags from template (can be overridden)
      visibilityFlags = {
        showAgentToClient:
          createQuotationDto.showAgentToClient !== undefined
            ? createQuotationDto.showAgentToClient
            : template.showAgentToClient,
        showCarrierToClient:
          createQuotationDto.showCarrierToClient !== undefined
            ? createQuotationDto.showCarrierToClient
            : template.showCarrierToClient,
        showCommodityToClient:
          createQuotationDto.showCommodityToClient !== undefined
            ? createQuotationDto.showCommodityToClient
            : template.showCommodityToClient,
        showNotesToClient:
          createQuotationDto.showNotesToClient !== undefined
            ? createQuotationDto.showNotesToClient
            : template.showNotesToClient,
      };

      // Use template-style items
      // Default applyTemplateDiscount to true (opt-in) to match calculation logic
      templateItems = (createQuotationDto.items || []).map((item) => ({
        ...item,
        discount: item.discount ?? 0,
        applyTemplateDiscount: item.applyTemplateDiscount ?? true,
        applyTaxes: item.applyTaxes ?? false,
        // Preserve taxRate exactly as provided - don't modify it
        taxRate: item.taxRate,
      }));

      equipmentItems = (createQuotationDto.equipmentItems || []).map(
        (item) => ({
          ...item,
          discount: item.discount ?? 0,
          applyTemplateDiscount: item.applyTemplateDiscount ?? true,
          applyTaxes: item.applyTaxes ?? false,
          // Preserve taxRate exactly as provided - don't modify it
          taxRate: item.taxRate,
        })
      );

      // Validate items match template structure (basic validation)
      // Note: Full validation would require checking each itemId exists in template.items
      // For now, we'll trust the frontend sends correct data
    } else {
      // Legacy quotation mode
      // Validate legacy items
      pricingConfig = createQuotationDto.pricingConfig;

      if (createQuotationDto.legacyItems) {
        for (const item of createQuotationDto.legacyItems) {
          // if (!item.type || !["cargo", "custom"].includes(item.type)) {
          //   throw new BadRequestException("Item type must be 'cargo' or 'custom'.");
          // }
          if (!item.description || item.description.trim() === "") {
            throw new BadRequestException("Item description is required.");
          }
          if (
            item.price === undefined ||
            item.price === null ||
            item.price < 0
          ) {
            throw new BadRequestException(
              "Item price must be greater than or equal to 0."
            );
          }
          // if (item.type === "cargo") {
          //   if (
          //     !item.transitType ||
          //     !["air", "land", "maritime"].includes(item.transitType)
          //   ) {
          //     throw new BadRequestException(
          //       "transitType is required for cargo items and must be 'air', 'land', or 'maritime'."
          //     );
          //   }
          // }
          if (item.type === "custom" && item.transitType) {
            throw new BadRequestException(
              "transitType should not be provided for custom items."
            );
          }
        }

        // Process legacy items
        legacyItems = createQuotationDto.legacyItems.map((item) => ({
          type: item.type,
          description: item.description,
          price: item.price,
          cost: (item as any).cost,   // raw cost before profit, used for ledger import
          quantity: item.quantity ?? 1,

          discount: item.discount ?? 0,
          applyDiscount: item.applyDiscount ?? true,
          applyTaxes: item.applyTaxes ?? false,
          taxRate: item.taxRate ?? 0,

          notes: item.notes,
          transitType: item.type === "cargo" ? item.transitType : undefined,
          ...(item.equipmentType ? { equipmentType: item.equipmentType } : {}),
        }));
      }

      // Default visibility flags for legacy quotations
      visibilityFlags = {
        showAgentToClient:
          createQuotationDto.showAgentToClient !== undefined
            ? createQuotationDto.showAgentToClient
            : true,
        showCarrierToClient:
          createQuotationDto.showCarrierToClient !== undefined
            ? createQuotationDto.showCarrierToClient
            : true,
        showCommodityToClient:
          createQuotationDto.showCommodityToClient !== undefined
            ? createQuotationDto.showCommodityToClient
            : true,
        showNotesToClient:
          createQuotationDto.showNotesToClient !== undefined
            ? createQuotationDto.showNotesToClient
            : true,
      };
    }

    // Calculate total using single source of truth
    let total: number | undefined = undefined;
    if (createQuotationDto.summarize) {
      if (isTemplateBased) {
        // Template-based calculation
        total = await this.calculateQuotationTotal(
          templateItems || [],
          equipmentItems || [],
          pricingConfig
        );
      } else {
        // Legacy calculation - normalize legacy items to same format
        const normalizedLegacyItems = (legacyItems || []).map((item) => ({
          price: item.price ?? 0,
          quantity: item.quantity ?? 1,
          discount: item.applyDiscount === false ? 0 : (item.discount ?? 0),
          applyTaxes: item.applyTaxes ?? false,
          taxRate: item.taxRate ?? 0,
          applyDiscount: item.applyDiscount ?? true,
        }));

        total = await this.calculateQuotationTotal(
          [],
          [],
          pricingConfig,
          normalizedLegacyItems
        );
      }
    }

    // Parse validUntil date
    const validUntil =
      createQuotationDto.validUntil instanceof Date
        ? createQuotationDto.validUntil
        : new Date(createQuotationDto.validUntil);

    if (isNaN(validUntil.getTime())) {
      throw new BadRequestException("validUntil must be a valid date.");
    }

    // Determine status (default to draft)
    const status = createQuotationDto.status || "draft";

    // Generate sequential quote number atomically
    const quoteNumber = await this.getNextQuoteNumber();

    // Create quotation
    const quotationData: any = {
      quoteNumber,
      sourcePricelistId: createQuotationDto.sourcePricelistId,
      clientId: clientObjectId,
      companyId: companyObjectId,
      shippingLineId: shippingLineObjectId,
      agentId: agentObjectId,
      portOfOrigin: portOfOriginObjectId,
      portOfDestination: portOfDestinationObjectId,
      notes: createQuotationDto.notes,
      validUntil,
      summarize: createQuotationDto.summarize ?? false,
      total,
      status,
      createdBy: new Types.ObjectId(userId),
      serviceType: createQuotationDto.serviceType,
      incoterm: createQuotationDto.incoterm,
      shippingMode: createQuotationDto.shippingMode,
      ...visibilityFlags,
    };
    if (pricingConfig) {
      quotationData.pricingConfig = pricingConfig;
    }
    if (isTemplateBased) {
      quotationData.templateId = templateObjectId;
      quotationData.headerFieldValues =
        createQuotationDto.headerFieldValues || [];
      quotationData.items = templateItems || [];
      quotationData.equipmentItems = equipmentItems || [];
      quotationData.pricingConfig = pricingConfig;
    } else if (createQuotationDto.items && createQuotationDto.items.length > 0) {
      // Pricelist-based quotation: save to items field
      quotationData.items = createQuotationDto.items.map((item) => ({
        itemId: item.itemId,
        description: item.description,
        price: item.price,
        cost: item.cost,
        quantity: item.quantity ?? 1,
        discount: item.discount ?? 0,
        notes: item.notes,
        applyTemplateDiscount: false,
        applyTaxes: item.applyTaxes ?? false,
        taxRate: item.taxRate,
        type: item.type,
        transitType: item.transitType,
        ...(item.equipmentType ? { equipmentType: item.equipmentType } : {}),
      }));
      quotationData.legacyItems = [];
    } else {
      quotationData.legacyItems = legacyItems || [];
    }

    const quotation = new this.quotationModel(quotationData);
    const saved = await quotation.save();

    await this.historyService.log({
      action: "create",
      entityType: "quotation",
      entityId: saved._id.toString(),
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Quotation created for client "${client.name}"`,
      after: saved,
    });

    // QuotationDelivery and client email are triggered by POST /pricing/send-to-clients with quotationId (not here).

    // Return the created quotation using serializer
    return QuotationSerializer.toResponse(saved);
  }

  async findAll(
    userId: string,
    filters?: QuotationFiltersDto,
    page: number = 1,
    limit: number = 50,
    sort: string = "createdAt",
    order: "ASC" | "DESC" = "DESC"
  ) {
    // Get authenticated user to filter by company
    const user = await this.userModel.findById(userId).select("company").exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Build query filter - always filter by user's company
    const queryFilter: any = {
      companyId: user.company,
      isActive: true,
    };

    // Apply clientId filter
    if (filters?.clientId) {
      try {
        queryFilter.clientId = new Types.ObjectId(filters.clientId);
      } catch (error) {
        throw new BadRequestException(
          `Invalid clientId format: "${filters.clientId}"`
        );
      }
    }

    // Apply createdBy filter
    if (filters?.createdBy) {
      try {
        queryFilter.createdBy = new Types.ObjectId(filters.createdBy);
      } catch (error) {
        throw new BadRequestException(
          `Invalid createdBy format: "${filters.createdBy}"`
        );
      }
    }

    // Apply chargeType filter (now uses transitType for cargo items)
    // If chargeType is provided, filter quotations that have at least one cargo item with that transitType
    if (filters?.chargeType) {
      if (!["maritime", "air", "land"].includes(filters.chargeType)) {
        throw new BadRequestException(
          `Invalid chargeType. Must be one of: maritime, air, land.`
        );
      }
      // Use $or to find quotations with at least one cargo item matching the transitType
      // Handle both template-based items and legacy items
      queryFilter.$or = [
        {
          items: {
            $elemMatch: {
              type: "cargo",
              transitType: filters.chargeType,
            },
          },
        },
        {
          legacyItems: {
            $elemMatch: {
              type: "cargo",
              transitType: filters.chargeType,
            },
          },
        },
      ];
    }

    // Apply shippingLineId filter
    if (filters?.shippingLineId) {
      try {
        queryFilter.shippingLineId = new Types.ObjectId(filters.shippingLineId);
      } catch (error) {
        throw new BadRequestException(
          `Invalid shippingLineId format: "${filters.shippingLineId}"`
        );
      }
    }

    // Apply sourcePricelistId filter
    if (filters?.sourcePricelistId) {
      queryFilter.sourcePricelistId = filters.sourcePricelistId;
    }

    // Apply status filter
    if (filters?.status) {
      queryFilter.status = filters.status;
    }

    // Apply createdAt date range filter
    if (filters?.createdAtFrom || filters?.createdAtTo) {
      queryFilter.createdAt = {};
      if (filters.createdAtFrom) {
        const fromDate = new Date(filters.createdAtFrom);
        if (isNaN(fromDate.getTime())) {
          throw new BadRequestException(
            `Invalid createdAtFrom date format: "${filters.createdAtFrom}".`
          );
        }
        queryFilter.createdAt.$gte = fromDate;
      }
      if (filters.createdAtTo) {
        const toDate = new Date(filters.createdAtTo);
        if (isNaN(toDate.getTime())) {
          throw new BadRequestException(
            `Invalid createdAtTo date format: "${filters.createdAtTo}".`
          );
        }
        // Set to end of day
        toDate.setHours(23, 59, 59, 999);
        queryFilter.createdAt.$lte = toDate;
      }
    }

    // Build sort object
    const sortOrder = order === "ASC" ? 1 : -1;
    const sortObject: any = {};

    // Validate sort field
    const allowedSortFields = [
      "createdAt",
      "validUntil",
      "clientId",
      "createdBy",
    ];
    const sortField = allowedSortFields.includes(sort) ? sort : "createdAt";
    sortObject[sortField] = sortOrder;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count
    const total = await this.quotationModel.countDocuments(queryFilter).exec();

    // Get paginated quotations with populated references
    const quotations = await this.quotationModel
      .find(queryFilter)
      .populate("templateId", "name serviceType category")
      .populate("clientId", "name email phone status validUntil")
      .populate("companyId", "name")
      .populate("shippingLineId", "name")
      .populate("agentId", "firstName lastName email")
      .populate(
        "portOfOrigin",
        "name unlocode countryCode countryName city type"
      )
      .populate(
        "portOfDestination",
        "name unlocode countryCode countryName city type"
      )
      .populate("createdBy", "firstName lastName email")
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .exec();

    // Format response using serializer
    const items = quotations.map((quotation: any) =>
      QuotationSerializer.toListResponse(quotation)
    );

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async findOne(quotationId: string, userId: string) {
    const user = await this.userModel.findById(userId).select("company").exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }

    let quotationObjectId: Types.ObjectId;
    try {
      quotationObjectId = new Types.ObjectId(quotationId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid quotation ID format: "${quotationId}"`
      );
    }

    const quotation = await this.quotationModel
      .findById(quotationObjectId)
      .populate(
        "templateId",
        "name serviceType category headerFields items equipmentItems pricingConfig notes showAgentToClient showCarrierToClient showCommodityToClient showNotesToClient"
      )
      .populate("clientId", "name email phone status")
      .populate("companyId", "name email phone address taxId")
      .populate("shippingLineId", "name code shippingModes")
      .populate("agentId", "firstName lastName email")
      .populate(
        "portOfOrigin",
        "name unlocode countryCode countryName city type"
      )
      .populate(
        "portOfDestination",
        "name unlocode countryCode countryName city type"
      )
      .populate("createdBy", "firstName lastName email")
      .exec();

    if (!quotation) {
      throw new NotFoundException(
        `Quotation with id "${quotationId}" not found.`
      );
    }

    if (user.company.toString() !== quotation.companyId._id.toString()) {
      throw new ForbiddenException(
        "You can only view quotations from your own company."
      );
    }

    return QuotationSerializer.toResponse(quotation);
  }

  async update(
    quotationId: string,
    updateQuotationDto: UpdateQuotationDto,
    userId: string,
    userEmail: string
  ) {
    // Get authenticated user to verify company access
    const user = await this.userModel.findById(userId).select("company").exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Find quotation
    const quotation = await this.quotationModel.findById(quotationId).exec();

    if (!quotation) {
      throw new NotFoundException(
        `Quotation with id "${quotationId}" not found.`
      );
    }

    // Verify user belongs to the same company as the quotation
    if (user.company.toString() !== quotation.companyId.toString()) {
      throw new ForbiddenException(
        "You can only update quotations from your own company."
      );
    }

    // Capture previous status before type narrowing
    const previousStatus:
      | "draft"
      | "sent"
      | "accepted"
      | "rejected"
      | "expired" = quotation.status;

    // Allow updates for draft and sent quotations
    // Only block updates for accepted, rejected, or expired quotations
    if (!["draft", "sent", "rejected"].includes(quotation.status)) {
      throw new BadRequestException(
        `Cannot update quotation. Only quotations in draft or sent status can be updated. Current status: "${quotation.status}".`
      );
    }

    const before = quotation.toObject();

    // Build update object
    const updateData: any = {};

    // Update base quotation fields (serviceType / incoterm / shippingMode)
    if (updateQuotationDto.serviceType !== undefined) {
      updateData.serviceType = updateQuotationDto.serviceType;
    }

    if (updateQuotationDto.incoterm !== undefined) {
      updateData.incoterm = updateQuotationDto.incoterm;
    }

    if (updateQuotationDto.shippingMode !== undefined) {
      updateData.shippingMode = updateQuotationDto.shippingMode;
    }

    // Validate and update clientId if provided
    if (updateQuotationDto.clientId !== undefined) {
      let clientObjectId: Types.ObjectId;
      try {
        clientObjectId = new Types.ObjectId(updateQuotationDto.clientId);
      } catch (error) {
        throw new BadRequestException(
          `Invalid clientId format: "${updateQuotationDto.clientId}".`
        );
      }

      // Validate client exists, is active, and belongs to user's company (via office)
      const client = await this.clientModel.findById(clientObjectId).exec();
      if (!client) {
        throw new NotFoundException(
          `Client with id "${updateQuotationDto.clientId}" not found.`
        );
      }
      if (!client.isActive) {
        throw new BadRequestException(
          `Client with id "${updateQuotationDto.clientId}" is not active.`
        );
      }

      // Validate client belongs to user's company (via office)
      const clientOffice = await this.officeModel
        .findById(client.office)
        .select("company")
        .exec();
      if (!clientOffice) {
        throw new NotFoundException(
          `Office for client "${updateQuotationDto.clientId}" not found.`
        );
      }
      if (clientOffice.company.toString() !== user.company.toString()) {
        throw new ForbiddenException(
          `Client with id "${updateQuotationDto.clientId}" does not belong to your company.`
        );
      }

      updateData.clientId = clientObjectId;
    }

    // Validate and update companyId if provided
    if (updateQuotationDto.companyId !== undefined) {
      let companyObjectId: Types.ObjectId;
      try {
        companyObjectId = new Types.ObjectId(updateQuotationDto.companyId);
      } catch (error) {
        throw new BadRequestException(
          `Invalid companyId format: "${updateQuotationDto.companyId}".`
        );
      }

      // Validate that companyId matches the authenticated user's companyId
      if (user.company.toString() !== companyObjectId.toString()) {
        throw new ForbiddenException(
          "You can only update quotations for your own company."
        );
      }

      // Validate company exists
      const company = await this.companyModel.findById(companyObjectId).exec();
      if (!company) {
        throw new NotFoundException(
          `Company with id "${updateQuotationDto.companyId}" not found.`
        );
      }

      updateData.companyId = companyObjectId;
    }

    // Validate and update shippingLineId if provided
    if (updateQuotationDto.shippingLineId !== undefined) {
      let shippingLineObjectId: Types.ObjectId;
      try {
        shippingLineObjectId = new Types.ObjectId(
          updateQuotationDto.shippingLineId
        );
      } catch (error) {
        throw new BadRequestException(
          `Invalid shippingLineId format: "${updateQuotationDto.shippingLineId}".`
        );
      }

      // Validate shipping line exists and is active
      const shippingLine = await this.shippingModel
        .findById(shippingLineObjectId)
        .exec();
      if (!shippingLine) {
        throw new NotFoundException(
          `Shipping line with id "${updateQuotationDto.shippingLineId}" not found.`
        );
      }
      if (!shippingLine.isActive) {
        throw new BadRequestException(
          `Shipping line with id "${updateQuotationDto.shippingLineId}" is not active.`
        );
      }

      updateData.shippingLineId = shippingLineObjectId;
    }

    // Validate and update agentId if provided
    if (updateQuotationDto.agentId !== undefined) {
      if (updateQuotationDto.agentId) {
        let agentObjectId: Types.ObjectId;
        try {
          agentObjectId = new Types.ObjectId(updateQuotationDto.agentId);
        } catch (error) {
          throw new BadRequestException(
            `Invalid agentId format: "${updateQuotationDto.agentId}".`
          );
        }

        // Validate agent exists and is active
        const agent = await this.agentModel.findById(agentObjectId).exec();
        if (!agent) {
          throw new NotFoundException(
            `Agent with id "${updateQuotationDto.agentId}" not found.`
          );
        }
        if (!agent.isActive) {
          throw new BadRequestException(
            `Agent with id "${updateQuotationDto.agentId}" is not active.`
          );
        }

        updateData.agentId = agentObjectId;
      } else {
        // Allow clearing agentId by setting to null
        updateData.agentId = null;
      }
    }

    // Handle port updates
    if (updateQuotationDto.originPortId !== undefined) {
      if (updateQuotationDto.originPortId) {
        const portOfOriginObjectId = await this.ensurePortExists(
          updateQuotationDto.originPortId,
          quotation.companyId
        );
        updateData.portOfOrigin = portOfOriginObjectId;
      } else {
        updateData.portOfOrigin = null;
      }
    }

    if (updateQuotationDto.destinationPortId !== undefined) {
      if (updateQuotationDto.destinationPortId) {
        const portOfDestinationObjectId = await this.ensurePortExists(
          updateQuotationDto.destinationPortId,
          quotation.companyId
        );
        updateData.portOfDestination = portOfDestinationObjectId;
      } else {
        updateData.portOfDestination = null;
      }
    }

    // Handle template-based items update
    if (updateQuotationDto.items !== undefined) {
      // Allow empty items array for template-based quotations
      const isTemplateBased = Boolean(quotation.templateId);

      if (isTemplateBased) {
        updateData.items = updateQuotationDto.items.map((item, index) => {
          if (!item.itemId) {
            throw new BadRequestException(
              `Item at index ${index}: itemId is required.`
            );
          }

          if (
            item.price !== null &&
            item.price !== undefined &&
            typeof item.price !== "number"
          ) {
            throw new BadRequestException(
              `Item at index ${index}: price must be a number or null.`
            );
          }

          if (
            item.quantity !== null &&
            item.quantity !== undefined &&
            typeof item.quantity !== "number"
          ) {
            throw new BadRequestException(
              `Item at index ${index}: quantity must be a number or null.`
            );
          }

          if (
            item.discount !== null &&
            item.discount !== undefined &&
            typeof item.discount !== "number"
          ) {
            throw new BadRequestException(
              `Item at index ${index}: discount must be a number or null.`
            );
          }

          const mappedItem = {
            itemId: item.itemId,
            description: item.description,
            price: item.price ?? null,
            quantity: item.quantity ?? null,
            discount: item.discount ?? null,
            notes: item.notes,
            applyTemplateDiscount: item.applyTemplateDiscount ?? true, // Default to opt-in to match calculation logic
            applyTaxes: item.applyTaxes ?? false,
            // Preserve taxRate exactly as provided - don't modify it
            taxRate:
              item.taxRate !== undefined && item.taxRate !== null
                ? item.taxRate
                : null,
          };
          return mappedItem;
        });
      }
    }

    // Handle equipment items update (for template-based quotations)
    if (updateQuotationDto.equipmentItems !== undefined) {
      const isTemplateBased = Boolean(quotation.templateId);

      if (isTemplateBased) {
        const equipmentItems = updateQuotationDto.equipmentItems;

        // Allow empty array for equipment items (they're optional)
        updateData.equipmentItems = equipmentItems.map(
          (item: any, index: number) => {
            if (!item.equipmentItemId) {
              throw new BadRequestException(
                `Equipment item at index ${index}: equipmentItemId is required.`
              );
            }

            if (
              item.price !== null &&
              item.price !== undefined &&
              typeof item.price !== "number"
            ) {
              throw new BadRequestException(
                `Equipment item at index ${index}: price must be a number or null.`
              );
            }

            if (
              item.quantity !== null &&
              item.quantity !== undefined &&
              typeof item.quantity !== "number"
            ) {
              throw new BadRequestException(
                `Equipment item at index ${index}: quantity must be a number or null.`
              );
            }

            if (
              item.discount !== null &&
              item.discount !== undefined &&
              typeof item.discount !== "number"
            ) {
              throw new BadRequestException(
                `Equipment item at index ${index}: discount must be a number or null.`
              );
            }

            const mappedEqItem = {
              equipmentItemId: item.equipmentItemId,
              label: item.label,
              fieldValues: item.fieldValues || [],
              price: item.price ?? null,
              quantity: item.quantity ?? null,
              discount: item.discount ?? null,
              applyTemplateDiscount: item.applyTemplateDiscount ?? true, // Default to opt-in to match calculation logic
              applyTaxes: item.applyTaxes ?? false,
              // Preserve taxRate exactly as provided - don't modify it
              taxRate:
                item.taxRate !== undefined && item.taxRate !== null
                  ? item.taxRate
                  : null,
              notes: item.notes,
            };
            return mappedEqItem;
          }
        );
      }
    }

    // Handle legacyItems update (for non-template quotations)
    if (updateQuotationDto.legacyItems !== undefined) {
      if (!quotation.templateId) {
        // Only allow legacyItems update for non-template quotations
        const legacyItems = updateQuotationDto.legacyItems;

        if (legacyItems.length === 0) {
          throw new BadRequestException(
            "It is not allowed to update quotations without items."
          );
        }

        // Validate legacy items
        for (const item of legacyItems) {
          if (!item.type || !["cargo", "custom"].includes(item.type)) {
            throw new BadRequestException(
              "Item type must be 'cargo' or 'custom'."
            );
          }
          if (!item.description || item.description.trim() === "") {
            throw new BadRequestException("Item description is required.");
          }
          if (
            item.price === undefined ||
            item.price === null ||
            item.price < 0
          ) {
            throw new BadRequestException(
              "Item price must be greater than or equal to 0."
            );
          }
          // if (item.type === "cargo") {
          //   if (
          //     !item.transitType ||
          //     !["air", "land", "maritime"].includes(item.transitType)
          //   ) {
          //     throw new BadRequestException(
          //       "transitType is required for cargo items and must be 'air', 'land', or 'maritime'."
          //     );
          //   }
          // }
        }

        // Process legacy items
        updateData.legacyItems = legacyItems.map((item) => ({
          type: item.type,
          description: item.description,
          price: item.price,
          quantity: item.quantity ?? 1,

          discount: item.discount ?? 0,
          applyDiscount: item.applyDiscount ?? true,
          applyTaxes: item.applyTaxes ?? false,
          taxRate: item.taxRate ?? 0,

          notes: item.notes,
          transitType: item.type === "cargo" ? item.transitType : undefined,
        }));

        // Recalculate total for legacy quotations if summarize is true
        const finalSummarize =
          updateQuotationDto.summarize !== undefined
            ? updateQuotationDto.summarize
            : quotation.summarize;

        if (finalSummarize) {
          // Normalize legacy items and use single source of truth
          const normalizedLegacyItems = legacyItems.map((item) => ({
            price: item.price ?? 0,
            quantity: item.quantity ?? 1,
            discount: item.applyDiscount ? (item.discount ?? 0) : 0,
            applyTaxes: item.applyTaxes ?? false,
            taxRate: item.taxRate ?? 0,
            applyDiscount: item.applyDiscount ?? true,
          }));

          updateData.total = await this.calculateQuotationTotal(
            [],
            [],
            quotation.pricingConfig,
            normalizedLegacyItems
          );
        } else {
          // If summarize is false, clear total to avoid stale values
          updateData.total = undefined;
        }
      }
    }

    // Update notes if provided
    if (updateQuotationDto.notes !== undefined) {
      updateData.notes = updateQuotationDto.notes;
    }

    // Update validUntil if provided
    if (updateQuotationDto.validUntil !== undefined) {
      const validUntil =
        updateQuotationDto.validUntil instanceof Date
          ? updateQuotationDto.validUntil
          : new Date(updateQuotationDto.validUntil);

      if (isNaN(validUntil.getTime())) {
        throw new BadRequestException("validUntil must be a valid date.");
      }

      updateData.validUntil = validUntil;
    }

    // Update summarize if provided
    if (updateQuotationDto.summarize !== undefined) {
      updateData.summarize = updateQuotationDto.summarize;
    }

    // Calculate total if summarize is true (either newly set or already true) for template-based quotations
    // Also recalculate if items or equipmentItems were updated (to ensure total stays accurate)
    if (quotation.templateId) {
      const finalSummarize =
        updateQuotationDto.summarize !== undefined
          ? updateQuotationDto.summarize
          : quotation.summarize;

      // Check if items or equipmentItems were updated
      const itemsWereUpdated = updateQuotationDto.items !== undefined;
      const equipmentItemsWereUpdated =
        updateQuotationDto.equipmentItems !== undefined;
      const pricingConfigWasUpdated =
        updateQuotationDto.pricingConfig !== undefined;

      // Get items - ensure they're plain objects with all fields accessible
      const finalItems = itemsWereUpdated
        ? updateData.items
        : (quotation.items || []).map((item: any) => ({
          price: item.price ?? null,
          quantity: item.quantity ?? null,
          discount: item.discount ?? null,
          applyTemplateDiscount: item.applyTemplateDiscount,
          applyTaxes: item.applyTaxes,
          taxRate: item.taxRate ?? null,
        }));

      // Get equipment items - ensure they're plain objects with all fields accessible
      const finalEquipmentItems = equipmentItemsWereUpdated
        ? updateData.equipmentItems
        : (quotation.equipmentItems || []).map((eqItem: any) => ({
          price: eqItem.price ?? null,
          quantity: eqItem.quantity ?? null,
          discount: eqItem.discount ?? null,
          applyTemplateDiscount: eqItem.applyTemplateDiscount,
          applyTaxes: eqItem.applyTaxes,
          taxRate: eqItem.taxRate ?? null,
        }));

      const finalPricingConfig = pricingConfigWasUpdated
        ? updateData.pricingConfig
        : quotation.pricingConfig;

      // Recalculate total if:
      // 1. summarize is true (either newly set or already true), OR
      // 2. items/equipmentItems/pricingConfig were updated (to keep total accurate)
      if (
        finalSummarize ||
        itemsWereUpdated ||
        equipmentItemsWereUpdated ||
        pricingConfigWasUpdated
      ) {
        if (finalSummarize) {
          // Use proper calculation that includes quantities, discounts, and taxes
          // This includes both regular items AND equipment items
          const total = await this.calculateQuotationTotal(
            finalItems || [],
            finalEquipmentItems || [],
            finalPricingConfig
          );
          updateData.total = total;
        } else {
          // If summarize is false (either explicitly set or already false), clear total
          // This ensures stale totals are cleared when items change but summarize is false
          updateData.total = undefined;
        }
      }
    }

    // Update status if provided
    if (updateQuotationDto.status !== undefined) {
      updateData.status = updateQuotationDto.status;

      // If status is changing to "sent" and summarize is true, ensure total is recalculated
      // This ensures template discounts are included even if total wasn't recalculated earlier
      if (updateQuotationDto.status === "sent" && quotation.summarize) {
        if (quotation.templateId) {
          // Template-based quotation: use calculateQuotationTotal
          // Use existing quotation items/equipmentItems/pricingConfig (not updated ones)
          const itemsForRecalc = (quotation.items || []).map((item: any) => ({
            price: item.price ?? null,
            quantity: item.quantity ?? null,
            discount: item.discount ?? null,
            applyTemplateDiscount: item.applyTemplateDiscount,
            applyTaxes: item.applyTaxes,
            taxRate: item.taxRate ?? null,
          }));

          const equipmentItemsForRecalc = (quotation.equipmentItems || []).map(
            (eqItem: any) => ({
              price: eqItem.price ?? null,
              quantity: eqItem.quantity ?? null,
              discount: eqItem.discount ?? null,
              applyTemplateDiscount: eqItem.applyTemplateDiscount,
              applyTaxes: eqItem.applyTaxes,
              taxRate: eqItem.taxRate ?? null,
            })
          );

          const pricingConfigForRecalc = quotation.pricingConfig;

          // Recalculate total to ensure it includes template discounts
          const recalculatedTotal = await this.calculateQuotationTotal(
            itemsForRecalc,
            equipmentItemsForRecalc,
            pricingConfigForRecalc
          );
          updateData.total = recalculatedTotal;
        } else {
          // Legacy quotation: normalize and recalculate
          const normalizedLegacyItems = (quotation.legacyItems || []).map(
            (item) => ({
              price: item.price ?? 0,
              quantity: item.quantity ?? 1,
              discount: item.applyDiscount === false ? 0 : (item.discount ?? 0),
              applyTaxes: item.applyTaxes ?? false,
              taxRate: item.taxRate ?? 0,
              applyDiscount: item.applyDiscount ?? true,
            })
          );
          const recalculatedTotal = await this.calculateQuotationTotal(
            [],
            [],
            quotation.pricingConfig,
            normalizedLegacyItems
          );
          updateData.total = recalculatedTotal;
        }
      }
    }

    // Update pricingConfig if provided
    if (updateQuotationDto.pricingConfig !== undefined) {
      updateData.pricingConfig = updateQuotationDto.pricingConfig;
    }

    // Update headerFieldValues if provided
    if (updateQuotationDto.headerFieldValues !== undefined) {
      updateData.headerFieldValues = updateQuotationDto.headerFieldValues;
    }

    // Update visibility settings if provided
    if ((updateQuotationDto as any).showAgentToClient !== undefined) {
      updateData.showAgentToClient = (
        updateQuotationDto as any
      ).showAgentToClient;
    }
    if ((updateQuotationDto as any).showCarrierToClient !== undefined) {
      updateData.showCarrierToClient = (
        updateQuotationDto as any
      ).showCarrierToClient;
    }
    if ((updateQuotationDto as any).showCommodityToClient !== undefined) {
      updateData.showCommodityToClient = (
        updateQuotationDto as any
      ).showCommodityToClient;
    }
    if ((updateQuotationDto as any).showNotesToClient !== undefined) {
      updateData.showNotesToClient = (
        updateQuotationDto as any
      ).showNotesToClient;
    }

    // Update quotation
    const updated = (await this.quotationModel
      .findByIdAndUpdate(quotationId, { $set: updateData }, { new: true })
      .populate("templateId", "name serviceType category")
      .populate("clientId")
      .populate("companyId")
      .populate("shippingLineId")
      .populate("agentId")
      .populate(
        "portOfOrigin",
        "name unlocode countryCode countryName city type"
      )
      .populate(
        "portOfDestination",
        "name unlocode countryCode countryName city type"
      )
      .populate("createdBy", "firstName lastName email")
      .exec()) as any;

    if (!updated) {
      throw new NotFoundException(
        `Quotation with id "${quotationId}" not found after update.`
      );
    }

    // Log history
    const diff: Record<string, { from: any; to: any }> = {};
    for (const key of Object.keys(updateData)) {
      if (key !== "total" && before[key] !== (updated as any)[key]) {
        diff[key] = { from: before[key], to: (updated as any)[key] };
      }
    }

    await this.historyService.log({
      action: "update",
      entityType: "quotation",
      entityId: quotationId,
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Quotation updated`,
      before,
      after: updated,
      diff,
    });

    // QuotationDelivery and client email are triggered by POST /pricing/send-to-clients with quotationId (not here).
    const finalStatus = updateData.status || previousStatus;

    // Send notifications to office users if status changed to "accepted"
    if (finalStatus === "accepted" && previousStatus !== "accepted") {
      try {
        // Fetch the quotation again with all fields including items to ensure we have complete data
        // Note: Using findById without select to get all fields, then we'll use what we need
        const quotationWithItems = (await this.quotationModel
          .findById(updated._id)
          .lean()
          .exec()) as any;

        if (!quotationWithItems) {
          return QuotationSerializer.toResponse(updated);
        }

        // Get the client and their office
        const client = await this.clientModel
          .findById(updated.clientId)
          .populate("office", "name")
          .lean()
          .exec();

        if (client && (client as any).office) {
          // Handle both populated and non-populated office
          const office = (client as any).office;
          const officeId = office._id
            ? office._id.toString()
            : office.toString();
          const officeName = office.name || "the office";

          // Find all active users in this office
          const officeUsers = await this.userModel
            .find({
              offices: new Types.ObjectId(officeId),
              isActive: true,
            })
            .select("email firstName lastName")
            .lean()
            .exec();

          if (officeUsers && officeUsers.length > 0) {
            // Get estimate details for the notification
            const company = await this.companyModel
              .findById(updated.companyId)
              .lean()
              .exec();

            const clientName = (client as any).name;
            const quotationId = updated._id.toString();
            const quotationDate = quotationWithItems.createdAt
              ? new Date(quotationWithItems.createdAt).toLocaleDateString(
                "en-US",
                {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }
              )
              : new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });

            // Use unified pricing breakdown - single source of truth (calculate early)
            const breakdown =
              await this.getPricingBreakdown(quotationWithItems);

            // Format quotation total from unified pricing breakdown
            const formattedTotal = breakdown.totals.total
              ? breakdown.totals.total
                .toFixed(2)
                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              : "N/A";

            const pricingConfig = quotationWithItems.pricingConfig;

            // Verify total calculation includes template discount
            if (
              quotationWithItems.summarize &&
              quotationWithItems.items &&
              pricingConfig
            ) {
              const itemsForCalc = (quotationWithItems.items || []).map(
                (item: any) => ({
                  price: item.price ?? null,
                  quantity: item.quantity ?? null,
                  discount: item.discount ?? null,
                  applyTemplateDiscount: item.applyTemplateDiscount,
                  applyTaxes: item.applyTaxes,
                  taxRate: item.taxRate ?? null,
                })
              );

              const equipmentItemsForCalc = (
                quotationWithItems.equipmentItems || []
              ).map((eqItem: any) => ({
                price: eqItem.price ?? null,
                quantity: eqItem.quantity ?? null,
                discount: eqItem.discount ?? null,
                applyTemplateDiscount: eqItem.applyTemplateDiscount,
                applyTaxes: eqItem.applyTaxes,
                taxRate: eqItem.taxRate ?? null,
              }));

              await this.calculateQuotationTotal(
                itemsForCalc,
                equipmentItemsForCalc,
                pricingConfig
              );
            }

            // Format items for notification using unified pricing breakdown
            const formatPrice = (price: number | null | undefined): string => {
              if (price === null || price === undefined) return "N/A";
              return `$${price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
            };

            // Build HTML from unified pricing breakdown - single source of truth
            // (breakdown already calculated above)
            let itemsHtml = "";

            if (breakdown.lineItems.length > 0) {
              // Group items by type for display
              const legacyItems = breakdown.lineItems.filter(
                (item) => item.type === "legacy"
              );
              const templateItems = breakdown.lineItems.filter(
                (item) => item.type === "item"
              );
              const equipmentItems = breakdown.lineItems.filter(
                (item) => item.type === "equipment"
              );

              // Legacy items table
              if (legacyItems.length > 0) {
                const legacyRows = legacyItems
                  .map(
                    (item) => `
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
                    <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${formatPrice(item.lineTotal)}</td>
                    </tr>
                `
                  )
                  .join("");

                itemsHtml += `
                <h3 style="margin-top: 20px; margin-bottom: 10px;">Items:</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <thead>
                    <tr style="background-color: #f5f5f5;">
                      <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Description</th>
                      <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${legacyRows}
                  </tbody>
                </table>
              `;
              }

              // Template items table
              if (templateItems.length > 0) {
                const itemsRows = templateItems
                  .map((item) => {
                    return `
                      <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">
                        ${item.description}
                          ${item.notes ? `<br><small style="color: #666;">${item.notes}</small>` : ""}
                        </td>
                      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${item.quantity}</td>
                      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${formatPrice(item.lineTotal)}</td>
                      </tr>
                    `;
                  })
                  .join("");

                itemsHtml += `
                <h3 style="margin-top: 20px; margin-bottom: 10px;">Items:</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <thead>
                    <tr style="background-color: #f5f5f5;">
                      <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Description</th>
                      <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Quantity</th>
                      <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsRows}
                  </tbody>
                </table>
              `;
              }

              // Equipment items table
              if (equipmentItems.length > 0) {
                const equipmentRows = equipmentItems
                  .map((item) => {
                    return `
                      <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">
                        ${item.description}
                          ${item.notes ? `<br><small style="color: #666;">${item.notes}</small>` : ""}
                        </td>
                      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${item.quantity}</td>
                      <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${formatPrice(item.lineTotal)}</td>
                      </tr>
                    `;
                  })
                  .join("");

                itemsHtml += `
                <h3 style="margin-top: 20px; margin-bottom: 10px;">Equipment Items:</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <thead>
                    <tr style="background-color: #f5f5f5;">
                      <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Description</th>
                      <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Quantity</th>
                      <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${equipmentRows}
                  </tbody>
                </table>
              `;
              }
            }

            // Build pricing information section (template discount, template price, etc.)
            let pricingInfoHtml = "";
            if (pricingConfig) {
              const pricingDetails: string[] = [];

              if (
                pricingConfig.templatePrice !== null &&
                pricingConfig.templatePrice !== undefined &&
                pricingConfig.templatePrice > 0
              ) {
                pricingDetails.push(
                  `<li><strong>Template Price:</strong> $${pricingConfig.templatePrice.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</li>`
                );
              }

              if (
                pricingConfig.applyTemplateDiscount &&
                pricingConfig.templateDiscount !== null &&
                pricingConfig.templateDiscount !== undefined &&
                pricingConfig.templateDiscount > 0
              ) {
                pricingDetails.push(
                  `<li><strong>Template Discount:</strong> ${pricingConfig.templateDiscount}%</li>`
                );
              }

              if (
                pricingConfig.applyTemplateTaxes &&
                pricingConfig.templateTaxRate !== null &&
                pricingConfig.templateTaxRate !== undefined &&
                pricingConfig.templateTaxRate > 0
              ) {
                pricingDetails.push(
                  `<li><strong>Template Tax Rate:</strong> ${pricingConfig.templateTaxRate}%</li>`
                );
              }

              if (pricingDetails.length > 0) {
                pricingInfoHtml = `
                  <h3 style="margin-top: 20px; margin-bottom: 10px;">Pricing Information:</h3>
                  <ul style="list-style: none; padding: 0;">
                    ${pricingDetails.join("")}
                  </ul>
                `;
              }
            }

            // Send notification to each user in the office
            const notificationPromises = officeUsers.map((user: any) => {
              const message = `
                <p><strong>Estimate Accepted</strong></p>
                <p>An estimate has been accepted by client <strong>${clientName}</strong>.</p>
                <ul style="list-style: none; padding: 0;">
                  <li><strong>Estimate ID:</strong> ${quotationId}</li>
                  <li><strong>Client:</strong> ${clientName}</li>
                  <li><strong>Office:</strong> ${officeName}</li>
                  <li><strong>Estimate Date:</strong> ${quotationDate}</li>
                  ${quotationWithItems.total ? `<li><strong>Total:</strong> $${formattedTotal}</li>` : ""}
                </ul>
                ${itemsHtml || "<p><em>No items found in this estimate.</em></p>"}
                ${pricingInfoHtml}
                <p>Please review the estimate details in the system.</p>
              `;

              return this.mailService.sendNotificationEmail(
                user.email,
                `Estimate Accepted - ${clientName}`,
                message
              );
            });

            await Promise.all(notificationPromises);
          }
        }
      } catch (error) {
        this.logger.error("Failed to send acceptance notifications", error);
      }
    }

    // Return the updated quotation using serializer
    return QuotationSerializer.toResponse(updated);
  }

  async remove(quotationId: string, userId: string, userEmail: string) {
    // Get authenticated user to verify company access
    const user = await this.userModel.findById(userId).select("company").exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Find quotation
    const quotation = await this.quotationModel.findById(quotationId).exec();

    if (!quotation) {
      throw new NotFoundException(
        `Quotation with id "${quotationId}" not found.`
      );
    }

    // Verify user belongs to the same company as the quotation
    if (user.company.toString() !== quotation.companyId.toString()) {
      throw new ForbiddenException(
        "You can only delete quotations from your own company."
      );
    }

    // Check if quotation is in draft status
    if (quotation.status !== "draft") {
      throw new BadRequestException(
        `Cannot delete quotation. Only quotations in draft status can be deleted. Current status: "${quotation.status}" .`
      );
    }

    // Delete quotation
    await this.quotationModel
      .findByIdAndUpdate(quotationId, { isActive: false }, { new: true })
      .exec();

    // Log history
    await this.historyService.log({
      action: "delete",
      entityType: "quotation",
      entityId: quotationId,
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Quotation deleted.`,
      before: quotation,
    });
  }

  async getShippingLinesHelper(userId: string) {
    // Get all active shipping lines
    const shippingLines = await this.shippingModel
      .find({ isActive: true })
      .select("_id name")
      .lean()
      .exec();

    return shippingLines.map((sl) => ({
      _id: sl._id.toString(),
      name: sl.name,
    }));
  }

  async getAgentsHelper() {
    const shippings = await this.shippingModel
      .find({ isActive: true })
      .select("_id name agents")
      .lean()
      .exec();

    const agentToShippings = new Map<string, { _id: string; name: string }[]>();
    const agentIdsSet = new Set<string>();

    for (const s of shippings) {
      for (const aId of s.agents ?? []) {
        const aid = aId.toString();
        agentIdsSet.add(aid);

        const list = agentToShippings.get(aid) ?? [];
        if (!list.some(x => x._id === s._id.toString())) {
          list.push({ _id: s._id.toString(), name: s.name });
        }
        agentToShippings.set(aid, list);
      }
    }

    const agentIds = [...agentIdsSet];

    const agents = await this.agentModel
      .find({ _id: { $in: agentIds }, isActive: true })
      .select("_id firstName lastName")
      .lean()
      .exec();

    return agents.map(a => ({
      _id: a._id.toString(),
      name: `${a.firstName} ${a.lastName}`,
      shippingLines: agentToShippings.get(a._id.toString()) ?? [],
    }));
  }

  async getCompanyHelper(userId: string) {
    // Get authenticated user's company
    const user = await this.userModel
      .findById(userId)
      .select("company")
      .populate("company")
      .exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.company || typeof user.company === "string") {
      // If company is not populated, fetch it
      const company = await this.companyModel
        .findById(user.company)
        .lean()
        .exec();

      if (!company) {
        throw new NotFoundException("Company not found");
      }

      const companyObj = company as any;
      return {
        _id: companyObj._id.toString(),
        name: companyObj.name,
        description: companyObj.description,
        taxId: companyObj.taxId,
        email: companyObj.email,
        phone: companyObj.phone,
        address: companyObj.address,
        isActive: companyObj.isActive,
        createdAt: companyObj.createdAt,
        updatedAt: companyObj.updatedAt,
      };
    }

    // Company is populated
    const company = user.company as any;
    const companyObj = company.toObject ? company.toObject() : company;
    return {
      _id: companyObj._id.toString(),
      name: companyObj.name,
      description: companyObj.description,
      taxId: companyObj.taxId,
      email: companyObj.email,
      phone: companyObj.phone,
      address: companyObj.address,
      isActive: companyObj.isActive,
      createdAt: companyObj.createdAt,
      updatedAt: companyObj.updatedAt,
    };
  }

  async getClientsHelper(userId: string) {
    // Get user's offices to filter clients
    const user = await this.userModel
      .findById(userId)
      .select("offices")
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const officeIds: Types.ObjectId[] = (user.offices ?? [])
      .filter(Boolean)
      .map((id) => new Types.ObjectId(id.toString()));

    // Get clients from user's offices
    const clients = await this.clientModel
      .find({
        office: { $in: officeIds },
        isActive: true,
      })
      .select("_id name")
      .lean()
      .exec();

    return clients.map((client) => ({
      _id: client._id.toString(),
      clientName: client.name,
    }));
  }

  async generatePDF(quotationId: string, userId: string): Promise<Buffer> {
    // Validate quotation ID format
    let quotationObjectId: Types.ObjectId;
    try {
      quotationObjectId = new Types.ObjectId(quotationId);
    } catch (error) {
      throw new BadRequestException(
        `Invalid quotation ID format: "${quotationId}"`
      );
    }

    // Return stored PDF from the most recent delivery if available
    const storedDelivery = await this.quotationDeliveryModel
      .findOne({ quotationId: quotationObjectId, pdfData: { $exists: true, $ne: null } })
      .sort({ sentAt: -1 })
      .select("pdfData")
      .lean()
      .exec();
    if (storedDelivery && (storedDelivery as any).pdfData) {
      const raw = (storedDelivery as any).pdfData;
      return Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer ?? raw);
    }

    // Get quotation with all populated fields
    const quotation = (await this.quotationModel
      .findById(quotationObjectId)
      .populate("clientId", "name email phone address")
      .populate("companyId", "name email phone address taxId")
      .populate("shippingLineId", "name code")
      .populate("agentId", "firstName lastName email")
      .populate("portOfOrigin", "name unlocode countryName")
      .populate("portOfDestination", "name unlocode countryName")
      .populate("createdBy", "firstName lastName email")
      .exec()) as any;

    if (!quotation) {
      throw new NotFoundException(
        `Quotation with id "${quotationId}" not found.`
      );
    }

    // Verify user has access to this quotation
    const user = await this.userModel.findById(userId).select("company").exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (
      user.company.toString() !== (quotation.companyId as any)._id.toString()
    ) {
      throw new ForbiddenException(
        "You can only download PDFs for quotations from your own company."
      );
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => { });

    // Helper function to format currency
    const formatCurrency = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined) return "N/A";
      return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    };

    // Helper function to format date
    const formatDate = (date: Date | string): string => {
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    // Single page-break helper - use everywhere to prevent blank pages
    const ensureSpace = (needed: number): void => {
      const bottomPadding = 50; // bottom margin
      const pageBottom = doc.page.height - bottomPadding;
      if (doc.y + needed > pageBottom) {
        doc.addPage();
        doc.y = 50; // top margin
      }
    };

    doc.fontSize(24).font("Helvetica-Bold").text("ShipSync", 50, 50);
    doc.fontSize(12).font("Helvetica").text("Estimate", 50, 80);

    // Set initial cursor position - reduced gap between Estimate and Estimate Details
    doc.y = 105;

    // Quotation details section
    const company = quotation.companyId as any;
    const client = quotation.clientId as any;

    ensureSpace(150); // enough for two rows of side-by-side blocks
    const leftColumnX = 50;
    const rightColumnX = 300;
    const row1StartY = doc.y;
    let row1LeftY = row1StartY;
    let row1RightY = row1StartY;

    // Row 1: Estimate Details (left only, no shipping details)
    // Left column: Estimate Details
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Estimate Details", leftColumnX, row1LeftY);
    row1LeftY += 14;

    doc.fontSize(10).font("Helvetica");
    doc.text(
      `Estimate ID: ${quotation._id.toString()}`,
      leftColumnX,
      row1LeftY
    );
    row1LeftY += 13;
    doc.text(
      `Date: ${formatDate(quotation.createdAt)}`,
      leftColumnX,
      row1LeftY
    );
    row1LeftY += 13;
    if (quotation.validUntil) {
      doc.text(
        `Valid Until: ${formatDate(quotation.validUntil)}`,
        leftColumnX,
        row1LeftY
      );
      row1LeftY += 13;
    }
    if (quotation.status) {
      doc.text(
        `Status: ${quotation.status.toUpperCase()}`,
        leftColumnX,
        row1LeftY
      );
      row1LeftY += 13;
    }

    // Row 2: From (left) and To (right)
    const row2StartY = row1LeftY + 15;
    let row2LeftY = row2StartY;
    let row2RightY = row2StartY;

    // Left column: From
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("From:", leftColumnX, row2LeftY);
    row2LeftY += 14;
    doc.fontSize(10).font("Helvetica");
    doc.text(company.name || "N/A", leftColumnX, row2LeftY);
    row2LeftY += 13;
    if (company.email) {
      doc.text(`Email: ${company.email}`, leftColumnX, row2LeftY);
      row2LeftY += 13;
    }
    if (company.phone) {
      doc.text(`Phone: ${company.phone}`, leftColumnX, row2LeftY);
      row2LeftY += 13;
    }
    if (company.address) {
      const addr = company.address;
      const addrParts = [
        addr.street,
        addr.city,
        addr.state,
        addr.zipCode,
        addr.country,
      ].filter(Boolean);
      const addressText = `Address: ${addrParts.join(", ")}`;
      const addressHeight = doc.heightOfString(addressText, { width: 240 });
      doc.text(addressText, leftColumnX, row2LeftY, { width: 240 });
      row2LeftY += Math.max(13, addressHeight);
    }
    if (company.taxId) {
      doc.text(`Tax ID: ${company.taxId}`, leftColumnX, row2LeftY);
      row2LeftY += 13;
    }

    // Right column: To
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("To:", rightColumnX, row2RightY);
    row2RightY += 14;
    doc.fontSize(10).font("Helvetica");
    doc.text(client.name || "N/A", rightColumnX, row2RightY);
    row2RightY += 13;
    if (client.email) {
      doc.text(`Email: ${client.email}`, rightColumnX, row2RightY);
      row2RightY += 13;
    }
    if (client.phone) {
      doc.text(`Phone: ${client.phone}`, rightColumnX, row2RightY);
      row2RightY += 13;
    }
    if (client.address) {
      const addr = client.address;
      const addrParts = [
        addr.street,
        addr.city,
        addr.state,
        addr.zipCode,
        addr.country,
      ].filter(Boolean);
      const addressText = `Address: ${addrParts.join(", ")}`;
      const addressHeight = doc.heightOfString(addressText, { width: 250 });
      doc.text(addressText, rightColumnX, row2RightY, { width: 250 });
      row2RightY += Math.max(13, addressHeight);
    }

    // Set doc.y to the bottom of row 2 (whichever column is taller)
    doc.y = Math.max(row2LeftY, row2RightY) + 10;

    // Items table - use unified pricing breakdown (single source of truth)
    const breakdown = await this.getPricingBreakdown(quotation);

    // Process items (template-based or legacy)
    const hasItems = breakdown.lineItems.length > 0;

    if (hasItems) {
      doc.fontSize(12).font("Helvetica-Bold").text("Items:", 50);
      doc.moveDown(1);

      // Determine if we should show detailed columns based on breakdown content
      // Show detailed columns if any line item is item, equipment, or template_fee (not legacy)
      const hasDetailedColumns = breakdown.lineItems.some(
        (item) =>
          item.type === "item" ||
          item.type === "equipment" ||
          item.type === "template_fee"
      );

      // Table header - show quantity, unit price (no discount) for detailed items
      ensureSpace(30); // space for header
      doc.fontSize(10).font("Helvetica-Bold");
      const headerY = doc.y;
      if (hasDetailedColumns) {
        doc.text("Description", 50, headerY, { width: 300 });
        doc.text("Qty", 360, headerY, { width: 30 });
        doc.text("Unit Price", 400, headerY, { align: "right", width: 70 });
        doc.text("Price", 480, headerY, { align: "right", width: 70 });
      } else {
        // Legacy items only - simpler header
        doc.text("Description", 50, headerY, { width: 400 });
        doc.text("Price", 450, headerY, { align: "right", width: 100 });
      }
      doc.y = headerY + 15;
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.y += 10;

      // Table rows - use unified pricing breakdown
      doc.fontSize(10).font("Helvetica");

      // Render all line items from unified breakdown
      for (const item of breakdown.lineItems) {
        const itemHeight = Math.max(
          15,
          doc.heightOfString(item.description, { width: 240 })
        );
        ensureSpace(itemHeight + 10); // reserve space for row + padding

        const rowY = doc.y;

        // Description - bounded width to prevent flow
        doc.text(item.description, 50, rowY, { width: 300 });

        // Quantity (only for template items and equipment) - all with bounded widths (no discount column)
        if (item.type !== "legacy") {
          doc.text(String(item.quantity), 360, rowY, { width: 30 });
          doc.text(formatCurrency(item.unitPrice), 400, rowY, {
            align: "right",
            width: 70,
          });
          doc.text(formatCurrency(item.lineTotal), 480, rowY, {
            align: "right",
            width: 70,
          });
        } else {
          // Legacy items - simpler format
          doc.text(formatCurrency(item.lineTotal), 450, rowY, {
            align: "right",
            width: 100,
          });
        }

        doc.y = rowY + itemHeight;
      }

      doc.y += 10;
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.y += 20;
    }

    // Total - use unified pricing breakdown total
    if (quotation.summarize && breakdown.totals.total !== undefined) {
      ensureSpace(30); // space for total line
      doc.fontSize(12).font("Helvetica-Bold");
      const totalY = doc.y;
      doc.text("Total:", 400, totalY);
      doc.text(formatCurrency(breakdown.totals.total), 450, totalY, {
        align: "right",
        width: 100,
      });
      doc.y = totalY + 30;
    }

    // Notes
    if (quotation.notes) {
      const noteLines = doc.heightOfString(quotation.notes, { width: 500 });
      const notesHeight = 20 + Math.max(20, noteLines);
      ensureSpace(notesHeight);

      doc.fontSize(12).font("Helvetica-Bold").text("Notes:", 50);
      doc.moveDown(1);
      doc.fontSize(10).font("Helvetica");
      doc.text(quotation.notes, 50, doc.y, { width: 500 });
      doc.y += Math.max(20, noteLines);
    }

    ensureSpace(140);

    const footerY = doc.y + 20;
    doc.moveTo(50, footerY).lineTo(550, footerY).stroke();
    doc.fontSize(10).font("Helvetica").fillColor("black");
    doc.text("Best regards,", 50, footerY + 10);
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("ShipSync", 50, footerY + 25);
    if (company.name) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(company.name, 50, footerY + 45);
    }

    // Footer text - keep it INSIDE bottom margin to avoid auto page breaks
    const disclaimerY = doc.page.height - doc.page.margins.bottom - 20; // inside content box

    doc.fontSize(8).font("Helvetica").fillColor("gray");
    doc.text(
      "This is an automated quotation document. Please do not reply to this message.",
      50,
      disclaimerY,
      { align: "center", width: 500, lineBreak: false }
    );

    doc.end();

    // Wait for PDF to be generated
    return new Promise((resolve, reject) => {
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);
    });
  }
}
