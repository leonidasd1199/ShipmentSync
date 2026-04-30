import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "../../schemas/user.schema";
import { Office, OfficeDocument } from "../../schemas/office.schema";
import { Company, CompanyDocument } from "../../schemas/company.schema";

/**
 * Helper service for common access verification patterns
 * Reduces code duplication across services
 */
@Injectable()
export class AccessVerificationService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Office.name)
    private readonly officeModel: Model<OfficeDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
  ) {}

  /**
   * Verify that a user belongs to the same company as an office
   * @throws NotFoundException if user or office not found
   * @throws ForbiddenException if companies don't match
   */
  async verifyOfficeAccess(
    userId: string,
    officeId: string | Types.ObjectId,
  ): Promise<{ user: UserDocument; office: OfficeDocument }> {
    const officeObjectId =
      typeof officeId === "string" ? new Types.ObjectId(officeId) : officeId;

    const [user, office] = await Promise.all([
      this.userModel.findById(userId).exec(),
      this.officeModel.findById(officeObjectId).exec(),
    ]);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!office) {
      throw new NotFoundException("Office not found");
    }

    if (user.company.toString() !== office.company.toString()) {
      throw new ForbiddenException(
        "You can only access offices in your own company",
      );
    }

    return { user, office };
  }

  /**
   * Verify that a user belongs to a specific company
   * @throws NotFoundException if user or company not found
   * @throws ForbiddenException if companies don't match
   */
  async verifyCompanyAccess(
    userId: string,
    companyId: string | Types.ObjectId,
  ): Promise<{ user: UserDocument; company: CompanyDocument }> {
    const companyObjectId =
      typeof companyId === "string" ? new Types.ObjectId(companyId) : companyId;

    const [user, company] = await Promise.all([
      this.userModel.findById(userId).exec(),
      this.companyModel.findById(companyObjectId).exec(),
    ]);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    if (user.company.toString() !== companyId.toString()) {
      throw new ForbiddenException(
        "You can only access resources in your own company",
      );
    }

    return { user, company };
  }
}
