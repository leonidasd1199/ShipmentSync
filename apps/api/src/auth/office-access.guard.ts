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
import { Office, OfficeDocument } from "../schemas/office.schema";

/**
 * Guard that ensures the authenticated user can access the office specified in the route params.
 * It checks:
 * 1. Office exists
 * 2. User's company matches the office's company
 *
 * Works with routes that have `:id` or `:officeId` parameters
 * @usage @UseGuards(JwtAuthGuard, PermissionGuard, OfficeAccessGuard)
 */
@Injectable()
export class OfficeAccessGuard implements CanActivate {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Office.name)
    private readonly officeModel: Model<OfficeDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    // Try to get officeId from 'id' or 'officeId' params
    const officeId = request.params?.id || request.params?.officeId;

    if (!officeId) {
      // No office ID in route, skip this guard (might be using CompanyAccessGuard instead)
      return true;
    }

    if (!Types.ObjectId.isValid(officeId)) {
      throw new BadRequestException(`Invalid office ID: ${officeId}`);
    }

    // Fetch user and office in parallel
    const [currentUser, office] = await Promise.all([
      this.userModel
        .findById(user.userId)
        .select("company offices")
        .lean()
        .exec(),
      this.officeModel.findById(officeId).select("company").lean().exec(),
    ]);

    if (!currentUser) {
      throw new NotFoundException("User not found");
    }

    if (!office) {
      throw new NotFoundException("Office not found");
    }

    // Check if user belongs to the same company as the office
    if (currentUser.company?.toString() !== office.company?.toString()) {
      throw new ForbiddenException(
        "You can only access offices in your own company",
      );
    }

    return true;
  }
}
