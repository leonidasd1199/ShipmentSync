import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Shipment,
  ShipmentDocument,
  ShipmentMode,
  ShipmentStatus,
} from "../../schemas/shipment.schema";
import { Quotation, QuotationDocument } from "../../schemas/quotation.schema";
import { User, UserDocument } from "../../schemas/user.schema";
import { CreateShipmentDto, UpdateShipmentDto, ShipmentFiltersDto } from "../dto";
import { FieldValidatorHelper } from "../helpers/field-validator.helper";
import { IncotermRequirementService } from "./incoterm-requirement.service";
import { ShipmentDocumentService } from "./shipment-document.service";
import { DocumentEngineService } from "./document-engine.service";
import { DocumentType, DocumentStatus } from "../../schemas/shipment-document.schema";
import {
  ShipmentLedgerLine,
  ShipmentLedgerLineDocument,
} from "../../schemas/shipment-ledger-line.schema";

@Injectable()
export class ShipmentService {
  constructor(
    @InjectModel(Shipment.name)
    private shipmentModel: Model<ShipmentDocument>,
    @InjectModel(Quotation.name)
    private quotationModel: Model<QuotationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(ShipmentLedgerLine.name)
    private ledgerLineModel: Model<ShipmentLedgerLineDocument>,
    private incotermRequirementService: IncotermRequirementService,
    private documentService: ShipmentDocumentService,
    private documentEngineService: DocumentEngineService,
  ) {}

  /**
   * Create a new shipment
   */
  async create(
    dto: CreateShipmentDto,
    userId: string,
  ): Promise<ShipmentDocument> {
    // Validate quotationId exists if quotationSnapshot is provided
    if (dto.quotationSnapshot?.quotationId) {
      const quotation = await this.quotationModel
        .findById(dto.quotationSnapshot.quotationId)
        .exec();
      if (!quotation) {
        throw new NotFoundException(
          `Quotation with id ${dto.quotationSnapshot.quotationId} not found`,
        );
      }
    }

    this.assertNonNegativePackageDimensions(dto.cargo);

    // Build shipmentData WITHOUT spreading dto (avoids overwrite conflicts)
    try {
      // Process quotationSnapshot if provided
      let quotationSnapshot: Record<string, any> | undefined = undefined;
      if (dto.quotationSnapshot) {
        quotationSnapshot = {
          quotationId: new Types.ObjectId(dto.quotationSnapshot.quotationId),
          serviceType: dto.quotationSnapshot.serviceType,
          incoterm: dto.quotationSnapshot.incoterm,
          shippingMode: dto.quotationSnapshot.shippingMode,
          clientId: dto.quotationSnapshot.clientId
            ? new Types.ObjectId(dto.quotationSnapshot.clientId)
            : undefined,
          agentId: dto.quotationSnapshot.agentId
            ? new Types.ObjectId(dto.quotationSnapshot.agentId)
            : undefined,
          shippingLineId: dto.quotationSnapshot.shippingLineId
            ? new Types.ObjectId(dto.quotationSnapshot.shippingLineId)
            : undefined,
          portOfOrigin: dto.quotationSnapshot.portOfOrigin
            ? new Types.ObjectId(dto.quotationSnapshot.portOfOrigin)
            : undefined,
          portOfDestination: dto.quotationSnapshot.portOfDestination
            ? new Types.ObjectId(dto.quotationSnapshot.portOfDestination)
            : undefined,
          currency: dto.quotationSnapshot.currency,
          templateId: dto.quotationSnapshot.templateId
            ? new Types.ObjectId(dto.quotationSnapshot.templateId)
            : undefined,
          items: dto.quotationSnapshot.items || [],
          equipmentItems: dto.quotationSnapshot.equipmentItems || [],
          total: dto.quotationSnapshot.total,
          validUntil: dto.quotationSnapshot.validUntil
            ? new Date(dto.quotationSnapshot.validUntil)
            : undefined,
          snapshotTakenAt: dto.quotationSnapshot.snapshotTakenAt
            ? new Date(dto.quotationSnapshot.snapshotTakenAt)
            : new Date(),
          snapshotTakenBy: dto.quotationSnapshot.snapshotTakenBy
            ? new Types.ObjectId(dto.quotationSnapshot.snapshotTakenBy)
            : new Types.ObjectId(userId),
        };
      }

      const operatorSnapshot = await this.buildOperatorSnapshot(
        dto.operationalUserId,
      );
      const containers =
        dto.mode === ShipmentMode.AIR
          ? []
          : this.mapContainersWithPackageCompatibility(dto.cargo.containers || []);
      const cargoFallback = this.deriveLegacyCargoFallbackFromContainers(containers);
      const airPackages =
        dto.mode === ShipmentMode.AIR && dto.cargo.packages?.length
          ? this.mapCargoLevelPackagesFlat(dto.cargo.packages)
          : undefined;
      const airCargoFallback = airPackages?.length
        ? this.deriveLegacyCargoFallbackFromContainers([{ packages: airPackages }])
        : {};

      const shipmentData: Record<string, any> = {
        companyId: new Types.ObjectId(dto.companyId),
        officeId: new Types.ObjectId(dto.officeId),
        quotationId: dto.quotationId
          ? new Types.ObjectId(dto.quotationId)
          : undefined,
        mode: dto.mode,
        incoterm: dto.incoterm,
        movementType: dto.movementType,
        bookingNumber: dto.bookingNumber,
        mblNumber: dto.mblNumber,
        hblNumber: dto.hblNumber,
        operationalUserId: new Types.ObjectId(dto.operationalUserId),
        ...(operatorSnapshot ? { operator: operatorSnapshot } : {}),
        status: ShipmentStatus.DRAFT,
        createdBy: new Types.ObjectId(userId),
        quotationSnapshot,
        shippingLineId: dto.shippingLineId
          ? new Types.ObjectId(dto.shippingLineId)
          : undefined,
        parties: {
          shipper: {
            ...dto.parties?.shipper,
            clientId: dto.parties?.shipper?.clientId
              ? new Types.ObjectId(dto.parties.shipper.clientId)
              : undefined,
          },
          consignee: {
            ...dto.parties?.consignee,
            clientId: dto.parties?.consignee?.clientId
              ? new Types.ObjectId(dto.parties.consignee.clientId)
              : undefined,
          },
          notifyPartyText: dto.parties?.notifyPartyText,
        },
        cargo: {
          containers,
          ...(airPackages?.length ? { packages: airPackages } : {}),
          packagesQuantity:
            dto.cargo.packagesQuantity ??
            cargoFallback.packagesQuantity ??
            airCargoFallback.packagesQuantity,
          packagesType:
            dto.cargo.packagesType ??
            cargoFallback.packagesType ??
            airCargoFallback.packagesType,
          goodsDescription: dto.cargo.goodsDescription,
          grossWeightKg: dto.cargo.grossWeightKg,
          volumeCbm:
            dto.cargo.volumeCbm ??
            cargoFallback.volumeCbm ??
            airCargoFallback.volumeCbm,
          airDimensionsText: dto.cargo.airDimensionsText,
        },
        transport: dto.transport
          ? {
              ...dto.transport,
              portOfLoadingId: dto.transport.portOfLoadingId
                ? new Types.ObjectId(dto.transport.portOfLoadingId)
                : undefined,
              portOfDischargeId: dto.transport.portOfDischargeId
                ? new Types.ObjectId(dto.transport.portOfDischargeId)
                : undefined,
            }
          : undefined,
        dates: dto.dates
          ? {
              etd: dto.dates.etd ? new Date(dto.dates.etd) : undefined,
              eta: dto.dates.eta ? new Date(dto.dates.eta) : undefined,
              atd: dto.dates.atd ? new Date(dto.dates.atd) : undefined,
              ata: dto.dates.ata ? new Date(dto.dates.ata) : undefined,
            }
          : undefined,
      };

      return await this.shipmentModel.create(shipmentData);
    } catch (err: any) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((e: any) => e.message);
        throw new BadRequestException(messages.join("; "));
      }
      if (err.name === "CastError" || err.name === "BSONTypeError" || err.name === "BSONError") {
        throw new BadRequestException(`Invalid ID or field value: ${err.message}`);
      }
      if (err.code === 11000) {
        throw new BadRequestException("Duplicate shipment entry.");
      }
      throw new InternalServerErrorException(err.message ?? "Failed to create shipment.");
    }
  }

  /**
   * Find shipments with filters
   */
  async findAll(filters: ShipmentFiltersDto): Promise<ShipmentDocument[]> {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.officeId) {
      query.officeId = new Types.ObjectId(filters.officeId);
    }
    if (filters.companyId) {
      query.companyId = new Types.ObjectId(filters.companyId);
    }
    if (filters.mode) {
      query.mode = filters.mode;
    }
    if (filters.incoterm) {
      query.incoterm = filters.incoterm.toUpperCase();
    }
    if (filters.search) {
      query.$or = [
        { bookingNumber: { $regex: filters.search, $options: "i" } },
        { mblNumber: { $regex: filters.search, $options: "i" } },
        { hblNumber: { $regex: filters.search, $options: "i" } },
      ];
    }

    return this.shipmentModel
      .find(query)
      .populate("createdBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Find one shipment by ID
   */
  async findOne(id: string): Promise<ShipmentDocument> {
    const shipment = await this.shipmentModel
      .findById(id)
      .populate("createdBy", "firstName lastName email")
      .exec();
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${id} not found`);
    }
    return shipment;
  }

  /**
   * Update shipment (only if status is DRAFT)
   */
  async update(
    id: string,
    dto: UpdateShipmentDto,
    userId: string,
  ): Promise<ShipmentDocument> {
    const shipment = await this.findOne(id);
    const originalShippingLineId = shipment.shippingLineId?.toString();

    if (shipment.status !== ShipmentStatus.DRAFT) {
      throw new ForbiddenException(
        `Cannot update shipment with status ${shipment.status}. Only DRAFT shipments can be updated.`,
      );
    }

    // Validate quotationId exists if quotationSnapshot is provided
    if (dto.quotationSnapshot?.quotationId) {
      const quotation = await this.quotationModel
        .findById(dto.quotationSnapshot.quotationId)
        .exec();
      if (!quotation) {
        throw new NotFoundException(
          `Quotation with id ${dto.quotationSnapshot.quotationId} not found`,
        );
      }
    }

    if (dto.cargo) {
      this.assertNonNegativePackageDimensions(dto.cargo);
    }

    try {
      const updateData: any = {
        updatedBy: new Types.ObjectId(userId),
      };

      // Convert ObjectIds
      if (dto.companyId) updateData.companyId = new Types.ObjectId(dto.companyId);
      if (dto.officeId) updateData.officeId = new Types.ObjectId(dto.officeId);
      if (dto.quotationId) updateData.quotationId = new Types.ObjectId(dto.quotationId);
      if (dto.operationalUserId) updateData.operationalUserId = new Types.ObjectId(dto.operationalUserId);
      if (dto.operationalUserId) {
        const operatorSnapshot = await this.buildOperatorSnapshot(dto.operationalUserId);
        updateData.operator = operatorSnapshot;
      }
      if (dto.shippingLineId) {
        updateData.shippingLineId = new Types.ObjectId(dto.shippingLineId);
      }
      if (dto.mode) updateData.mode = dto.mode;
      if (dto.incoterm) updateData.incoterm = dto.incoterm;
      if (dto.movementType !== undefined) updateData.movementType = dto.movementType;
      if (dto.bookingNumber !== undefined) updateData.bookingNumber = dto.bookingNumber;
      if (dto.mblNumber !== undefined) updateData.mblNumber = dto.mblNumber;
      if (dto.hblNumber !== undefined) updateData.hblNumber = dto.hblNumber;

      if (dto.quotationSnapshot) {
        updateData.quotationSnapshot = {
          quotationId: new Types.ObjectId(dto.quotationSnapshot.quotationId),
          serviceType: dto.quotationSnapshot.serviceType,
          incoterm: dto.quotationSnapshot.incoterm,
          shippingMode: dto.quotationSnapshot.shippingMode,
          clientId: dto.quotationSnapshot.clientId
            ? new Types.ObjectId(dto.quotationSnapshot.clientId)
            : undefined,
          agentId: dto.quotationSnapshot.agentId
            ? new Types.ObjectId(dto.quotationSnapshot.agentId)
            : undefined,
          shippingLineId: dto.quotationSnapshot.shippingLineId
            ? new Types.ObjectId(dto.quotationSnapshot.shippingLineId)
            : undefined,
          portOfOrigin: dto.quotationSnapshot.portOfOrigin
            ? new Types.ObjectId(dto.quotationSnapshot.portOfOrigin)
            : undefined,
          portOfDestination: dto.quotationSnapshot.portOfDestination
            ? new Types.ObjectId(dto.quotationSnapshot.portOfDestination)
            : undefined,
          currency: dto.quotationSnapshot.currency,
          templateId: dto.quotationSnapshot.templateId
            ? new Types.ObjectId(dto.quotationSnapshot.templateId)
            : undefined,
          items: dto.quotationSnapshot.items || [],
          equipmentItems: dto.quotationSnapshot.equipmentItems || [],
          total: dto.quotationSnapshot.total,
          validUntil: dto.quotationSnapshot.validUntil
            ? new Date(dto.quotationSnapshot.validUntil)
            : undefined,
          snapshotTakenAt: dto.quotationSnapshot.snapshotTakenAt
            ? new Date(dto.quotationSnapshot.snapshotTakenAt)
            : new Date(),
          snapshotTakenBy: dto.quotationSnapshot.snapshotTakenBy
            ? new Types.ObjectId(dto.quotationSnapshot.snapshotTakenBy)
            : new Types.ObjectId(userId),
        };
      }
      if (dto.cargo) {
        const mode = dto.mode ?? shipment.mode;
        const containers =
          mode === ShipmentMode.AIR
            ? []
            : this.mapContainersWithPackageCompatibility(dto.cargo.containers || []);
        const cargoFallback = this.deriveLegacyCargoFallbackFromContainers(containers);
        const mappedAirPackages =
          mode === ShipmentMode.AIR
            ? dto.cargo.packages?.length
              ? this.mapCargoLevelPackagesFlat(dto.cargo.packages)
              : []
            : undefined;
        const airCargoFallback =
          mappedAirPackages && mappedAirPackages.length > 0
            ? this.deriveLegacyCargoFallbackFromContainers([
                { packages: mappedAirPackages },
              ])
            : {};
        const { packages: _rawAirPackages, ...cargoRest } = dto.cargo;
        updateData.cargo = {
          ...cargoRest,
          containers,
          ...(mode === ShipmentMode.AIR ? { packages: mappedAirPackages ?? [] } : {}),
          packagesQuantity:
            dto.cargo.packagesQuantity ??
            cargoFallback.packagesQuantity ??
            airCargoFallback.packagesQuantity,
          packagesType:
            dto.cargo.packagesType ??
            cargoFallback.packagesType ??
            airCargoFallback.packagesType,
          volumeCbm:
            dto.cargo.volumeCbm ??
            cargoFallback.volumeCbm ??
            airCargoFallback.volumeCbm,
        };
      }
      if (dto.transport) {
        updateData.transport = {
          ...dto.transport,
          portOfLoadingId: dto.transport.portOfLoadingId
            ? new Types.ObjectId(dto.transport.portOfLoadingId)
            : undefined,
          portOfDischargeId: dto.transport.portOfDischargeId
            ? new Types.ObjectId(dto.transport.portOfDischargeId)
            : undefined,
        };
      }
      if (dto.dates) {
        updateData.dates = {
          etd: dto.dates.etd ? new Date(dto.dates.etd) : undefined,
          eta: dto.dates.eta ? new Date(dto.dates.eta) : undefined,
          atd: dto.dates.atd ? new Date(dto.dates.atd) : undefined,
          ata: dto.dates.ata ? new Date(dto.dates.ata) : undefined,
        };
      }
      if (dto.parties) {
        updateData.parties = {
          shipper: {
            ...dto.parties.shipper,
            clientId: dto.parties.shipper?.clientId
              ? new Types.ObjectId(dto.parties.shipper.clientId)
              : undefined,
          },
          consignee: {
            ...dto.parties.consignee,
            clientId: dto.parties.consignee?.clientId
              ? new Types.ObjectId(dto.parties.consignee.clientId)
              : undefined,
          },
          notifyPartyText: dto.parties.notifyPartyText,
        };
      }

      const updated = await this.shipmentModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();
      if (!updated) {
        throw new NotFoundException(`Shipment with id ${id} not found`);
      }

      if (
        dto.shippingLineId &&
        dto.shippingLineId !== originalShippingLineId
      ) {
        await this.ledgerLineModel.updateMany(
          { shipmentId: updated._id },
          { $set: { supplierId: new Types.ObjectId(dto.shippingLineId) } },
        );
      }
      return updated;
    } catch (err: any) {
      if (
        err instanceof NotFoundException ||
        err instanceof ForbiddenException ||
        err instanceof BadRequestException
      ) throw err;
      if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((e: any) => e.message);
        throw new BadRequestException(messages.join("; "));
      }
      if (err.name === "CastError" || err.name === "BSONTypeError" || err.name === "BSONError") {
        throw new BadRequestException(`Invalid ID or field value: ${err.message}`);
      }
      if (err.code === 11000) {
        throw new BadRequestException("Duplicate shipment entry.");
      }
      throw new InternalServerErrorException(err.message ?? "Failed to update shipment.");
    }
  }

  /**
   * Transition to READY_FOR_FINANCE
   */
  async readyForFinance(id: string, userId: string): Promise<ShipmentDocument> {
    const shipment = await this.findOne(id);

    if (shipment.status !== ShipmentStatus.DRAFT) {
      throw new BadRequestException(
        `Shipment must be in DRAFT status to transition to READY_FOR_FINANCE. Current status: ${shipment.status}`,
      );
    }

    // Get incoterm requirement
    const requirement = await this.incotermRequirementService.findByModeAndIncoterm(
      shipment.mode,
      shipment.incoterm,
    );

    // Validate required fields
    const fieldValidation = FieldValidatorHelper.validateRequiredFields(
      shipment.toObject(),
      requirement.requiredFields,
    );

    if (!fieldValidation.valid) {
      throw new BadRequestException({
        message: "Required fields are missing",
        missingFields: fieldValidation.errors,
      });
    }

    // Validate required documents based on mode
    const requiredDocumentTypes = this.documentEngineService.getRequiredDocuments(
      shipment.mode,
    );

    const { documents } = await this.documentEngineService.getDocumentsWithRequired(
      id,
    );

    const existingDocumentTypes = documents
      .filter(
        (d) =>
          d.status === DocumentStatus.GENERATED ||
          d.status === DocumentStatus.LOCKED,
      )
      .map((d) => d.documentType);

    const missingDocuments: DocumentType[] = [];
    for (const docType of requiredDocumentTypes) {
      if (!existingDocumentTypes.includes(docType)) {
        missingDocuments.push(docType);
      }
    }

    if (missingDocuments.length > 0) {
      throw new BadRequestException({
        message: "Required documents are missing",
        missingDocuments: missingDocuments.map((d) => d.toString()),
      });
    }

    // Lock required documents
    await this.documentEngineService.lockDocuments(
      id,
      userId,
      requiredDocumentTypes,
    );

    const updated = await this.shipmentModel
      .findByIdAndUpdate(
        id,
        {
          status: ShipmentStatus.READY_FOR_FINANCE,
          lockedAt: new Date(),
          lockedBy: new Types.ObjectId(userId),
          updatedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException(`Shipment with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Transition to FINANCE_REVIEW
   */
  async financeReview(id: string, userId: string): Promise<ShipmentDocument> {
    const shipment = await this.findOne(id);

    if (shipment.status !== ShipmentStatus.READY_FOR_FINANCE) {
      throw new BadRequestException(
        `Shipment must be in READY_FOR_FINANCE status. Current status: ${shipment.status}`,
      );
    }

    const updated = await this.shipmentModel
      .findByIdAndUpdate(
        id,
        {
          status: ShipmentStatus.FINANCE_REVIEW,
          updatedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException(`Shipment with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Approve shipment
   */
  async approve(
    id: string,
    userId: string,
    options?: { note?: string },
  ): Promise<ShipmentDocument> {
    const shipment = await this.findOne(id);

    if (shipment.status !== ShipmentStatus.FINANCE_REVIEW) {
      throw new BadRequestException(
        `Shipment must be in FINANCE_REVIEW status. Current status: ${shipment.status}`,
      );
    }

    const noteTrimmed = options?.note?.trim();
    const update: Record<string, unknown> = {
      status: ShipmentStatus.APPROVED,
      updatedBy: new Types.ObjectId(userId),
    };
    if (noteTrimmed) {
      update.financeLastNote = noteTrimmed;
    }

    const updated = await this.shipmentModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Shipment with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Reject finance review → return shipment to DRAFT
   */
  async rejectFinanceReview(
    id: string,
    userId: string,
    note: string,
  ): Promise<ShipmentDocument> {
    const trimmed = note?.trim();
    if (!trimmed) {
      throw new BadRequestException(
        "A note is required when rejecting finance review.",
      );
    }

    const shipment = await this.findOne(id);

    if (shipment.status !== ShipmentStatus.FINANCE_REVIEW) {
      throw new BadRequestException(
        `Shipment must be in FINANCE_REVIEW status. Current status: ${shipment.status}`,
      );
    }

    const updated = await this.shipmentModel
      .findByIdAndUpdate(
        id,
        {
          status: ShipmentStatus.DRAFT,
          financeLastNote: trimmed,
          updatedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException(`Shipment with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Close shipment
   */
  async close(id: string, userId: string): Promise<ShipmentDocument> {
    const shipment = await this.findOne(id);

    if (shipment.status !== ShipmentStatus.APPROVED) {
      throw new BadRequestException(
        `Shipment must be in APPROVED status. Current status: ${shipment.status}`,
      );
    }

    const updated = await this.shipmentModel
      .findByIdAndUpdate(
        id,
        {
          status: ShipmentStatus.CLOSED,
          updatedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException(`Shipment with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Enforce non-negative package dimensions (mirrors DTO @Min(0); nested pipe validation can miss some payloads).
   */
  private assertNonNegativePackageDimensions(cargo: {
    containers?: Array<{
      packages?: Array<{
        dimensions?: { length?: number; width?: number; height?: number };
      }>;
    }>;
    packages?: Array<{
      dimensions?: { length?: number; width?: number; height?: number };
    }>;
  }): void {
    const checkDim = (d: {
      length?: number;
      width?: number;
      height?: number;
    }): void => {
      for (const key of ["length", "width", "height"] as const) {
        const v = d[key];
        if (typeof v === "number" && v < 0) {
          throw new BadRequestException(
            "Package dimensions must be non-negative (length, width, height).",
          );
        }
      }
    };

    for (const c of cargo?.containers ?? []) {
      for (const p of c.packages ?? []) {
        if (p.dimensions) checkDim(p.dimensions);
      }
    }
    for (const p of cargo?.packages ?? []) {
      if (p.dimensions) checkDim(p.dimensions);
    }
  }

  private async buildOperatorSnapshot(
    operatorUserId: string,
  ): Promise<{ id: Types.ObjectId; email?: string; name?: string }> {
    const operatorId = new Types.ObjectId(operatorUserId);
    const operatorUser = await this.userModel
      .findById(operatorId)
      .select("email firstName lastName")
      .lean()
      .exec();

    if (!operatorUser) {
      return { id: operatorId };
    }

    const operatorName = `${operatorUser.firstName || ""} ${operatorUser.lastName || ""}`.trim();

    return {
      id: operatorId,
      ...(operatorUser.email ? { email: operatorUser.email } : {}),
      ...(operatorName ? { name: operatorName } : {}),
    };
  }

  private mapCargoLevelPackagesFlat(
    packages: Array<{
      type?: string;
      quantity?: number;
      dimensions: { length: number; width: number; height: number; unit?: string };
    }>,
  ): Array<{
    type?: string;
    quantity?: number;
    dimensions: { length: number; width: number; height: number; unit?: string };
  }> {
    return packages.map((pkg) => ({
      ...(pkg.type ? { type: pkg.type } : {}),
      ...(typeof pkg.quantity === "number" ? { quantity: pkg.quantity } : {}),
      dimensions: {
        length: pkg.dimensions.length,
        width: pkg.dimensions.width,
        height: pkg.dimensions.height,
        ...(pkg.dimensions.unit ? { unit: pkg.dimensions.unit } : {}),
      },
    }));
  }

  private mapContainersWithPackageCompatibility(
    containers: Array<{
      containerNumber?: string;
      sealNumber?: string;
      containerType?: string;
      packages?: Array<{
        type?: string;
        quantity?: number;
        dimensions: { length: number; width: number; height: number; unit?: string };
      }>;
    }>,
  ): Array<{
    containerNumber: string;
    sealNumber?: string;
    containerType?: string;
    packages: Array<{
      type?: string;
      quantity?: number;
      dimensions: { length: number; width: number; height: number; unit?: string };
    }>;
  }> {
    return containers.map((container) => ({
      containerNumber: (container.containerNumber ?? "").trim(),
      ...(container.sealNumber ? { sealNumber: container.sealNumber } : {}),
      ...(container.containerType ? { containerType: container.containerType } : {}),
      packages: (container.packages || []).map((pkg) => ({
        ...(pkg.type ? { type: pkg.type } : {}),
        ...(typeof pkg.quantity === "number" ? { quantity: pkg.quantity } : {}),
        dimensions: {
          length: pkg.dimensions.length,
          width: pkg.dimensions.width,
          height: pkg.dimensions.height,
          ...(pkg.dimensions.unit ? { unit: pkg.dimensions.unit } : {}),
        },
      })),
    }));
  }

  private deriveLegacyCargoFallbackFromContainers(
    containers: Array<{
      packages: Array<{
        type?: string;
        quantity?: number;
        dimensions: { length: number; width: number; height: number; unit?: string };
      }>;
    }>,
  ): { packagesQuantity?: number; packagesType?: string; volumeCbm?: number } {
    let packagesQuantity = 0;
    const packageTypes = new Set<string>();
    let volumeCbm = 0;

    for (const container of containers) {
      for (const pkg of container.packages) {
        const qty = typeof pkg.quantity === "number" ? pkg.quantity : 0;
        packagesQuantity += qty;
        if (pkg.type) {
          packageTypes.add(pkg.type);
        }
        const unit = pkg.dimensions.unit || "cm";
        const length = pkg.dimensions.length;
        const width = pkg.dimensions.width;
        const height = pkg.dimensions.height;
        if (unit === "m") {
          volumeCbm += qty * length * width * height;
        } else if (unit === "cm") {
          volumeCbm += qty * (length * width * height) / 1000000;
        } else if (unit === "in") {
          volumeCbm += qty * (length * width * height) * 0.000016387064;
        }
      }
    }

    return {
      ...(packagesQuantity > 0 ? { packagesQuantity } : {}),
      ...(packageTypes.size > 0 ? { packagesType: Array.from(packageTypes).join(", ") } : {}),
      ...(volumeCbm > 0 ? { volumeCbm: Number(volumeCbm.toFixed(3)) } : {}),
    };
  }
}