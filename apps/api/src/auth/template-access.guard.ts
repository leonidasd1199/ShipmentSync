import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "../schemas/user.schema";
import { Template, TemplateDocument } from "../schemas/template.schema";

/**
 * Guard that ensures the authenticated user can access the template specified in the route params.
 * It checks:
 * 1. Template exists
 * 2. User's company matches the template's company
 *
 * Works with routes that have `:id` or `:templateId` parameters
 * @usage @UseGuards(JwtAuthGuard, PermissionGuard, TemplateAccessGuard)
 */
@Injectable()
export class TemplateAccessGuard implements CanActivate {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    // Try to get templateId from 'id' or 'templateId' params
    const templateId = request.params?.id || request.params?.templateId;

    if (!templateId) {
      // No template ID in route, skip this guard
      return true;
    }

    if (!Types.ObjectId.isValid(templateId)) {
      throw new BadRequestException(`Invalid template ID: ${templateId}`);
    }

    // Fetch user and template in parallel
    const [currentUser, template] = await Promise.all([
      this.userModel
        .findById(user.userId)
        .select("company")
        .lean()
        .exec(),
      this.templateModel.findById(templateId).select("companyId").lean().exec(),
    ]);

    if (!currentUser) {
      throw new NotFoundException("User not found");
    }

    if (!template) {
      throw new NotFoundException("Template not found");
    }

    // Check if user belongs to the same company as the template
    // Convert both to ObjectId for reliable comparison
    let templateCompanyId: Types.ObjectId;
    let userCompanyId: Types.ObjectId;
    
    try {
      templateCompanyId = template.companyId instanceof Types.ObjectId
        ? template.companyId
        : new Types.ObjectId(template.companyId);
    } catch (error) {
      throw new BadRequestException(`Invalid template companyId: ${template.companyId}`);
    }
    
    try {
      userCompanyId = currentUser.company instanceof Types.ObjectId
        ? currentUser.company
        : new Types.ObjectId(currentUser.company);
    } catch (error) {
      throw new BadRequestException(`Invalid user company: ${currentUser.company}`);
    }
    
    if (!templateCompanyId.equals(userCompanyId)) {
      throw new ForbiddenException(
        `You can only access templates in your own company. Template company: ${templateCompanyId.toString()}, User company: ${userCompanyId.toString()}`,
      );
    }

    return true;
  }
}

