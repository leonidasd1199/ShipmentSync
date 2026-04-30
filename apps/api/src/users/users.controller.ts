import {
  Controller,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Get,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiExtraModels,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import {
  UpdateUserDto,
  UpdateMyProfileDto,
  UserResponseDto,
  ResetPasswordResponseDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { UserId, UserEmail } from "../auth/current-user.decorator";
import { ParseObjectIdPipe } from "../common/pipes/parse-objectid.pipe";
import { HistoryService } from "../history/history.service";
import { Types } from "mongoose";

@ApiTags("users")
@ApiBearerAuth("JWT-auth")
@Controller("users")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly historyService: HistoryService,
  ) {}

  @Patch("me")
  @ApiOperation({
    summary: "Update own profile",
    description:
      "Users can update their own name, phone number, avatar, and locale/timezone. No special permissions required.",
  })
  @ApiExtraModels(UpdateMyProfileDto, UserResponseDto)
  @ApiBody({ type: UpdateMyProfileDto })
  @ApiOkResponse({
    description: "Profile updated successfully",
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async updateMyProfile(
    @Body() updateMyProfileDto: UpdateMyProfileDto,
    @UserId() userId: string,
  ) {
    return this.usersService.updateMyProfile(userId, updateMyProfileDto);
  }

  @Patch(":id")
  @RequirePermissionDecorator("user:update")
  @ApiOperation({ summary: "Update user basic information" })
  @ApiExtraModels(UpdateUserDto, UserResponseDto)
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({
    description: "User updated successfully",
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - user belongs to different company",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async update(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateUserDto: UpdateUserDto,
    @UserId() currentUserId: string,
    @UserEmail() currentUserEmail: string,
  ) {
    return this.usersService.update(
      id.toString(),
      updateUserDto,
      currentUserId,
      currentUserEmail,
    );
  }

  @Post(":id/reset-password")
  @RequirePermissionDecorator("users:reset_password")
  @ApiOperation({
    summary: "Reset user password",
    description:
      "Allows an admin with 'users:reset_password' permission to set a temporary password and mustChangePassword = true for a user in the same company.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiResponse({
    status: 200,
    description: "Password reset successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", example: "Password reset successfully" },
        user: {
          type: "object",
          properties: {
            id: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            mustChangePassword: { type: "boolean" },
          },
        },
        temporaryPassword: {
          type: "string",
          description:
            "The generated temporary password (consider sending via email in production)",
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - user belongs to different company or insufficient permissions",
  })
  async resetPassword(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @UserId() currentUserId: string,
    @UserEmail() currentUserEmail: string,
  ) {
    return this.usersService.resetPassword(
      id.toString(),
      currentUserId,
      currentUserEmail,
    );
  }

  @Post(":id/permissions")
  @RequirePermissionDecorator("permissions:assign")
  @ApiOperation({
    summary: "Assign permissions to user",
    description:
      "Allows an admin with 'permissions:assign' permission to add a list of permissions to a user in the same company. This merges with the user's existing permissions (existing permissions are preserved).",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({
    description: "List of permission codes to assign",
    schema: {
      type: "object",
      properties: {
        permissionCodes: {
          type: "array",
          items: {
            type: "string",
            example: "user:create",
          },
          description:
            "Array of permission codes (e.g., 'user:create', 'office:read')",
        },
      },
      required: ["permissionCodes"],
      example: {
        permissionCodes: ["user:create", "user:read", "office:read"],
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Permissions assigned successfully",
        schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Permissions assigned successfully",
        },
        user: {
          type: "object",
          properties: {
            id: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
          },
        },
        permissions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              code: { type: "string", example: "user:create" },
              name: { type: "string", example: "Create User" },
              category: { type: "string", example: "user" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - user belongs to different company or insufficient permissions",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - invalid permission codes or empty array",
  })
  async assignPermissions(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @Body() body: { permissionCodes: string[] },
    @UserId() currentUserId: string,
    @UserEmail() currentUserEmail: string,
  ) {
    return this.usersService.assignPermissions(
      id.toString(),
      body.permissionCodes,
      currentUserId,
      currentUserEmail,
    );
  }

  @Delete(":id/permissions")
  @RequirePermissionDecorator("permissions:assign")
  @ApiOperation({
    summary: "Remove permissions from user",
    description:
      "Allows an admin with 'permissions:assign' permission to remove specific permissions from a user in the same company. The user will keep all other permissions.",
  })
  @ApiParam({
    name: "id",
    description: "User ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({
    description: "List of permission codes to remove",
    schema: {
      type: "object",
      properties: {
        permissionCodes: {
          type: "array",
          items: {
            type: "string",
            example: "user:create",
          },
          description:
            "Array of permission codes to remove (e.g., 'user:create', 'office:read')",
        },
      },
      required: ["permissionCodes"],
      example: {
        permissionCodes: ["user:create", "office:read"],
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Permissions removed successfully",
       schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Permissions removed successfully",
        },
        user: {
          type: "object",
          properties: {
            id: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
          },
        },
        removedPermissions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              code: { type: "string", example: "user:create" },
              name: { type: "string", example: "Create User" },
              category: { type: "string", example: "user" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({
    status: 403,
    description:
      "Forbidden - user belongs to different company or insufficient permissions",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - invalid permission codes or empty array",
  })
  async removePermissions(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @Body() body: { permissionCodes: string[] },
    @UserId() currentUserId: string,
    @UserEmail() currentUserEmail: string,
  ) {
    return this.usersService.removePermissions(
      id.toString(),
      body.permissionCodes,
      currentUserId,
      currentUserEmail,
    );
  }

  @Get("me")
  @ApiOperation({
    summary: "Get own profile",
    description:
      "Returns the authenticated user's profile, including company, offices, and permissions.",
  })
  @ApiResponse({ status: 200, description: "Profile retrieved successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({ status: 401, description: "User account inactive" })
  async getMyProfile(@UserId() userId: string) {
    return this.usersService.getMyProfile(userId);
  }

  @Get("all-permissions")
  @ApiOperation({
    summary: "Get all permissions",
    description:
      "Returns a list of all permission documents available in the database.",
  })
  @ApiResponse({
    status: 200,
    description: "List of all permissions",
        schema: {
      type: "object",
      properties: {
        permissions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", example: "65b1234a0f12e45eab123456" },
              code: { type: "string", example: "client:create" },
              description: {
                type: "string",
                example: "Allows creation of new clients",
              },
            },
          },
        },
      },
    },
  })
  async getAllPermissions() {
    return this.usersService.findAllPermissions();
  }

  @Get("company/:companyId/with-permissions")
  @RequirePermissionDecorator("permissions:assign")
  @ApiOperation({
    summary: "List company users with their permissions",
    description:
      "Returns all users for the given company including their permission codes. Requires permissions:assign and that the requester belongs to the same company.",
  })
  @ApiParam({
    name: "companyId",
    description: "Company ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiResponse({ status: 200, description: "List of users with permissions" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Company or user not found" })
  async getCompanyUsersWithPermissions(
    @Param("companyId", ParseObjectIdPipe) companyId: Types.ObjectId,
    @UserId() currentUserId: string,
  ) {
    return this.usersService.getCompanyUsersWithPermissions(
      companyId.toString(),
      currentUserId,
    );
  }
}
