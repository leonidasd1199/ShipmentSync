/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "../schemas/user.schema";
import {
  PermissionModel,
  PermissionDocument,
} from "../schemas/permission.schema";
import { AccessVerificationService } from "../common/services/access-verification.service";
import { generateRandomPassword } from "../common/utils/password.util";
import bcrypt from "bcryptjs";
import { Company } from "src/schemas/company.schema";
import { HistoryService } from "../history/history.service";
import { UpdateUserDto, UpdateMyProfileDto } from "./dto";
import { UserSerializer } from "./serializers";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private readonly companyModel: Model<Company>,
    @InjectModel(PermissionModel.name)
    private permissionModel: Model<PermissionDocument>,
    private accessVerification: AccessVerificationService,
    private historyService: HistoryService
  ) {}

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUserId: string,
    currentUserEmail: string,
  ) {
        // Verify the target user exists
    const targetUser = await this.userModel.findById(id).exec();

    if (!targetUser) {
      throw new NotFoundException("User not found");
    }

        // Verify that current user belongs to the same company as the target user
    await this.accessVerification.verifyCompanyAccess(
      currentUserId,
      targetUser.company,
    );

        // Build update object, excluding password and mustChangePassword
    const updateData: Partial<UserDocument> = {};

    if (updateUserDto.firstName !== undefined) {
      updateData.firstName = updateUserDto.firstName.trim();
    }

    if (updateUserDto.lastName !== undefined) {
      updateData.lastName = updateUserDto.lastName.trim();
    }

    if (updateUserDto.email !== undefined) {
      updateData.email = updateUserDto.email.toLowerCase().trim();
      // Check if email is already taken by another user
      const existingUser = await this.userModel
        .findOne({ email: updateData.email, _id: { $ne: id } })
        .exec();
      if (existingUser) {
        throw new ForbiddenException("Email is already in use");
      }
    }

    if (updateUserDto.phone !== undefined) {
      updateData.phone = updateUserDto.phone.trim();
    }

    if (updateUserDto.address !== undefined) {
      updateData.address = updateUserDto.address.trim();
    }

    // Update user
    const before = targetUser.toObject();
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .select("-password")
      .exec();

    const diff: Record<string, { from: any; to: any }> = {};
    for (const key of Object.keys(updateData)) {
      if (before[key] !== (updatedUser as any)[key]) {
        diff[key] = { from: before[key], to: (updatedUser as any)[key] };
      }
    }

    await this.historyService.log({
      action: "update",
      entityType: "user",
      entityId: id,
      actorUserId: currentUserId,
      actorEmail: currentUserEmail,
      actorName: currentUserEmail,
      origin: "api",
      status: "success",
      summary: `User "${targetUser.email}" updated`,
      before,
      after: updatedUser,
      diff,
    });

    // Return the updated user using serializer
    return UserSerializer.toResponse(updatedUser);
  }

  async updateMyProfile(
    userId: string,
    updateMyProfileDto: UpdateMyProfileDto,
  ) {
        // Verify the user exists
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

        // Build update object - only allow updating specific fields
    const updateData: Partial<UserDocument> = {};

    if (updateMyProfileDto.firstName !== undefined) {
      updateData.firstName = updateMyProfileDto.firstName.trim();
    }

    if (updateMyProfileDto.lastName !== undefined) {
      updateData.lastName = updateMyProfileDto.lastName.trim();
    }

    if (updateMyProfileDto.phone !== undefined) {
      updateData.phone = updateMyProfileDto.phone.trim();
    }

    if (updateMyProfileDto.avatar !== undefined) {
      updateData.avatar = updateMyProfileDto.avatar.trim();
    }

    if (updateMyProfileDto.locale !== undefined) {
      updateData.locale = updateMyProfileDto.locale.trim();
    }

    if (updateMyProfileDto.timezone !== undefined) {
      updateData.timezone = updateMyProfileDto.timezone.trim();
    }

        // Update user
    const before = user.toObject();
    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true })
      .select("-password")
      .exec();

    const diff: Record<string, { from: any; to: any }> = {};
    for (const key of Object.keys(updateData)) {
      if (before[key] !== (updatedUser as any)[key]) {
        diff[key] = { from: before[key], to: (updatedUser as any)[key] };
      }
    }

    await this.historyService.log({
      action: "update_profile",
      entityType: "user",
      entityId: userId,
      actorUserId: userId,
      actorEmail: user.email,
      actorName: user.email,
      origin: "api",
      status: "success",
      summary: `User profile updated`,
      before,
      after: updatedUser,
      diff,
    });

    // Return the updated user using serializer
    return UserSerializer.toResponse(updatedUser);
  }

  async resetPassword(id: string, currentUserId: string, currentUserEmail: string) {
        // Verify the target user exists
    const targetUser = await this.userModel.findById(id).exec();

    if (!targetUser) {
      throw new NotFoundException("User not found");
    }

        // Verify that current user belongs to the same company as the target user
    await this.accessVerification.verifyCompanyAccess(
      currentUserId,
      targetUser.company,
    );

    // Generate a random secure password
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    
        // Update user with new password and reset flags
      const updateData: Partial<UserDocument> = {
      password: hashedPassword,
      mustChangePassword: true,
      lastPasswordResetAt: new Date(),
    };

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .select("-password")
      .exec();

    await this.historyService.log({
      action: "reset_password",
      entityType: "user",
      entityId: id,
      actorUserId: currentUserId,
      actorEmail: currentUserEmail,
      actorName: currentUserEmail,
      origin: "api",
      status: "success",
      summary: `Password reset for "${targetUser.email}"`,
      targetId: id,
      targetType: "user",
    });

    return {
      message: "Password reset successfully",
      user: updatedUser,
            // Note: In production, consider sending the password via email instead of returning it
      temporaryPassword: randomPassword,
    };
  }

  async assignPermissions(
    userId: string,
    permissionCodes: string[],
    currentUserId: string,
    currentUserEmail: string,
  ) {
    const targetUser = await this.userModel.findById(userId).exec();

    if (!targetUser) {
      throw new NotFoundException("User not found");
    }

    await this.accessVerification.verifyCompanyAccess(
      currentUserId,
      targetUser.company,
    );

    if (!Array.isArray(permissionCodes) || permissionCodes.length === 0) {
      throw new BadRequestException(
        "Permission codes must be a non-empty array",
      );
    }

    const permissions = await this.permissionModel
      .find({ code: { $in: permissionCodes }, isActive: true })
      .exec();

    if (permissions.length !== permissionCodes.length) {
      const foundCodes = permissions.map((p) => String(p.code));
      const notFoundCodes = permissionCodes.filter(
        (code) => !foundCodes.includes(String(code)),
      );
      throw new BadRequestException(
        `Invalid or inactive permission codes: ${notFoundCodes.join(", ")}`,
      );
    }

    const newPermissionIds = permissions.map((p) => p._id);

    const existingPermissionIds = (targetUser.permissions || []).map((p) => {
      if (p && typeof p === "object" && "_id" in p) {
        return p._id;
      }
      return p as Types.ObjectId;
    });

    const mergedPermissionIds = [
      ...existingPermissionIds,
      ...newPermissionIds,
    ].filter(
      (id, index, self) =>
        self.findIndex((otherId) => otherId.toString() === id.toString()) ===
        index,
    );

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        { permissions: mergedPermissionIds },
        { new: true },
      )
      .select("-password")
      .populate("permissions", "code name category")
      .exec();

    await this.historyService.log({
      action: "assign_permissions",
      entityType: "user",
      entityId: userId,
      actorUserId: currentUserId,
      actorEmail: currentUserEmail,
      actorName: currentUserEmail,
      origin: "api",
      status: "success",
      summary: `Assigned ${permissions.length} permissions to user "${targetUser.email}"`,
      after: { permissionCodes },
    });

    return {
      message: "Permissions assigned successfully",
      user: updatedUser,
      permissions: permissions.map((p) => ({
        id: p._id.toString(),
        code: p.code,
        name: p.name,
        category: p.category,
      })),
    };
  }

  async removePermissions(
    userId: string,
    permissionCodes: string[],
    currentUserId: string,
    currentUserEmail: string,
  ) {
        // Verify the target user exists
    const targetUser = await this.userModel.findById(userId).exec();

    if (!targetUser) {
      throw new NotFoundException("User not found");
    }

        // Verify that current user belongs to the same company as the target user
    await this.accessVerification.verifyCompanyAccess(
      currentUserId,
      targetUser.company,
    );

        // Validate permission codes
    if (!Array.isArray(permissionCodes) || permissionCodes.length === 0) {
      throw new BadRequestException(
        "Permission codes must be a non-empty array",
      );
    }

        // Find permissions by codes
    const permissionsToRemove = await this.permissionModel
      .find({ code: { $in: permissionCodes }, isActive: true })
      .exec();

    if (permissionsToRemove.length !== permissionCodes.length) {
      const foundCodes = permissionsToRemove.map((p) => String(p.code));
      const notFoundCodes = permissionCodes.filter(
        (code) => !foundCodes.includes(String(code)),
      );
      throw new BadRequestException(
        `Invalid or inactive permission codes: ${notFoundCodes.join(", ")}`,
      );
    }

    // Get permission IDs to remove
    const permissionIdsToRemove = permissionsToRemove.map((p) => p._id);

        // Remove permissions from user (keep all others)
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $pull: { permissions: { $in: permissionIdsToRemove } } },
        { new: true },
      )
      .select("-password")
      .populate("permissions", "code name category")
      .exec();

    await this.historyService.log({
      action: "remove_permissions",
      entityType: "user",
      entityId: userId,
      actorUserId: currentUserId,
      actorEmail: currentUserEmail,
      actorName: currentUserEmail,
      origin: "api",
      status: "success",
      summary: `Removed ${permissionsToRemove.length} permissions from user "${targetUser.email}"`,
      before: { removed: permissionCodes },
    });

    return {
      message: "Permissions removed successfully",
      user: updatedUser,
      removedPermissions: permissionsToRemove.map((p) => ({
        id: p._id.toString(),
        code: p.code,
        name: p.name,
        category: p.category,
      })),
    };
  }

  async getMyProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select("-password")
      .populate("role")
      .populate("company")
      .populate("offices")
      .populate("permissions")
      .exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("User account is inactive");
    }

    let companyDetails: { id: string; name: string } | undefined = undefined;
    if (
      user.company &&
      typeof user.company === "object" &&
      "name" in user.company
    ) {
      companyDetails = {
        id: user.company._id?.toString() ?? "",
        name: user.company.name as string,
      };
    }

        // Obtener offices details
    let officesDetails: Array<{ id: string; name: string; type: string }> = [];
    if (Array.isArray(user.offices) && user.offices.length > 0) {
      officesDetails = user.offices
        .filter((office) => typeof office === "object" && "name" in office)
        .map((office) => ({
          id: office._id.toString(),
          name: office.name as string,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          type: (office as any).type ?? "",
        }));
    }

    const permissionCodes =
      ((user.permissions as unknown as PermissionDocument[]) || []).map(
        (p) => p.code,
      ) ?? [];

    return {
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roleCode: user.roleCode,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword || false,
        phone: user.phone,
        avatar: user.avatar,
        locale: user.locale,
        timezone: user.timezone,
        lastLoginAt: user.lastLoginAt,
        company: companyDetails,
        offices: officesDetails,
        permissions: permissionCodes,
      },
    };
  }

  async findAllPermissions() {
    const permissions = await this.permissionModel
      .find()
      .select("_id code description")
      .sort({ code: 1 })
      .lean();

    return {
      permissions: permissions.map((p) => ({
        id: p._id.toString(),
        code: p.code,
        description: p.description ?? "",
      })),
    };
  }

  async getCompanyUsersWithPermissions(
    companyId: string,
    currentUserId: string,
  ) {
    const currentUser = await this.userModel
      .findById(currentUserId)
      .select("_id company")
      .exec();

    if (!currentUser) {
      throw new NotFoundException("Current user not found");
    }

    const company = await this.companyModel.findById(companyId).exec();
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    if (currentUser.company?.toString() !== companyId) {
      throw new ForbiddenException(
        "You can only view users from your own company",
      );
    }

    const users = await this.userModel
      .find({ company: new Types.ObjectId(companyId) })
      .select(
        "firstName lastName email roleCode isActive office_disabled permissions",
      )
      .populate("permissions", "code")
      .lean();

    return {
      users: users.map((u: User) => ({
        ...u,
        permissions: Array.isArray(u.permissions)
          ? u.permissions.map((p: any) => p.code)
          : [],
      })),
    };
  }
}
