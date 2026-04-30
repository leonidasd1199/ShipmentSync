import { Model } from "mongoose";
import { getModelToken } from "@nestjs/mongoose";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  IncotermRequirement,
  IncotermRequirementDocument,
  RequirementMode,
} from "../../schemas/incoterm-requirement.schema";
import { Quotation, QuotationDocument } from "../../schemas/quotation.schema";
import { DocumentType } from "../../schemas/shipment-document.schema";

/**
 * Seed helper for tests
 * Creates test data: incoterm requirements and quotations with items
 */
@Injectable()
export class SeedHelper {
  constructor(
    @InjectModel(IncotermRequirement.name)
    private incotermRequirementModel: Model<IncotermRequirementDocument>,
    @InjectModel(Quotation.name)
    private quotationModel: Model<QuotationDocument>,
  ) {}

  /**
   * Seed incoterm requirement for OCEAN+FOB
   */
  async seedIncotermRequirement(userId: string): Promise<IncotermRequirementDocument> {
    return this.incotermRequirementModel.findOneAndUpdate(
      { mode: RequirementMode.OCEAN, incoterm: "FOB" },
      {
        mode: RequirementMode.OCEAN,
        incoterm: "FOB",
        requiredFields: [
          "transport.vesselName",
          "transport.portOfLoadingId",
          "cargo.containers",
          "parties.shipper.name",
          "parties.consignee.name",
        ],
        requiredDocuments: [DocumentType.HBL, DocumentType.COMMERCIAL_INVOICE],
        active: true,
        createdBy: userId,
      },
      { upsert: true, new: true },
    );
  }

  /**
   * Create test quotation with items
   */
  async createTestQuotation(data: {
    companyId: string;
    clientId: string;
    shippingLineId: string;
    userId: string;
  }): Promise<QuotationDocument> {
    return this.quotationModel.create({
      serviceType: "LCL",
      incoterm: "FOB",
      clientId: data.clientId,
      companyId: data.companyId,
      shippingLineId: data.shippingLineId,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: [
        {
          itemId: "item-1",
          description: "Ocean Freight",
          price: 2500,
          quantity: 1,
        },
        {
          itemId: "item-2",
          description: "Handling Fee",
          price: 500,
          quantity: 1,
        },
      ],
      pricingConfig: {
        currency: "USD",
      },
      createdBy: data.userId,
    });
  }
}