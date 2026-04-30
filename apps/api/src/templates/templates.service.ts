import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Template, TemplateDocument } from "../schemas/template.schema";
import { Company, CompanyDocument } from "../schemas/company.schema";
import { User, UserDocument } from "../schemas/user.schema";
import { AccessVerificationService } from "../common/services/access-verification.service";
import { HistoryService } from "../history/history.service";
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplatePricingConfigDto,
} from "./dto";
import { TemplateSerializer } from "./serializers";

@Injectable()
export class TemplatesService {
  constructor(
    @InjectModel(Template.name) private templateModel: Model<TemplateDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private accessVerification: AccessVerificationService,
    private historyService: HistoryService,
  ) {}

  async create(
    createTemplateDto: CreateTemplateDto,
    userId: string,
    userEmail: string,
  ) {
    // Verify user exists
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Verify company access
    await this.accessVerification.verifyCompanyAccess(
      userId,
      user.company,
    );

    // Validate category (ICC 2020)
    const validCategories = [
      "EXW",
      "FCA",
      "FAS",
      "FOB",
      "CFR",
      "CIF",
      "CPT",
      "CIP",
      "DAP",
      "DPU",
      "DDP",
    ];
    if (!validCategories.includes(createTemplateDto.category)) {
      throw new BadRequestException(
        `Invalid category: "${createTemplateDto.category}". Valid values are: ${validCategories.join(", ")}`,
      );
    }

    // Validate service type
    const validServiceTypes = [
      "FCL",
      "LCL",
      "AIR",
      "FTL",
      "INSURANCE",
      "CUSTOMS",
      "LOCAL_TRUCKING",
      "OTHER",
    ];
    if (!validServiceTypes.includes(createTemplateDto.serviceType)) {
      throw new BadRequestException(
        `Invalid serviceType: "${createTemplateDto.serviceType}". Valid values are: ${validServiceTypes.join(", ")}`,
      );
    }

    // Validate shipping modes
    const validShippingModes = ["maritime", "air", "road"];
    if (!createTemplateDto.shippingModes || !Array.isArray(createTemplateDto.shippingModes) || createTemplateDto.shippingModes.length === 0) {
      throw new BadRequestException("shippingModes is required and must include at least one value");
    }
    const invalidModes = createTemplateDto.shippingModes.filter(
      (mode) => !validShippingModes.includes(mode),
    );
    if (invalidModes.length > 0) {
      throw new BadRequestException(
        `Invalid shippingModes values: ${invalidModes.join(", ")}. Valid values are: ${validShippingModes.join(", ")}`,
      );
    }

    // Validate price configuration
    this.validatePriceConfiguration(createTemplateDto.pricingConfig);

    // Validate headerFields if provided
    if (createTemplateDto.headerFields) {
      const validInputTypes = ["text", "textarea", "number", "date", "select"];
      for (const field of createTemplateDto.headerFields) {
        if (!field.id || field.id.trim() === "") {
          throw new BadRequestException("Header field id is required");
        }
        if (!field.label || field.label.trim() === "") {
          throw new BadRequestException("Header field label is required");
        }
        if (!field.inputType || !validInputTypes.includes(field.inputType)) {
          throw new BadRequestException(
            `Header field inputType is required and must be one of: ${validInputTypes.join(", ")}`,
          );
        }
        // If inputType is "select", options must be provided
        if (field.inputType === "select" && (!field.options || !Array.isArray(field.options) || field.options.length === 0)) {
          throw new BadRequestException("Header field options are required when inputType is 'select'");
        }
      }
    }

    // Validate equipment items if provided
    if (createTemplateDto.equipmentItems) {
      for (const equipment of createTemplateDto.equipmentItems) {
        if (!equipment.id || equipment.id.trim() === "") {
          throw new BadRequestException("Equipment item id is required");
        }
        if (!equipment.label || equipment.label.trim() === "") {
          throw new BadRequestException("Equipment item label is required");
        }
        // Fields are required
        if (!equipment.fields || !Array.isArray(equipment.fields) || equipment.fields.length === 0) {
          throw new BadRequestException("Equipment item fields are required and must include at least one field");
        }
        // Validate equipment fields
        for (const field of equipment.fields) {
          if (!field.key || field.key.trim() === "") {
            throw new BadRequestException("Equipment field key is required");
          }
          if (!field.label || field.label.trim() === "") {
            throw new BadRequestException("Equipment field label is required");
          }
          if (!field.inputType || !["text", "number"].includes(field.inputType)) {
            throw new BadRequestException("Equipment field inputType must be 'text' or 'number'");
          }
        }
        if (equipment.hasPrice === undefined || equipment.hasPrice === null) {
          throw new BadRequestException("Equipment item hasPrice is required");
        }
        if (equipment.hasQuantity === undefined || equipment.hasQuantity === null) {
          throw new BadRequestException("Equipment item hasQuantity is required");
        }
        if (equipment.hasDiscount === undefined || equipment.hasDiscount === null) {
          throw new BadRequestException("Equipment item hasDiscount is required");
        }
        // If applyTaxes is true, taxRate should be provided
        if (equipment.applyTaxes === true && (equipment.taxRate === undefined || equipment.taxRate === null)) {
          throw new BadRequestException("Equipment item taxRate is required when applyTaxes is true");
        }
      }
    }

    // Validate items if provided
    if (createTemplateDto.items) {
      for (const item of createTemplateDto.items) {
        if (!item.id || item.id.trim() === "") {
          throw new BadRequestException("Item id is required");
        }
        if (!item.label || item.label.trim() === "") {
          throw new BadRequestException("Item label is required");
        }
        if (item.hasPrice === undefined || item.hasPrice === null) {
          throw new BadRequestException("Item hasPrice is required");
        }
        if (item.hasQuantity === undefined || item.hasQuantity === null) {
          throw new BadRequestException("Item hasQuantity is required");
        }
        if (item.hasDiscount === undefined || item.hasDiscount === null) {
          throw new BadRequestException("Item hasDiscount is required");
        }
        // applyTemplateDiscount and applyTaxes are optional, but if applyTaxes is true, taxRate should be provided
        if (item.applyTaxes === true && (item.taxRate === undefined || item.taxRate === null)) {
          throw new BadRequestException("Item taxRate is required when applyTaxes is true");
        }
      }
    }

    // Set default visibility fields if not provided
    const showAgentToClient = createTemplateDto.showAgentToClient !== undefined ? createTemplateDto.showAgentToClient : true;
    const showCarrierToClient = createTemplateDto.showCarrierToClient !== undefined ? createTemplateDto.showCarrierToClient : true;
    const showCommodityToClient = createTemplateDto.showCommodityToClient !== undefined ? createTemplateDto.showCommodityToClient : true;
    const showNotesToClient = createTemplateDto.showNotesToClient !== undefined ? createTemplateDto.showNotesToClient : true;

    const template = new this.templateModel({
      ...createTemplateDto,
      companyId: user.company,
      createdBy: new Types.ObjectId(userId),
      showAgentToClient,
      showCarrierToClient,
      showCommodityToClient,
      showNotesToClient,
      isActive: createTemplateDto.isActive !== undefined ? createTemplateDto.isActive : true,
    });

    const saved = await template.save();

    await this.historyService.log({
      action: "create",
      entityType: "template",
      entityId: saved._id.toString(),
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Template "${saved.name}" created`,
      after: saved,
    });

    return TemplateSerializer.toCreateResponse(saved);
  }

  async findAll(
    userId: string,
    filters?: {
      serviceType?: string;
      category?: string;
      shippingMode?: string;
      isActive?: boolean;
    },
  ) {
    // Verify user exists
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Build query filter
    const queryFilter: any = { companyId: user.company };

    // Apply serviceType filter
    if (filters?.serviceType) {
      queryFilter.serviceType = filters.serviceType;
    }

    // Apply category filter
    if (filters?.category) {
      queryFilter.category = filters.category;
    }

    // Apply shippingMode filter (check if shippingModes array contains the value)
    if (filters?.shippingMode) {
      queryFilter.shippingModes = { $in: [filters.shippingMode] };
    }

    // Apply isActive filter - default to true (only active templates) unless explicitly set
    if (filters?.isActive !== undefined) {
      queryFilter.isActive = filters.isActive;
    } else {
      // Default: only return active templates (soft delete filter)
      queryFilter.isActive = true;
    }

    // Get templates for user's company only with filters
    const templates = await this.templateModel
      .find(queryFilter)
      .populate("companyId", "name")
      .populate("createdBy", "firstName lastName email")
      .populate("updatedBy", "firstName lastName email")
      .lean()
      .exec();

    return templates.map((template) =>
      TemplateSerializer.toListResponse(template),
    );
  }

  async findOne(id: string, userId: string) {
    // Company access is already verified by TemplateAccessGuard
    // Just fetch the template with population for the response
    const template = await this.templateModel
      .findById(id)
      .populate("createdBy", "firstName lastName email")
      .populate("updatedBy", "firstName lastName email")
      .exec();

    if (!template) {
      throw new NotFoundException(`Template with id "${id}" not found`);
    }

    return TemplateSerializer.toResponse(template);
  }

  async update(
    id: string,
    updateTemplateDto: UpdateTemplateDto,
    userId: string,
    userEmail: string,
  ) {
    // Verify user exists
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const template = await this.templateModel.findById(id).exec();

    if (!template) {
      throw new NotFoundException(`Template with id "${id}" not found`);
    }

    // Verify company access
    if (template.companyId.toString() !== user.company.toString()) {
      throw new ForbiddenException(
        "You can only update templates from your own company",
      );
    }

    const before = template.toObject();

    // Validate category if provided (ICC 2020)
    if (updateTemplateDto.category) {
      const validCategories = [
        "EXW",
        "FCA",
        "FAS",
        "FOB",
        "CFR",
        "CIF",
        "CPT",
        "CIP",
        "DAP",
        "DPU",
        "DDP",
      ];
      if (!validCategories.includes(updateTemplateDto.category)) {
        throw new BadRequestException(
          `Invalid category: "${updateTemplateDto.category}". Valid values are: ${validCategories.join(", ")}`,
        );
      }
    }

    // Validate shipping modes if provided
    if (updateTemplateDto.shippingModes) {
      const validShippingModes = ["maritime", "air", "road"];
      if (!Array.isArray(updateTemplateDto.shippingModes) || updateTemplateDto.shippingModes.length === 0) {
        throw new BadRequestException("shippingModes must be an array with at least one value");
      }
      const invalidModes = updateTemplateDto.shippingModes.filter(
        (mode) => !validShippingModes.includes(mode),
      );
      if (invalidModes.length > 0) {
        throw new BadRequestException(
          `Invalid shippingModes values: ${invalidModes.join(", ")}. Valid values are: ${validShippingModes.join(", ")}`,
        );
      }
    }

    // Validate service type if provided
    if (updateTemplateDto.serviceType) {
      const validServiceTypes = [
        "FCL",
        "LCL",
        "AIR",
        "FTL",
        "INSURANCE",
        "CUSTOMS",
        "LOCAL_TRUCKING",
        "OTHER",
      ];
      if (!validServiceTypes.includes(updateTemplateDto.serviceType)) {
        throw new BadRequestException(
          `Invalid serviceType: "${updateTemplateDto.serviceType}". Valid values are: ${validServiceTypes.join(", ")}`,
        );
      }
    }

    if (updateTemplateDto.pricingConfig) {
      this.validatePriceConfiguration(updateTemplateDto.pricingConfig);
    }

    // Validate equipment items if provided
    if (updateTemplateDto.equipmentItems) {
      for (const equipment of updateTemplateDto.equipmentItems) {
        if (!equipment.id || equipment.id.trim() === "") {
          throw new BadRequestException("Equipment item id is required");
        }
        if (!equipment.label || equipment.label.trim() === "") {
          throw new BadRequestException("Equipment item label is required");
        }
        if (equipment.hasPrice !== undefined && equipment.hasPrice !== null && typeof equipment.hasPrice !== "boolean") {
          throw new BadRequestException("Equipment item hasPrice must be a boolean");
        }
        if (equipment.hasQuantity !== undefined && equipment.hasQuantity !== null && typeof equipment.hasQuantity !== "boolean") {
          throw new BadRequestException("Equipment item hasQuantity must be a boolean");
        }
        if (equipment.hasDiscount !== undefined && equipment.hasDiscount !== null && typeof equipment.hasDiscount !== "boolean") {
          throw new BadRequestException("Equipment item hasDiscount must be a boolean");
        }
        if (equipment.applyTemplateDiscount !== undefined && equipment.applyTemplateDiscount !== null && typeof equipment.applyTemplateDiscount !== "boolean") {
          throw new BadRequestException("Equipment item applyTemplateDiscount must be a boolean");
        }
        if (equipment.applyTaxes !== undefined && equipment.applyTaxes !== null && typeof equipment.applyTaxes !== "boolean") {
          throw new BadRequestException("Equipment item applyTaxes must be a boolean");
        }
        // If applyTaxes is true, taxRate should be provided
        if (equipment.applyTaxes === true && (equipment.taxRate === undefined || equipment.taxRate === null)) {
          throw new BadRequestException("Equipment item taxRate is required when applyTaxes is true");
        }
        // Fields are required if equipmentItems is provided
        if (!equipment.fields || !Array.isArray(equipment.fields) || equipment.fields.length === 0) {
          throw new BadRequestException("Equipment item fields are required and must include at least one field");
        }
        // Validate equipment fields
        for (const field of equipment.fields) {
          if (!field.key || field.key.trim() === "") {
            throw new BadRequestException("Equipment field key is required");
          }
          if (!field.label || field.label.trim() === "") {
            throw new BadRequestException("Equipment field label is required");
          }
          if (!field.inputType || !["text", "number"].includes(field.inputType)) {
            throw new BadRequestException("Equipment field inputType must be 'text' or 'number'");
          }
        }
      }
    }

    // Validate items if provided
    if (updateTemplateDto.items) {
      for (const item of updateTemplateDto.items) {
        if (!item.id || item.id.trim() === "") {
          throw new BadRequestException("Item id is required");
        }
        if (!item.label || item.label.trim() === "") {
          throw new BadRequestException("Item label is required");
        }
        if (item.hasPrice !== undefined && item.hasPrice !== null && typeof item.hasPrice !== "boolean") {
          throw new BadRequestException("Item hasPrice must be a boolean");
        }
        if (item.hasQuantity !== undefined && item.hasQuantity !== null && typeof item.hasQuantity !== "boolean") {
          throw new BadRequestException("Item hasQuantity must be a boolean");
        }
        if (item.hasDiscount !== undefined && item.hasDiscount !== null && typeof item.hasDiscount !== "boolean") {
          throw new BadRequestException("Item hasDiscount must be a boolean");
        }
        if (item.applyTemplateDiscount !== undefined && item.applyTemplateDiscount !== null && typeof item.applyTemplateDiscount !== "boolean") {
          throw new BadRequestException("Item applyTemplateDiscount must be a boolean");
        }
        if (item.applyTaxes !== undefined && item.applyTaxes !== null && typeof item.applyTaxes !== "boolean") {
          throw new BadRequestException("Item applyTaxes must be a boolean");
        }
        // If applyTaxes is true, taxRate should be provided
        if (item.applyTaxes === true && (item.taxRate === undefined || item.taxRate === null)) {
          throw new BadRequestException("Item taxRate is required when applyTaxes is true");
        }
      }
    }

    // Exclude companyId from updates (security: companyId should never be changed)
    const { companyId, ...updateData } = updateTemplateDto as any;

    const updated = await this.templateModel
      .findByIdAndUpdate(
        id,
        {
          ...updateData,
          updatedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .populate("companyId", "name")
      .populate("createdBy", "firstName lastName email")
      .populate("updatedBy", "firstName lastName email")
      .exec();

    const diff: Record<string, { from: any; to: any }> = {};
    for (const key of Object.keys(updateTemplateDto)) {
      if (before[key] !== (updated as any)[key]) {
        diff[key] = { from: before[key], to: (updated as any)[key] };
      }
    }

    await this.historyService.log({
      action: "update",
      entityType: "template",
      entityId: id,
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Template "${template.name}" updated`,
      before,
      after: updated,
      diff,
    });

    return TemplateSerializer.toResponse(updated);
  }

  async remove(id: string, userId: string, userEmail: string) {
    // Verify user exists
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const template = await this.templateModel.findById(id).exec();

    if (!template) {
      throw new NotFoundException(`Template with id "${id}" not found`);
    }

    // Verify company access
    if (template.companyId.toString() !== user.company.toString()) {
      throw new ForbiddenException(
        "You can only delete templates from your own company",
      );
    }

    // Soft delete: set isActive = false
    const before = template.toObject();
    const updated = await this.templateModel
      .findByIdAndUpdate(
        id,
        {
          isActive: false,
          updatedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();

    await this.historyService.log({
      action: "delete",
      entityType: "template",
      entityId: id,
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Template "${template.name}" soft deleted (isActive = false)`,
      before,
      after: updated,
    });
  }

  private validatePriceConfiguration(
    config?: TemplatePricingConfigDto | Template["pricingConfig"],
  ) {
    if (!config) {
      throw new BadRequestException("Price configuration is required");
    }

    if (
      typeof config.currency !== "string" ||
      config.currency.trim().length === 0
    ) {
      throw new BadRequestException("Price configuration currency is required");
    }

    if (
      config.templatePrice !== undefined &&
      config.templatePrice !== null &&
      (typeof config.templatePrice !== "number" ||
        Number.isNaN(config.templatePrice) ||
        config.templatePrice < 0)
    ) {
      throw new BadRequestException(
        "templatePrice must be a valid non-negative number",
      );
    }

    if (
      config.templateDiscount !== undefined &&
      config.templateDiscount !== null
    ) {
      if (
        typeof config.templateDiscount !== "number" ||
        Number.isNaN(config.templateDiscount)
      ) {
        throw new BadRequestException("templateDiscount must be a number");
      }
      if (config.templateDiscount < 0 || config.templateDiscount > 100) {
        throw new BadRequestException(
          "templateDiscount must be between 0 and 100",
        );
      }
    }

    if (
      config.applyTemplateDiscount !== undefined &&
      config.applyTemplateDiscount !== null &&
      typeof config.applyTemplateDiscount !== "boolean"
    ) {
      throw new BadRequestException(
        "applyTemplateDiscount must be a boolean value",
      );
    }

    if (
      config.templateTaxRate !== undefined &&
      config.templateTaxRate !== null
    ) {
      if (
        typeof config.templateTaxRate !== "number" ||
        Number.isNaN(config.templateTaxRate)
      ) {
        throw new BadRequestException("templateTaxRate must be a number");
      }
      if (config.templateTaxRate < 0 || config.templateTaxRate > 100) {
        throw new BadRequestException(
          "templateTaxRate must be between 0 and 100",
        );
      }
    }

    if (
      config.applyTemplateTaxes !== undefined &&
      config.applyTemplateTaxes !== null &&
      typeof config.applyTemplateTaxes !== "boolean"
    ) {
      throw new BadRequestException(
        "applyTemplateTaxes must be a boolean value",
      );
    }
  }
}

