import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "../schemas/user.schema";
import { Company, CompanyDocument } from "../schemas/company.schema";

/**
 * Guard that ensures the authenticated user can access the company specified in the route params.
 * It checks:
 * 1. Company exists
 * 2. User's company matches the requested company
 *
 * Works with routes that have `:companyId` parameter
 * @usage @UseGuards(JwtAuthGuard, PermissionGuard, CompanyAccessGuard)
 */
@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    const companyId = request.params?.companyId;

    if (!companyId) {
      // No company ID in route, skip this guard
      return true;
    }

    if (!Types.ObjectId.isValid(companyId)) {
      throw new BadRequestException(`Invalid company ID: ${companyId}`);
    }

    // Fetch user and company in parallel
    const [currentUser, company] = await Promise.all([
      this.userModel.findById(user.userId).select("company").lean().exec(),
      this.companyModel.findById(companyId).lean().exec(),
    ]);

    if (!currentUser) {
      throw new NotFoundException("User not found");
    }

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    // Check if user belongs to the same company
    if (currentUser.company?.toString() !== companyId) {
      throw new ForbiddenException(
        "You can only access resources in your own company",
      );
    }

    return true;
  }
}
