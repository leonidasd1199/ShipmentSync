import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Office, OfficeDocument } from "../schemas/office.schema";
import { Company, CompanyDocument } from "../schemas/company.schema";
import { User, UserDocument } from "../schemas/user.schema";
import { AuthService } from "../auth/auth.service";
import { RoleCode } from "../common/enums/role.enum";
import { MailService } from "../mail/mail.service";
import bcrypt from "bcryptjs";
import { generateRandomPassword } from "../common/utils/password.util";
import { HistoryService } from "../history/history.service";
import { CreateOfficeDto, UpdateOfficeDto } from "./dto";
import type { OfficeInvoicingInputDto } from "./dto/office-invoicing.dto";
import { OfficeSerializer } from "./serializers";

@Injectable()
export class OfficesService {
  private readonly logger = new Logger(OfficesService.name);

  constructor(
    @InjectModel(Office.name) private officeModel: Model<OfficeDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => AuthService)) private authService: AuthService,
    private mailService: MailService,
    private historyService: HistoryService
  ) {}

  private normalizeInvoicingInput(
    invoicing: OfficeInvoicingInputDto | undefined,
  ): OfficeInvoicingInputDto | undefined {
    if (!invoicing) return undefined;
    return {
      ...invoicing,
      cai: invoicing.cai?.trim() || undefined,
      ein: invoicing.ein.trim(),
      email: invoicing.email.trim(),
      address: {
        street: invoicing.address.street.trim(),
        city: invoicing.address.city.trim(),
        state: invoicing.address.state.trim(),
        zipCode: invoicing.address.zipCode.trim(),
        country: invoicing.address.country.trim(),
      },
      invoiceRange: {
        from: invoicing.invoiceRange.from,
        to: invoicing.invoiceRange.to,
      },
    };
  }

  private assertInvoiceRangeOrder(from: number, to: number): void {
    if (from > to) {
      throw new BadRequestException(
        "Invoice range is invalid: 'from' must be less than or equal to 'to'.",
      );
    }
  }

  /**
   * When invoices were already issued, the configured range can only move forward:
   * - next number must start at lastUsedInvoiceNumber + 1 or later
   * - upper bound cannot shrink (extend forward only)
   */
  private assertInvoicingRangeUpdateAllowed(
    existing: OfficeDocument,
    incoming: OfficeInvoicingInputDto,
  ): void {
    const prev = existing.invoicing;
    const lastUsed = prev?.lastUsedInvoiceNumber;
    const nextFrom = incoming.invoiceRange.from;
    const nextTo = incoming.invoiceRange.to;

    this.assertInvoiceRangeOrder(nextFrom, nextTo);

    if (lastUsed == null || lastUsed < 1) {
      return;
    }

    const minFrom = lastUsed + 1;
    if (nextFrom < minFrom) {
      throw new BadRequestException({
        message:
          "Invoices have already been generated within this range. The range must start at the next available number.",
        lastUsedInvoiceNumber: lastUsed,
        minInvoiceFrom: minFrom,
      });
    }

    if (nextTo < lastUsed) {
      throw new BadRequestException({
        message:
          "Invoices have already been generated within this range. The upper bound cannot be below the last issued invoice number.",
        lastUsedInvoiceNumber: lastUsed,
      });
    }

    const prevTo = prev?.invoiceRange?.to;
    if (prevTo != null && nextTo < prevTo) {
      throw new BadRequestException({
        message:
          "Invoices have already been generated within this range. You can only extend the invoice range forward (increase the upper bound).",
        previousInvoiceRangeTo: prevTo,
      });
    }
  }

  async create(createOfficeDto: CreateOfficeDto, userId: string) {
        // Verify the company exists
    const company = await this.companyModel.findById(createOfficeDto.companyId);
    if (!company) {
      throw new NotFoundException("Company not found");
    }

        // Get user to verify company access
    // Permission check is handled by PermissionGuard at controller level
    const user = await this.userModel.findById(userId).exec();
    
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Check if user belongs to the company
    if (user.company.toString() !== createOfficeDto.companyId) {
      throw new ForbiddenException(
        "You can only create offices for your own company"
      );
    }

    const { companyId, invoicing: rawInvoicing, ...officeFields } =
      createOfficeDto;
    const invoicing = this.normalizeInvoicingInput(rawInvoicing);
    if (invoicing) {
      this.assertInvoiceRangeOrder(
        invoicing.invoiceRange.from,
        invoicing.invoiceRange.to,
      );
    }

    const office = new this.officeModel({
      ...officeFields,
      company: new Types.ObjectId(companyId),
      ...(invoicing ? { invoicing } : {}),
    });

    const saved = await office.save();

    await this.historyService.log({
      action: "create",
      entityType: "office",
      entityId: saved._id.toString(),
      actorUserId: userId,
      actorEmail: user.email,
      actorName: `${user.firstName} ${user.lastName}`,
      origin: "api",
      status: "success",
      summary: `Office "${saved.name}" created`,
      after: saved,
      companyId: user.company.toString(),
    });

    // Return the created office using serializer
    return OfficeSerializer.toResponse(saved);
  }

  async findAll(userId: string) {
        // Permission check is handled by PermissionGuard at controller level
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

        // Return offices for user's company only
    const offices = await this.officeModel
      .find({ company: user.company })
      .populate("company", "name")
      .exec();

    // Format response using serializer
    return offices.map((office) => OfficeSerializer.toListResponse(office));
  }

  async getOfficesByCompany(companyId: string, userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate("permissions")
      .exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

        // Check if user belongs to the company
    if (user.company.toString() !== companyId) {
      throw new ForbiddenException(
        "You can only view offices for your own company"
      );
    }

        // Permission check is handled by PermissionGuard at controller level
    const offices = await this.officeModel
      .find({ company: companyId })
      .populate("company", "name")
      .exec();

    // Format response using serializer
    return offices.map((office) => OfficeSerializer.toListResponse(office));
  }

  async findOne(id: string, userId: string) {
        // Permission check is handled by PermissionGuard at controller level
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const office = await this.officeModel
      .findById(id)
      .populate("company", "name")
      .exec();

    if (!office) {
      throw new NotFoundException("Office not found");
    }

        // Check if user belongs to the same company as the office
    if (user.company.toString() !== office.company._id.toString()) {
      throw new ForbiddenException(
        "You can only view offices from your own company",
      );
    }

    // Return the office using serializer
    return OfficeSerializer.toResponse(office);
  }

  async update(id: string, updateOfficeDto: UpdateOfficeDto, userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate("permissions")
      .exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

        // Permission check is handled by PermissionGuard at controller level
    const office = await this.officeModel.findById(id).exec();

    if (!office) {
      throw new NotFoundException("Office not found");
    }

        // Check if user belongs to the same company as the office
    if (user.company.toString() !== office.company.toString()) {
      throw new ForbiddenException(
        "You can only update offices from your own company",
      );
    }

    const before = office.toObject();
        // Prepare update object
    const updateData: any = { ...updateOfficeDto };

    if (updateData.invoicing !== undefined) {
      const normalized = this.normalizeInvoicingInput(updateData.invoicing);
      if (normalized) {
        this.assertInvoicingRangeUpdateAllowed(office, normalized);
        updateData.invoicing = {
          ...normalized,
          ...(office.invoicing?.lastUsedInvoiceNumber != null
            ? {
                lastUsedInvoiceNumber: office.invoicing.lastUsedInvoiceNumber,
              }
            : {}),
        };
      } else {
        delete updateData.invoicing;
      }
    }

        // If updating company, verify the new company exists and user belongs to it
    if (updateOfficeDto.companyId) {
      const newCompany = await this.companyModel.findById(
        updateOfficeDto.companyId,
      );
      if (!newCompany) {
        throw new NotFoundException("Company not found");
      }

      if (user.company.toString() !== updateOfficeDto.companyId) {
        throw new ForbiddenException(
          "You can only move offices within your own company"
        );
      }

            // Convert companyId to ObjectId
      updateData.company = new Types.ObjectId(updateOfficeDto.companyId);
      delete updateData.companyId; // Remove companyId as it's not part of schema
    }

    const updated = await this.officeModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate("company", "name")
      .exec();

    const diff: Record<string, { from: any; to: any }> = {};
    for (const key of Object.keys(updateData)) {
      if (before[key] !== (updated as any)[key]) {
        diff[key] = { from: before[key], to: (updated as any)[key] };
      }
    }

    await this.historyService.log({
      action: "update",
      entityType: "office",
      entityId: id,
      actorUserId: userId,
      actorEmail: user.email,
      actorName: `${user.firstName} ${user.lastName}`,
      origin: "api",
      status: "success",
      summary: `Office "${office.name}" updated`,
      before,
      after: updated,
      diff,
      companyId: user.company.toString(),
    });

    // Return the updated office using serializer
    return OfficeSerializer.toResponse(updated);
  }

  async remove(id: string, userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate("permissions")
      .exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

        // Permission check is handled by PermissionGuard at controller level
    const office = await this.officeModel.findById(id).exec();

    if (!office) {
      throw new NotFoundException("Office not found");
    }

        // Check if user belongs to the same company as the office
    if (user.company.toString() !== office.company.toString()) {
      throw new ForbiddenException(
        "You can only delete offices from your own company",
      );
    }

    await this.officeModel.findByIdAndDelete(id).exec();

    await this.historyService.log({
      action: "delete",
      entityType: "office",
      entityId: id,
      actorUserId: userId,
      actorEmail: user.email,
      actorName: `${user.firstName} ${user.lastName}`,
      origin: "api",
      status: "success",
      summary: `Office "${office.name}" deleted`,
      before: office,
      companyId: user.company.toString(),
    });
  }

  async assignUsersToOffice(
    officeId: string,
    userIds: string[],
    currentUserId: string,
  ) {
        // Permission check is handled by PermissionGuard at controller level
    const user = await this.userModel.findById(currentUserId).exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const office = await this.officeModel.findById(officeId).exec();

    if (!office) {
      throw new NotFoundException("Office not found");
    }

        // Check if user belongs to the same company as the office
    if (user.company.toString() !== office.company.toString()) {
      throw new ForbiddenException(
        "You can only assign users to offices in your own company",
      );
    }

        // Verify all users exist and belong to the same company
    const users = await this.userModel
      .find({
        _id: { $in: userIds },
        company: user.company,
      })
      .exec();

    if (users.length !== userIds.length) {
      throw new BadRequestException(
        "Some users not found or don't belong to your company",
      );
    }

        // Update users to include this office
    // Set office_disabled to false when assigning users to office
    await this.userModel.updateMany(
      { _id: { $in: userIds } },
      {
        $addToSet: { offices: new Types.ObjectId(officeId) },
        $set: { office_disabled: false },
      },
    );

    await this.historyService.log({
      action: "assign_users",
      entityType: "office",
      entityId: officeId,
      actorUserId: currentUserId,
      actorEmail: user.email,
      actorName: `${user.firstName} ${user.lastName}`,
      origin: "api",
      status: "success",
      summary: `Assigned ${users.length} users to office "${office.name}"`,
      companyId: user.company.toString(),
      after: { userIds },
    });

    return { message: "Users assigned to office successfully" };
  }

  async removeUsersFromOffice(
    officeId: string,
    userId: string,
    currentUserId: string,
  ) {
        // Permission check is handled by PermissionGuard at controller level
    const currentUser = await this.userModel.findById(currentUserId).exec();

    if (!currentUser) {
      throw new NotFoundException("Current user not found");
    }

    const office = await this.officeModel.findById(officeId).exec();

    if (!office) {
      throw new NotFoundException("Office not found");
    }

        // Check if user belongs to the same company as the office
    if (currentUser.company.toString() !== office.company.toString()) {
      throw new ForbiddenException(
        "You can only disable users from offices in your own company",
      );
    }

        // Find the user to disable
    const userToDisable = await this.userModel.findById(userId).exec();

    if (!userToDisable) {
      throw new NotFoundException("User to disable not found");
    }

        // Check if the user to disable belongs to the same company
    if (userToDisable.company.toString() !== office.company.toString()) {
      throw new ForbiddenException(
        "You can only disable users from your own company",
      );
    }

        // Set office_disabled to true
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { office_disabled: true },
    });

    await this.historyService.log({
      action: "remove_user",
      entityType: "office",
      entityId: officeId,
      actorUserId: currentUserId,
      actorEmail: currentUser.email,
      actorName: `${currentUser.firstName} ${currentUser.lastName}`,
      origin: "api",
      status: "success",
      summary: `Disabled user "${userToDisable.email}" from office "${office.name}"`,
      companyId: currentUser.company.toString(),
      targetId: userId,
      targetType: "user",
    });

    return { message: "User disabled from office successfully" };
  }

  async getOfficeUsers(
    officeId: string,
    currentUserId: string,
    includeDisabled: boolean = false,
  ) {
        // Permission check is handled by PermissionGuard at controller level
    const user = await this.userModel.findById(currentUserId).exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const office = await this.officeModel.findById(officeId).exec();

    if (!office) {
      throw new NotFoundException("Office not found");
    }

        // Check if user belongs to the same company as the office
    if (user.company.toString() !== office.company.toString()) {
      throw new ForbiddenException(
        "You can only view users from offices in your own company",
      );
    }
    
        // Build query filter
    // Convert officeId to ObjectId for proper matching
    const queryFilter: any = {
      offices: new Types.ObjectId(officeId),
      company: user.company,
    };

        // Only filter by active status if includeDisabled is false
    if (!includeDisabled) {
      queryFilter.isActive = true;
            // Also exclude users that are disabled from this office
      queryFilter.office_disabled = { $ne: true };
    }

        // Find users assigned to this office
    const users = await this.userModel
      .find(queryFilter)
      .select(
        "firstName lastName email roleCode isActive office_disabled phone",
      )
      .populate("role", "name")
      .exec();

    return users;
  }

  async getDisabledUsers(officeId: string, currentUserId: string) {
        // Permission check is handled by PermissionGuard at controller level
    const currentUser = await this.userModel.findById(currentUserId).exec();

    if (!currentUser) {
      throw new NotFoundException("Current user not found");
    }

    const office = await this.officeModel.findById(officeId).exec();

    if (!office) {
      throw new NotFoundException("Office not found");
    }

        // Check if user belongs to the same company as the office
    if (currentUser.company.toString() !== office.company.toString()) {
      throw new ForbiddenException(
        "You can only view disabled users from offices in your own company",
      );
    }

        // Find users that are disabled from this office
    const disabledUsers = await this.userModel
      .find({
        offices: new Types.ObjectId(officeId),
        company: currentUser.company,
        office_disabled: true,
      })
      .select("firstName lastName email roleCode isActive office_disabled")
      .populate("role", "name")
      .exec();

    return disabledUsers;
  }

  async getCompanyUsers(companyId: string, currentUserId: string) {
        // Permission check is handled by PermissionGuard at controller level
    const currentUser = await this.userModel.findById(currentUserId).exec();

    if (!currentUser) {
      throw new NotFoundException("Current user not found");
    }

        // Verify company exists
    const company = await this.companyModel.findById(companyId).exec();

    if (!company) {
      throw new NotFoundException("Company not found");
    }

        // Check if user belongs to the same company
    if (currentUser.company.toString() !== companyId) {
      throw new ForbiddenException(
        "You can only view users from your own company",
      );
    }

        // Find all users that belong to this company
    const companyUsers = await this.userModel
      .find({
        company: new Types.ObjectId(companyId),
      })
      .select("firstName lastName email roleCode isActive office_disabled")
      .populate("role", "name")
      .exec();

    return companyUsers;
  }

  async assignNewUser(
    officeId: string,
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      roleCode?: string;
      phone?: string;
    },
    currentUserId: string,
  ) {
        // Permission check is handled by PermissionGuard at controller level
    const currentUser = await this.userModel.findById(currentUserId).exec();

    if (!currentUser) {
      throw new NotFoundException("Current user not found");
    }

    // Verify office exists
    const office = await this.officeModel.findById(officeId).exec();
    if (!office) {
      throw new NotFoundException("Office not found");
    }

    // Verify office belongs to current user's company
    if (currentUser.company.toString() !== office.company.toString()) {
      throw new ForbiddenException(
        "You can only assign users to offices in your own company",
      );
    }

    // Check if user already exists
    const existingUser = await this.userModel
      .findOne({ email: userData.email.toLowerCase() })
      .exec();

    if (existingUser) {
      throw new BadRequestException("User with this email already exists");
    }

    // Generate a random secure password
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // Get the current user's role for the new user
    const currentUserFull = await this.userModel.findById(currentUserId).exec();

    // Create user with required fields
    // Default roleCode to 'admin' if not provided
    const roleCode = userData.roleCode || RoleCode.ADMIN;

    const newUser = new this.userModel({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      roleCode: roleCode,
      role: currentUserFull?.role || new Types.ObjectId(),
      company: office.company,
      offices: [new Types.ObjectId(officeId)],
      permissions: [],
      isActive: true,
      phone: userData.phone,
      mustChangePassword: true,
    });

    const savedUser = await newUser.save();

       // Send welcome email with temporary password
       // Don't fail user creation if email fails
    try {
      await this.mailService.sendWelcomeEmail(
        savedUser.email,
        savedUser.firstName,
        randomPassword,
      );
    } catch (emailError) {
      this.logger.error(`Failed to send welcome email to ${savedUser.email}`, emailError);
    }

    await this.historyService.log({
      action: "create_and_assign_user",
      entityType: "office",
      entityId: officeId,
      actorUserId: currentUserId,
      actorEmail: currentUser.email,
      actorName: `${currentUser.firstName} ${currentUser.lastName}`,
      origin: "api",
      status: "success",
      summary: `Created and assigned user "${savedUser.email}" to office "${office.name}"`,
      companyId: currentUser.company.toString(),
      targetId: savedUser._id.toString(),
      targetType: "user",
      after: savedUser,
    });

    return savedUser;
  }
}
