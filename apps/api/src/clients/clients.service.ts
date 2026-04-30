import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, Model, Types } from "mongoose";
import { Client, ClientDocument } from "../schemas/client.schema";
import { User, UserDocument } from "../schemas/user.schema";
import { Office, OfficeDocument } from "../schemas/office.schema";
import { Company, CompanyDocument } from "../schemas/company.schema";
import {
  QuotationDelivery,
  QuotationDeliveryDocument,
} from "../schemas/quotation-delivery.schema";
import { Shipment, ShipmentDocument } from "../schemas/shipment.schema";
import { Role, RoleDocument } from "../schemas/role.schema";
import {
  PermissionModel,
  PermissionDocument,
} from "../schemas/permission.schema";
import { AccessVerificationService } from "../common/services/access-verification.service";
import { HistoryService } from "../history/history.service";
import { MailService } from "../mail/mail.service";
import {
  CreateClientDto,
  UpdateClientDto,
  ClientDateRangeQueryDto,
} from "./dto";
import { ClientSerializer } from "./serializers";
import { RoleCode } from "../common/enums/role.enum";
import { generateRandomPassword } from "../common/utils/password.util";
import bcrypt from "bcryptjs";

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);
  private static readonly CLIENT_PERMISSION_CODES = [
    "client:read",
    "client:list",
    "client:update-own",
  ] as const;

  constructor(
    @InjectModel(Client.name) private clientModel: Model<ClientDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Office.name) private officeModel: Model<OfficeDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(QuotationDelivery.name)
    private quotationDeliveryModel: Model<QuotationDeliveryDocument>,
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(PermissionModel.name)
    private permissionModel: Model<PermissionDocument>,
    private accessVerification: AccessVerificationService,
    private historyService: HistoryService,
    private mailService: MailService,
  ) {}

  async create(createClientDto: CreateClientDto, userId: string, userEmail: string) {
    // Verify office access (checks office exists and user belongs to same company)
    // Permission check is handled by PermissionGuard at controller level
    await this.accessVerification.verifyOfficeAccess(
      userId,
      createClientDto.officeId,
    );

    const normalizedEmail = this.normalizeEmail(createClientDto.email);
    if (!normalizedEmail) {
      throw new BadRequestException("Client email is required");
    }
    const transactionResult = await this.runWithOptionalTransaction(async (session) => {
      if (!session) {
        await this.assertClientAndUserEmailAvailable(normalizedEmail);
        const { officeId, ...clientData } = createClientDto;
        const [createdClient] = await this.clientModel.create([
          {
            ...clientData,
            email: normalizedEmail,
            office: new Types.ObjectId(officeId),
          },
        ]);
        const fallbackWelcomePayload = await this.createLinkedClientUser(
          createdClient,
          createClientDto,
          normalizedEmail,
        );
        return {
          savedClientId: createdClient._id,
          welcomeEmailPayload: fallbackWelcomePayload,
        };
      }

      return await session.withTransaction(async () => {
        await this.assertClientAndUserEmailAvailable(normalizedEmail, session);

        const { officeId, ...clientData } = createClientDto;
        const [createdClient] = await this.clientModel.create(
          [
            {
              ...clientData,
              ...(normalizedEmail ? { email: normalizedEmail } : {}),
              office: new Types.ObjectId(officeId),
            },
          ],
          { session },
        );
        const transactionWelcomePayload = await this.createLinkedClientUser(
          createdClient,
          createClientDto,
          normalizedEmail,
          session,
        );
        return {
          savedClientId: createdClient._id,
          welcomeEmailPayload: transactionWelcomePayload,
        };
      });
    });

    if (!transactionResult?.savedClientId) {
      throw new BadRequestException("Failed to create client");
    }
    const savedClient = await this.clientModel.findById(transactionResult.savedClientId).exec();
    if (!savedClient) {
      throw new BadRequestException("Client was not found after creation");
    }
    const welcomeEmailPayload = transactionResult.welcomeEmailPayload;

    await this.historyService.log({
      action: "create",
      entityType: "client",
      entityId: savedClient._id.toString(),
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Client "${savedClient.name}" created`,
      after: savedClient,
    });

    this.logger.log(
      `Sending welcome email to ${welcomeEmailPayload.email} for client ${savedClient._id.toString()}.`,
    );
    try {
      await this.mailService.sendWelcomeEmail(
        welcomeEmailPayload.email,
        welcomeEmailPayload.firstName,
        welcomeEmailPayload.randomPassword,
      );
      this.logger.log(`Welcome email sent to ${welcomeEmailPayload.email}.`);
    } catch (emailError) {
      this.logger.error(
        `Failed to send welcome email to ${welcomeEmailPayload.email}:`,
        emailError instanceof Error ? emailError.message : String(emailError),
      );
    }

    // Return the created client using serializer
    return ClientSerializer.toResponse(savedClient);
  }

  private normalizeEmail(email?: string): string | undefined {
    if (typeof email !== "string") {
      return undefined;
    }
    const normalizedEmail = email.trim().toLowerCase();
    return normalizedEmail || undefined;
  }

  private async assertClientAndUserEmailAvailable(
    normalizedEmail?: string,
    session?: ClientSession,
  ): Promise<void> {
    if (!normalizedEmail) {
      return;
    }

    const existingClientByEmailQuery = this.clientModel
      .findOne({ email: normalizedEmail })
      .select("_id")
      .lean();
    if (session) {
      existingClientByEmailQuery.session(session);
    }
    const existingClientByEmail = await existingClientByEmailQuery.exec();
    if (existingClientByEmail) {
      throw new BadRequestException(
        `A client with email "${normalizedEmail}" already exists`,
      );
    }

    const existingUserByEmailQuery = this.userModel
      .findOne({ email: normalizedEmail })
      .select("_id")
      .lean();
    if (session) {
      existingUserByEmailQuery.session(session);
    }
    const existingUserByEmail = await existingUserByEmailQuery.exec();
    if (existingUserByEmail) {
      throw new BadRequestException(
        `A user with email "${normalizedEmail}" already exists`,
      );
    }
  }

  private async createLinkedClientUser(
    savedClient: ClientDocument,
    createClientDto: CreateClientDto,
    normalizedEmail: string,
    session?: ClientSession,
  ): Promise<{ email: string; firstName: string; randomPassword: string }> {
    const officeQuery = this.officeModel.findById(createClientDto.officeId).lean();
    if (session) {
      officeQuery.session(session);
    }
    const office = await officeQuery.exec();
    if (!office) {
      throw new BadRequestException(
        `Office "${createClientDto.officeId}" not found for client user creation`,
      );
    }

    const clientRoleQuery = this.roleModel.findOne({ code: RoleCode.CLIENT });
    if (session) {
      clientRoleQuery.session(session);
    }
    const clientRole = await clientRoleQuery.exec();
    if (!clientRole) {
      throw new BadRequestException("Client role not found");
    }

    const permissionsQuery = this.permissionModel.find({
      code: { $in: [...ClientsService.CLIENT_PERMISSION_CODES] },
    });
    if (session) {
      permissionsQuery.session(session);
    }
    const permissions = await permissionsQuery.exec();

    const { randomPassword, userPayload } = await this.buildClientUserPayload(
      savedClient,
      createClientDto,
      normalizedEmail,
      office,
      clientRole._id,
      permissions.map((p) => p._id),
    );

    if (session) {
      await this.userModel.create([userPayload], { session });
    } else {
      await this.userModel.create(userPayload);
    }

    return {
      email: normalizedEmail,
      firstName: userPayload.firstName,
      randomPassword,
    };
  }

  private async buildClientUserPayload(
    savedClient: ClientDocument,
    createClientDto: CreateClientDto,
    normalizedEmail: string,
    office: { company?: Types.ObjectId | string | null },
    roleId: Types.ObjectId,
    permissionIds: Types.ObjectId[],
  ): Promise<{
    randomPassword: string;
    userPayload: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      roleCode: RoleCode;
      role: Types.ObjectId;
      company?: Types.ObjectId | string | null;
      offices: Types.ObjectId[];
      permissions: Types.ObjectId[];
      client: Types.ObjectId;
      mustChangePassword: boolean;
      isActive: boolean;
    };
  }> {
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const nameParts = (savedClient.name || "").trim().split(/\s+/).filter(Boolean);
    const firstName = createClientDto.contactPerson?.trim() || nameParts[0] || "Client";
    const lastNameRaw =
      createClientDto.contactPerson && createClientDto.contactPerson !== firstName
        ? ""
        : nameParts.slice(1).join(" ").trim() || "";
    const lastName = lastNameRaw || ".";

    return {
      randomPassword,
      userPayload: {
        firstName,
        lastName,
        email: normalizedEmail,
        password: hashedPassword,
        roleCode: RoleCode.CLIENT,
        role: roleId,
        company: office.company,
        offices: [new Types.ObjectId(createClientDto.officeId)],
        permissions: permissionIds,
        client: savedClient._id,
        mustChangePassword: true,
        isActive: true,
      },
    };
  }

  async findAll(userId: string) {
    // Permission check is handled by PermissionGuard at controller level
    const user = await this.userModel
      .findById(userId)
      .select("offices roleCode client")
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Client-role users can only see their linked client (if any)
    if (user.roleCode === RoleCode.CLIENT && user.client) {
      const client = await this.clientModel
        .findOne({ _id: user.client, isActive: true })
        .populate("office", "name")
        .lean()
        .exec();
      return client ? [ClientSerializer.toListResponse(client)] : [];
    }

    const officeIds: Types.ObjectId[] = (user.offices ?? []).filter(Boolean);

    const clients = await this.clientModel
      .find({ office: { $in: officeIds }, isActive: true })
      .populate("office", "name")
      .lean()
      .exec();

    // Format response using serializer
    return clients.map((client) => ClientSerializer.toListResponse(client));
  }

  async findOne(id: string, userId: string) {
    // Permission check is handled by PermissionGuard at controller level
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const client = await this.clientModel.findById(id).exec();
    this.assertClientIsActive(client);

    // Client-role users can only access their linked client
    if (user.roleCode === RoleCode.CLIENT) {
      if (!user.client || user.client.toString() !== id) {
        throw new ForbiddenException(
          "You can only access your own client information",
        );
      }
      return ClientSerializer.toResponse(client);
    }

    // Verify office access (checks office exists and user belongs to same company)
    await this.accessVerification.verifyOfficeAccess(userId, client.office);

    // Return the client using serializer
    return ClientSerializer.toResponse(client);
  }

  async update(
    id: string,
    updateClientDto: UpdateClientDto,
    userId: string,
    userEmail: string,
  ) {
    // Permission check is handled by PermissionGuard at controller level
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const client = await this.clientModel.findById(id).exec();
    this.assertClientIsActive(client);

    // Client-role users can only update their own linked client
    if (user.roleCode === RoleCode.CLIENT) {
      if (!user.client || user.client.toString() !== id) {
        throw new ForbiddenException(
          "You can only update your own client information",
        );
      }
      // Allow: same client; skip office verification below
    } else {
      // Non-client (operator/admin): verify office access
      await this.accessVerification.verifyOfficeAccess(userId, client.office);
    }

    const hasEmailInPayload = Object.prototype.hasOwnProperty.call(
      updateClientDto,
      "email",
    );
    const normalizedEmail = this.normalizeEmail(updateClientDto.email);
    if (hasEmailInPayload && !normalizedEmail) {
      throw new BadRequestException("Client email cannot be blank");
    }

    const updatePayload: UpdateClientDto = {
      ...updateClientDto,
      ...(hasEmailInPayload ? { email: normalizedEmail } : {}),
    };

    const before = client.toObject();
    let updated: ClientDocument | null = null;

    if (hasEmailInPayload && normalizedEmail) {
      updated = await this.updateClientAndLinkedUserEmailTransactional(
        client._id,
        id,
        updatePayload,
        normalizedEmail,
      );
    } else {
      updated = await this.clientModel
        .findByIdAndUpdate(id, updatePayload, { new: true })
        .exec();
    }

    const diff: Record<string, { from: any; to: any }> = {};
    for (const key of Object.keys(updatePayload)) {
      if (before[key] !== (updated as any)[key]) {
        diff[key] = { from: before[key], to: (updated as any)[key] };
      }
    }

    await this.historyService.log({
      action: "update",
      entityType: "client",
      entityId: id,
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Client "${client.name}" updated`,
      before,
      after: updated,
      diff,
    });

    // Return the updated client using serializer
    return ClientSerializer.toResponse(updated);
  }

  /**
   * Update the logged-in client user's own client record (for PATCH /clients/me).
   * Resolves client ID from user.client; only client-role users with client:update-own can call.
   */
  async updateOwnClient(
    userId: string,
    userEmail: string,
    updateClientDto: UpdateClientDto,
  ) {
    const clientId = await this.getClientIdForUser(userId);
    return this.update(clientId.toString(), updateClientDto, userId, userEmail);
  }

  async remove(id: string, userId: string, userEmail: string) {
    // Permission check is handled by PermissionGuard at controller level
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const client = await this.clientModel.findById(id).exec();
    this.assertClientIsActive(client);

    // Client-role users cannot delete clients
    if (user.roleCode === RoleCode.CLIENT) {
      throw new ForbiddenException(
        "Client-role users cannot delete client information",
      );
    }

    // Verify office access (checks office exists and user belongs to same company)
    await this.accessVerification.verifyOfficeAccess(userId, client.office);

    await this.clientModel
      .findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true },
      )
      .exec();

    await this.historyService.log({
      action: "delete",
      entityType: "client",
      entityId: id,
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Client "${client.name}" deleted`,
      before: client,
    });
  }

  /**
   * Resolve the client ID for the current user. Only client-role users with a linked client can access client-scoped endpoints.
   */
  async getClientIdForUser(userId: string): Promise<Types.ObjectId> {
    const user = await this.userModel
      .findById(userId)
      .select("roleCode client")
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (user.roleCode !== RoleCode.CLIENT || !user.client) {
      throw new ForbiddenException(
        "Only client users can access this resource",
      );
    }
    const client = await this.clientModel
      .findById(user.client)
      .select("_id isActive")
      .lean()
      .exec();
    if (!client || !client.isActive) {
      throw new NotFoundException("Client not found");
    }
    return user.client as Types.ObjectId;
  }

  /**
   * Build date filter for a field (inclusive range using start/end of day when needed).
   */
  private buildDateFilter(
    field: string,
    dateFrom?: string,
    dateTo?: string,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (dateFrom) {
      fromDate = new Date(dateFrom);
      if (Number.isNaN(fromDate.getTime())) {
        throw new BadRequestException("Invalid dateFrom");
      }
      fromDate.setUTCHours(0, 0, 0, 0);
      (filter as any)[field] = (filter as any)[field] || {};
      ((filter as any)[field] as any).$gte = fromDate;
    }
    if (dateTo) {
      toDate = new Date(dateTo);
      if (Number.isNaN(toDate.getTime())) {
        throw new BadRequestException("Invalid dateTo");
      }
      toDate.setUTCHours(23, 59, 59, 999);
      (filter as any)[field] = (filter as any)[field] || {};
      ((filter as any)[field] as any).$lte = toDate;
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException("dateFrom cannot be greater than dateTo");
    }
    return Object.keys(filter).length ? filter : {};
  }

  private assertClientIsActive(
    client: ClientDocument | null,
  ): asserts client is ClientDocument {
    if (!client || !client.isActive) {
      throw new NotFoundException("Client not found");
    }
  }

  private async assertEmailCanBeUsedForClientUpdate(
    clientId: Types.ObjectId,
    normalizedEmail: string,
    session?: ClientSession,
  ): Promise<{ linkedUserId: Types.ObjectId }> {
    const existingClientByEmailQuery = this.clientModel
      .findOne({ email: normalizedEmail, _id: { $ne: clientId } })
      .select("_id")
      .lean();
    if (session) {
      existingClientByEmailQuery.session(session);
    }
    const existingClientByEmail = await existingClientByEmailQuery.exec();
    if (existingClientByEmail) {
      throw new BadRequestException(
        `A client with email "${normalizedEmail}" already exists`,
      );
    }

    const linkedUserQuery = this.userModel
      .findOne({ client: clientId })
      .select("_id email")
      .lean();
    if (session) {
      linkedUserQuery.session(session);
    }
    const linkedUser = await linkedUserQuery.exec();
    if (!linkedUser) {
      throw new BadRequestException(
        "Client has no linked user; cannot sync email. Please relink or recreate the client user first.",
      );
    }

    const existingUserByEmailQuery = this.userModel
      .findOne({ email: normalizedEmail, _id: { $ne: linkedUser._id } })
      .select("_id")
      .lean();
    if (session) {
      existingUserByEmailQuery.session(session);
    }
    const existingUserByEmail = await existingUserByEmailQuery.exec();
    if (existingUserByEmail) {
      throw new BadRequestException(
        `A user with email "${normalizedEmail}" already exists`,
      );
    }

    return { linkedUserId: linkedUser._id as Types.ObjectId };
  }

  private async updateClientAndLinkedUserEmailTransactional(
    clientObjectId: Types.ObjectId,
    clientId: string,
    updatePayload: UpdateClientDto,
    normalizedEmail: string,
  ): Promise<ClientDocument> {
    const transactionResult = await this.runWithOptionalTransaction(async (session) => {
      if (!session) {
        const { linkedUserId } = await this.assertEmailCanBeUsedForClientUpdate(
          clientObjectId,
          normalizedEmail,
        );
        const updatedClient = await this.clientModel
          .findByIdAndUpdate(clientId, updatePayload, { new: true })
          .exec();
        if (!updatedClient) {
          throw new NotFoundException("Client not found");
        }
        const updatedUser = await this.userModel
          .findByIdAndUpdate(linkedUserId, { email: normalizedEmail }, { new: true })
          .exec();
        if (!updatedUser) {
          throw new BadRequestException(
            "Client has no linked user; cannot sync email. Please relink or recreate the client user first.",
          );
        }
        return { updatedClientId: updatedClient._id };
      }

      return await session.withTransaction(async () => {
        const { linkedUserId } = await this.assertEmailCanBeUsedForClientUpdate(
          clientObjectId,
          normalizedEmail,
          session,
        );

        const updatedClient = await this.clientModel
          .findByIdAndUpdate(clientId, updatePayload, { new: true, session })
          .exec();
        if (!updatedClient) {
          throw new NotFoundException("Client not found");
        }

        const updatedUser = await this.userModel
          .findByIdAndUpdate(
            linkedUserId,
            { email: normalizedEmail },
            { new: true, session },
          )
          .exec();
        if (!updatedUser) {
          throw new BadRequestException(
            "Client has no linked user; cannot sync email. Please relink or recreate the client user first.",
          );
        }

        return { updatedClientId: updatedClient._id };
      });
    });

    if (!transactionResult?.updatedClientId) {
      throw new BadRequestException("Failed to update client");
    }

    const updatedClient = await this.clientModel
      .findById(transactionResult.updatedClientId)
      .exec();
    this.assertClientIsActive(updatedClient);
    return updatedClient;
  }

  private isTransactionsNotSupportedError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }
    const candidate = error as { code?: unknown; codeName?: unknown; message?: unknown };
    const code = candidate.code;
    const codeName = candidate.codeName;
    const message =
      typeof candidate.message === "string" ? candidate.message : String(candidate.message ?? "");
    return (
      code === 20 ||
      codeName === "IllegalOperation" ||
      message.includes("Transaction numbers are only allowed on a replica set member or mongos")
    );
  }

  private async runWithOptionalTransaction<T>(
    work: (session?: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.clientModel.db.startSession();
    try {
      return await work(session);
    } catch (error) {
      if (!this.isTransactionsNotSupportedError(error)) {
        throw error;
      }
      this.logger.warn(
        "Mongo transactions are not supported in current deployment; using non-transactional fallback.",
      );
      return await work();
    } finally {
      await session.endSession();
    }
  }

  /**
   * Fetch quotation deliveries (price list / preciarios) for the logged-in client.
   * Source: quotation_deliveries. Filter by clientId and optional date range on sentAt.
   */
  async getPriceList(
    userId: string,
    query: ClientDateRangeQueryDto,
  ): Promise<
    Array<{
      _id?: Types.ObjectId;
      quotationSnapshot: Record<string, unknown>;
      sentAt: Date;
      sentBy: Types.ObjectId;
      operator?: {
        id: Types.ObjectId;
        email?: string;
        name?: string;
      };
      officeId?: Types.ObjectId;
    }>
  > {
    const clientId = await this.getClientIdForUser(userId);
    const baseFilter: Record<string, unknown> = {
      clientId,
      isActive: true,
    };
    const dateFilter = this.buildDateFilter(
      "sentAt",
      query.dateFrom,
      query.dateTo,
    );
    const filter = { ...baseFilter, ...dateFilter };

    const deliveries = await this.quotationDeliveryModel
      .find(filter)
      .sort({ sentAt: -1 })
      .select(
        "_id quotationSnapshot sentAt sentBy operator officeId",
      )
      .lean()
      .exec();
    return deliveries as Array<{
      _id?: Types.ObjectId;
      quotationSnapshot: Record<string, unknown>;
      sentAt: Date;
      sentBy: Types.ObjectId;
      operator?: {
        id: Types.ObjectId;
        email?: string;
        name?: string;
      };
      officeId?: Types.ObjectId;
    }>;
  }

  /**
   * Fetch shipments associated with the logged-in client (shipper, consignee, or quotation client).
   * Filter by optional date range on createdAt.
   */
  async getShipments(
    userId: string,
    query: ClientDateRangeQueryDto,
  ): Promise<Record<string, unknown>[]> {
    const clientId = await this.getClientIdForUser(userId);
    const baseFilter = {
      $or: [
        { "quotationSnapshot.clientId": clientId },
        { "parties.shipper.clientId": clientId },
        { "parties.consignee.clientId": clientId },
      ],
    };
    const dateFilter = this.buildDateFilter(
      "createdAt",
      query.dateFrom,
      query.dateTo,
    );
    const filter = Object.keys(dateFilter).length
      ? { ...baseFilter, ...dateFilter }
      : baseFilter;

    const shipments = await this.shipmentModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const shipmentList = shipments as Array<Record<string, unknown>>;

    const companyIds = Array.from(
      new Set(
        shipmentList
          .map((s) => (s.companyId ? s.companyId.toString() : undefined))
          .filter(Boolean),
      ),
    ).map((id) => new Types.ObjectId(id));

    const operatorIds = Array.from(
      new Set(
        shipmentList
          .map((s) => {
            const storedOperatorId = (s as any)?.operator?.id;
            if (storedOperatorId) {
              return storedOperatorId.toString();
            }
            const snapshotTakenBy = (s.quotationSnapshot as any)?.snapshotTakenBy;
            const createdBy = s.createdBy;
            const op = snapshotTakenBy || createdBy;
            return op ? op.toString() : undefined;
          })
          .filter(Boolean),
      ),
    ).map((id) => new Types.ObjectId(id));

    const clientIds = Array.from(
      new Set(
        shipmentList
          .map((s) => {
            const qsClient = (s.quotationSnapshot as any)?.clientId;
            const shipperClient = (s.parties as any)?.shipper?.clientId;
            const consigneeClient = (s.parties as any)?.consignee?.clientId;
            const c = qsClient || shipperClient || consigneeClient;
            return c ? c.toString() : undefined;
          })
          .filter(Boolean),
      ),
    ).map((id) => new Types.ObjectId(id));

    const [companies, operators, clients] = await Promise.all([
      companyIds.length > 0
        ? this.companyModel
            .find({ _id: { $in: companyIds } })
            .select("_id name")
            .lean()
            .exec()
        : Promise.resolve([]),
      operatorIds.length > 0
        ? this.userModel
            .find({ _id: { $in: operatorIds } })
            .select("_id firstName lastName email")
            .lean()
            .exec()
        : Promise.resolve([]),
      clientIds.length > 0
        ? this.clientModel
            .find({ _id: { $in: clientIds } })
            .select("_id name email")
            .lean()
            .exec()
        : Promise.resolve([]),
    ]);

    const companyById = new Map(
      companies.map((c) => [c._id.toString(), { id: c._id.toString(), name: c.name }]),
    );
    const operatorById = new Map(
      operators.map((u) => {
        const name = `${(u as any).firstName || ""} ${(u as any).lastName || ""}`.trim();
        return [
          u._id.toString(),
          {
            id: u._id.toString(),
            email: (u as any).email,
            ...(name ? { name } : {}),
          },
        ];
      }),
    );
    const clientById = new Map(
      clients.map((c) => [
        c._id.toString(),
        { id: c._id.toString(), name: c.name, ...(c.email ? { email: c.email } : {}) },
      ]),
    );

    return shipmentList.map((shipment) => {
      const companyId = shipment.companyId ? shipment.companyId.toString() : undefined;
      const storedOperator = (shipment as any)?.operator as
        | { id?: unknown; email?: string; name?: string }
        | undefined;
      const snapshotTakenBy = (shipment.quotationSnapshot as any)?.snapshotTakenBy;
      const createdBy = shipment.createdBy;
      const operatorId = storedOperator?.id || snapshotTakenBy || createdBy;
      const operatorIdStr = operatorId ? operatorId.toString() : undefined;

      const qsClient = (shipment.quotationSnapshot as any)?.clientId;
      const shipperClient = (shipment.parties as any)?.shipper?.clientId;
      const consigneeClient = (shipment.parties as any)?.consignee?.clientId;
      const clientId = qsClient || shipperClient || consigneeClient;
      const clientIdStr = clientId ? clientId.toString() : undefined;

      return {
        ...shipment,
        ...(operatorIdStr && operatorById.has(operatorIdStr)
          ? { operator: operatorById.get(operatorIdStr) }
          : {}),
        ...(storedOperator?.id
          ? {
              operator: {
                id: storedOperator.id.toString(),
                ...(storedOperator.email ? { email: storedOperator.email } : {}),
                ...(storedOperator.name ? { name: storedOperator.name } : {}),
              },
            }
          : {}),
        ...(clientIdStr && clientById.has(clientIdStr)
          ? { client: clientById.get(clientIdStr) }
          : {}),
        ...(companyId && companyById.has(companyId)
          ? { company: companyById.get(companyId) }
          : {}),
      } as Record<string, unknown>;
    });
  }

  /**
   * Return the stored PDF buffer for a specific delivery, validating the requesting user is that client.
   */
  async downloadDeliveryPdf(deliveryId: string, userId: string): Promise<Buffer> {
    if (!Types.ObjectId.isValid(deliveryId)) {
      throw new NotFoundException("Delivery not found");
    }
    const clientId = await this.getClientIdForUser(userId);
    const delivery = await this.quotationDeliveryModel
      .findOne({ _id: new Types.ObjectId(deliveryId), clientId })
      .select("pdfData")
      .lean()
      .exec();
    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }
    if (!(delivery as any).pdfData) {
      throw new NotFoundException("PDF not available for this delivery");
    }
    return Buffer.from((delivery as any).pdfData.buffer ?? (delivery as any).pdfData);
  }
}
