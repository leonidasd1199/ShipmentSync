import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Shipping, ShippingDocument } from "../schemas/shipping.schema";
import { Agent, AgentDocument } from "../schemas/agent.schema";
import {
  AgentPricelist,
  AgentPricelistDocument,
  PricelistStatus,
} from "../schemas/agent-pricelist.schema";
import {
  PricelistDistribution,
  PricelistDistributionDocument,
} from "../schemas/pricelist-distribution.schema";
import { Client, ClientDocument } from "../schemas/client.schema";
import { MailService } from "../mail/mail.service";
import { QuotationsService } from "../quotations/quotations.service";

export interface OperatorPricelistContext {
  // Context information for operator view (e.g., filters, date range, etc.)
  agentId?: string;
  incoterm?: string;
  currency?: string;
  status?: string; // Filter by pricelist status (draft/submitted/approved/rejected/superseded)
}

export interface OperatorPricelistResponse {
  supplier: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  pricelists: Array<{
    pricelistId: string;
    weekStart: Date;
    weekEnd?: Date;
    status: string;
    submittedAt?: Date;
    approvedAt?: Date;
    rejectedAt?: Date;
    rejectionReason?: string;
    totalCost?: number;
    itemCount?: number;
    agent: {
      id: string;
      name: string;
      email: string;
    };
    items: Array<{
      id: string;
      name: string;
      chargeType?: string;
      incoterm: string;
      equipmentType?: string;
      lane?: { originPortCode?: string; destinationPortCode?: string; originName?: string; destinationName?: string };
      cost: number;
      profit: number;
      currency: string;
      metadata?: any;
    }>;
    updatedAt?: Date;
    createdAt?: Date;
  }>;
}

export interface SendToClientsResponse {
  success: boolean;
  message: string;
  pricelistId: string;
  totalClients: number;
  clientIds: string[];
  sentAt: Date;
  distributionId: string;
}

@Injectable()
export class OperatorPricingService {
  private readonly logger = new Logger(OperatorPricingService.name);

  constructor(
    @InjectModel(AgentPricelist.name)
    private pricelistModel: Model<AgentPricelistDocument>,
    @InjectModel(Shipping.name) private shippingModel: Model<ShippingDocument>,
    @InjectModel(PricelistDistribution.name)
    private distributionModel: Model<PricelistDistributionDocument>,
    @InjectModel(Client.name)
    private clientModel: Model<ClientDocument>,
    private mailService: MailService,
    private quotationsService: QuotationsService,
  ) {}

  /**
   * Get pricelist for operator view
   * Returns all pricelists for a supplier, optionally filtered by context
   */
  async getPricelistForOperator(
    supplierId: string,
    context: OperatorPricelistContext = {},
  ): Promise<OperatorPricelistResponse> {
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

    // Build query filter
    const queryFilter: any = {
      supplierId: supplierObjectId,
    };

    // Apply context filters
    if (context.agentId) {
      try {
        queryFilter.agentId = new Types.ObjectId(context.agentId);
      } catch (error) {
        throw new BadRequestException(
          `Invalid agentId in context: "${context.agentId}"`,
        );
      }
    }

    // Filter by status if provided
    if (context.status) {
      const validStatuses = Object.values(PricelistStatus);
      if (!validStatuses.includes(context.status as PricelistStatus)) {
        throw new BadRequestException(
          `Invalid status: "${context.status}". Must be one of: ${validStatuses.join(", ")}`,
        );
      }
      queryFilter.status = context.status;
    }

    // Get all pricelists for this supplier
    // Sort by weekStart first (most recent week first), then by updatedAt as secondary sort
    const pricelists = await this.pricelistModel
      .find(queryFilter)
      .populate("agentId", "firstName lastName email")
      .sort({ weekStart: -1, updatedAt: -1 })
      .lean()
      .exec();

    // Filter items by context if needed
    const pricelistsWithFilteredItems = pricelists.map((pricelist) => {
      let items = pricelist.items || [];

      // Filter by incoterm if provided
      if (context.incoterm) {
        items = items.filter((item: any) => item.incoterm === context.incoterm);
      }

      // Filter by currency if provided
      if (context.currency) {
        items = items.filter((item: any) => item.currency === context.currency);
      }

      // Handle populated agentId
      const agentId = pricelist.agentId as any;
      const agentData =
        agentId && typeof agentId === "object" && "_id" in agentId
          ? {
              id: agentId._id.toString(),
              name: `${agentId.firstName || ""} ${agentId.lastName || ""}`.trim(),
              email: agentId.email || "",
            }
          : {
              id: agentId?.toString() || "",
              name: "Unknown Agent",
              email: "",
            };

      return {
        pricelistId: pricelist._id.toString(),
        weekStart: pricelist.weekStart,
        weekEnd: pricelist.weekEnd,
        status: pricelist.status || PricelistStatus.DRAFT,
        submittedAt: pricelist.submittedAt,
        approvedAt: pricelist.approvedAt,
        rejectedAt: pricelist.rejectedAt,
        rejectionReason: pricelist.rejectionReason,
        totalCost: pricelist.totalCost,
        itemCount: pricelist.itemCount,
        agent: agentData,
        items: items.map((item: any) => ({
          id: item._id?.toString() || "",
          name: item.name,
          chargeType: item.chargeType,
          incoterm: item.incoterm,
          equipmentType: item.equipmentType,
          lane: item.lane,
          cost: item.cost,
          profit: item.profit ?? 0,
          currency: item.currency,
          metadata: item.metadata,
        })),
        updatedAt: pricelist.updatedAt,
        createdAt: pricelist.createdAt,
      };
    });

    return {
      supplier: {
        id: supplier._id.toString(),
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
      },
      pricelists: pricelistsWithFilteredItems,
    };
  }

  /**
   * Send approved pricelist to clients
   * Only approved pricelists can be distributed
   *
   * Flow:
   * 1. Validate pricelist exists and is approved
   * 2. Get client list (all active clients or specific clientIds)
   * 3. Validate all clientIds exist and are active
   * 4. Create distribution record for audit
   * 5. Send emails with PDF attachment
   * 6. Return distribution details
   */
  async sendPricelistToClients(
    quotationId: string | undefined,
    pricelistId: string,
    clientIds: string[] | undefined,
    sendToAll: boolean,
    operatorId: string,
    operatorEmail: string,
    pdfBuffer: Buffer,
    pdfFilename: string,
    quoteSnapshotPayload?: Record<string, unknown>,
  ): Promise<SendToClientsResponse> {
    // Validate pricelistId format
    let pricelistObjectId: Types.ObjectId;
    try {
      pricelistObjectId = new Types.ObjectId(pricelistId);
    } catch {
      throw new BadRequestException(
        `Invalid pricelistId format: "${pricelistId}"`,
      );
    }

    // Get pricelist and verify it exists and is approved
    const pricelist = await this.pricelistModel
      .findById(pricelistObjectId)
      .exec();
    if (!pricelist) {
      throw new NotFoundException(
        `Pricelist with id "${pricelistId}" not found`,
      );
    }

    // Validate pricelist is approved
    if (pricelist.status !== PricelistStatus.APPROVED) {
      throw new BadRequestException(
        `Pricelist must be approved before distribution. Current status: ${pricelist.status}`,
      );
    }

    // Determine which clients to send to: optional clientIds array, or sendToAll
    let targetClientIds: Types.ObjectId[] = [];
    let totalClients = 0;

    const hasClientIds =
      Array.isArray(clientIds) && clientIds.length > 0;

    if (hasClientIds) {
      // Use only the provided client IDs
      const clientObjectIds: Types.ObjectId[] = [];
      for (const clientId of clientIds!) {
        try {
          const objectId = new Types.ObjectId(clientId);
          clientObjectIds.push(objectId);
        } catch {
          throw new BadRequestException(
            `Invalid clientId format: "${clientId}"`,
          );
        }
      }

      const clients = await this.clientModel
        .find({
          _id: { $in: clientObjectIds },
          isActive: true,
        })
        .select("_id")
        .lean()
        .exec();

      if (clients.length !== clientObjectIds.length) {
        const foundIds = clients.map((c) => c._id.toString());
        const missingIds = clientObjectIds
          .filter((id) => !foundIds.includes(id.toString()))
          .map((id) => id.toString());
        throw new NotFoundException(
          `Some clients not found or inactive: ${missingIds.join(", ")}`,
        );
      }

      targetClientIds = clientObjectIds;
      totalClients = clients.length;
    } else {
      // No clientIds: require sendToAll to send to all active clients
      if (!sendToAll) {
        throw new BadRequestException(
          "Either provide clientIds (array of client IDs) or set sendToAll to true",
        );
      }

      const allClients = await this.clientModel
        .find({ isActive: true })
        .select("_id")
        .lean()
        .exec();

      targetClientIds = allClients.map(
        (client) => client._id as Types.ObjectId,
      );
      totalClients = allClients.length;

      if (totalClients === 0) {
        throw new BadRequestException(
          "No active clients found to send pricelist to",
        );
      }
    }

    // Create distribution record for audit
    const distribution = await this.distributionModel.create({
      pricelistId: pricelistObjectId,
      clientIds: targetClientIds,
      sendToAll,
      sentBy: new Types.ObjectId(operatorId),
      sentByEmail: operatorEmail,
      sentAt: new Date(),
      totalClients,
    });

    // Send email notifications to clients with PDF attachment
    await this.sendEmailNotificationsToClients(
      pricelist,
      targetClientIds,
      distribution.sentAt,
      pdfBuffer,
      pdfFilename,
    );

    // Create one Quotation + QuotationDelivery per client so quotation_deliveries is populated
    await this.quotationsService.recordQuotationDeliveriesForPricelistSend(
      quotationId,
      pricelistId,
      targetClientIds,
      operatorId,
      operatorEmail,
      quoteSnapshotPayload,
      pdfBuffer,
    );

    return {
      success: true,
      message: `Pricelist distributed to ${totalClients} client${totalClients > 1 ? "s" : ""}`,
      pricelistId: pricelistId,
      totalClients,
      clientIds: targetClientIds.map((id) => id.toString()),
      sentAt: distribution.sentAt,
      distributionId: distribution._id.toString(),
    };
  }

  /**
   * Send email notifications to clients when pricelist is distributed
   * Only sends emails to clients that have an email address
   */
  private async sendEmailNotificationsToClients(
    pricelist: AgentPricelistDocument,
    clientIds: Types.ObjectId[],
    distributedAt: Date,
    pdfBuffer: Buffer,
    pdfFilename: string,
  ): Promise<void> {
    // Get client details including email addresses
    const clients = await this.clientModel
      .find({
        _id: { $in: clientIds },
        email: { $exists: true, $ne: null, $nin: [null, ""] },
      })
      .select("_id name email")
      .lean()
      .exec();

    // Get supplier details
    const supplier = await this.shippingModel
      .findById(pricelist.supplierId)
      .select("name")
      .lean()
      .exec();

    // Get agent details
    const agent = await this.pricelistModel
      .findById(pricelist._id)
      .populate("agentId", "firstName lastName")
      .select("agentId")
      .lean()
      .exec();

    const agentData = agent?.agentId as any;
    const agentName =
      agentData && typeof agentData === "object" && "_id" in agentData
        ? `${(agentData as any).firstName || ""} ${(agentData as any).lastName || ""}`.trim()
        : "Unknown Agent";

    // Format dates
    const weekStart = pricelist.weekStart
      ? new Date(pricelist.weekStart).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "N/A";
    const weekEnd = pricelist.weekEnd
      ? new Date(pricelist.weekEnd).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "N/A";
    const distributedAtFormatted = distributedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Calculate total cost and currency (use first item's currency if available)
    const totalCost = pricelist.totalCost || 0;
    const currency =
      pricelist.items && pricelist.items.length > 0
        ? (pricelist.items[0] as any).currency || "USD"
        : "USD";

    // Send email to each client with PDF attachment
    const emailPromises = clients.map(async (client) => {
      try {
        const attachments = [
          {
            filename: pdfFilename,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ];

        await this.mailService.sendEmail({
          to: client.email!,
          subject: `New Pricelist Available - ${supplier?.name || "Supplier"}`,
          template: "pricelist-distributed",
          context: {
            clientName: client.name || "Valued Client",
            supplierName: supplier?.name || "Supplier",
            agentName: agentName,
            weekStart: weekStart,
            weekEnd: weekEnd,
            itemCount: pricelist.itemCount || 0,
            totalCost: totalCost.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            currency: currency,
            distributedAt: distributedAtFormatted,
            pdfFilename: pdfFilename,
          },
          attachments,
        });
        this.logger.log(`Email sent to ${client.email}`);
      } catch (error) {
        this.logger.error(`Failed to send email to ${client.email}`, error);
        // Don't throw - continue sending to other clients even if one fails
      }
    });

    // Wait for all emails to be sent (or fail gracefully)
    await Promise.allSettled(emailPromises);

    const clientsWithEmail = clients.length;
    const clientsWithoutEmail = clientIds.length - clientsWithEmail;

    if (clientsWithoutEmail > 0) {
      this.logger.warn(`${clientsWithoutEmail} client(s) had no email address and were skipped`);
    }
  }
}
