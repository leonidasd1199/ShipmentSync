import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
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
import { OfficesService } from "./offices.service";
import {
  CreateOfficeDto,
  UpdateOfficeDto,
  OfficeResponseDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { OfficeAccessGuard } from "../auth/office-access.guard";
import { CompanyAccessGuard } from "../auth/company-access.guard";
import { UserId } from "../auth/current-user.decorator";
import { ParseObjectIdPipe } from "../common/pipes/parse-objectid.pipe";
import { Types } from "mongoose";
import { HistoryService } from "../history/history.service";

@ApiTags("offices")
@ApiBearerAuth("JWT-auth")
@Controller("offices")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OfficesController {
  constructor(
    private readonly officesService: OfficesService,
    private readonly historyService: HistoryService,
  ) {}

  @Post()
  @RequirePermissionDecorator("office:create")
  @ApiOperation({ summary: "Create a new office" })
  @ApiExtraModels(CreateOfficeDto, OfficeResponseDto)
  @ApiBody({ type: CreateOfficeDto })
  @ApiResponse({
    status: 201,
    description: "Office created successfully",
    type: OfficeResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(
    @Body() createOfficeDto: CreateOfficeDto,
    @UserId() userId: string,
  ) {
    return this.officesService.create(createOfficeDto, userId);
  }

  @Get()
  @RequirePermissionDecorator("office:list")
  @ApiOperation({ summary: "Get all offices for user's company" })
  @ApiOkResponse({
    description: "List of offices",
    type: [OfficeResponseDto],
  })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findAll(@UserId() userId: string) {
    return this.officesService.findAll(userId);
  }

  @Get("company/:companyId")
  @UseGuards(CompanyAccessGuard)
  @RequirePermissionDecorator("office:list")
  @ApiOperation({ summary: "Get offices by company ID" })
  @ApiParam({
    name: "companyId",
    description: "Company ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiOkResponse({
    description: "List of offices for the company",
    type: [OfficeResponseDto],
  })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getOfficesByCompany(
    @Param("companyId", ParseObjectIdPipe) companyId: Types.ObjectId,
    @UserId() userId: string,
  ) {
    return this.officesService.getOfficesByCompany(
      companyId.toString(),
      userId,
    );
  }

  @Get(":id")
  @UseGuards(OfficeAccessGuard)
  @RequirePermissionDecorator("office:read")
  @ApiOperation({ summary: "Get office by ID" })
  @ApiParam({
    name: "id",
    description: "Office ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiOkResponse({
    description: "Office details",
    type: OfficeResponseDto,
  })
  @ApiResponse({ status: 404, description: "Office not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findOne(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @UserId() userId: string,
  ) {
    return this.officesService.findOne(id.toString(), userId);
  }

  @Patch(":id")
  @UseGuards(OfficeAccessGuard)
  @RequirePermissionDecorator("office:update")
  @ApiOperation({ summary: "Update office (partial)" })
  @ApiExtraModels(UpdateOfficeDto, OfficeResponseDto)
  @ApiParam({
    name: "id",
    description: "Office ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdateOfficeDto })
  @ApiOkResponse({
    description: "Office updated successfully",
    type: OfficeResponseDto,
  })
  @ApiResponse({ status: 404, description: "Office not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async update(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateOfficeDto: UpdateOfficeDto,
    @UserId() userId: string,
  ) {
    return this.officesService.update(id.toString(), updateOfficeDto, userId);
  }

  @Put(":id")
  @UseGuards(OfficeAccessGuard)
  @RequirePermissionDecorator("office:update")
  @ApiOperation({ summary: "Replace office (full update)" })
  @ApiExtraModels(UpdateOfficeDto, OfficeResponseDto)
  @ApiParam({
    name: "id",
    description: "Office ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdateOfficeDto })
  @ApiOkResponse({
    description: "Office updated successfully",
    type: OfficeResponseDto,
  })
  @ApiResponse({ status: 404, description: "Office not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async replace(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateOfficeDto: UpdateOfficeDto,
    @UserId() userId: string,
  ) {
    return this.officesService.update(id.toString(), updateOfficeDto, userId);
  }

  @Delete(":id")
  @UseGuards(OfficeAccessGuard)
  @RequirePermissionDecorator("office:delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete office" })
  @ApiParam({
    name: "id",
    description: "Office ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiResponse({
    status: 204,
    description: "Office deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Office not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async remove(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @UserId() userId: string,
  ) {
    return this.officesService.remove(id.toString(), userId);
  }

  @Post(":id/assign-users")
  @UseGuards(OfficeAccessGuard)
  @RequirePermissionDecorator("user:update")
  @ApiOperation({ summary: "Assign users to office" })
  @ApiParam({
    name: "id",
    description: "Office ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({
    description: "User IDs to assign",
    schema: {
      type: "object",
      properties: {
        userIds: {
          type: "array",
          items: { type: "string" },
          example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
        },
      },
      required: ["userIds"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Users assigned successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async assignUsersToOffice(
    @Param("id", ParseObjectIdPipe) officeId: Types.ObjectId,
    @Body() body: { userIds: string[] },
    @UserId() userId: string,
  ) {
    return this.officesService.assignUsersToOffice(
      officeId.toString(),
      body.userIds,
      userId,
    );
  }

  @Post(":id/remove-users")
  @UseGuards(OfficeAccessGuard)
  @RequirePermissionDecorator("user:update")
  @ApiOperation({
    summary: "Disable user from office by setting office_disabled to true",
  })
  @ApiParam({
    name: "id",
    description: "Office ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({
    description: "User ID to disable",
    schema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          example: "507f1f77bcf86cd799439011",
        },
      },
      required: ["userId"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "User disabled successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async removeUsersFromOffice(
    @Param("id", ParseObjectIdPipe) officeId: Types.ObjectId,
    @Body() body: { userId: string },
    @UserId() userId: string,
  ) {
    return this.officesService.removeUsersFromOffice(
      officeId.toString(),
      body.userId,
      userId,
    );
  }

  @Get(":id/users")
  @UseGuards(OfficeAccessGuard)
  @RequirePermissionDecorator("office:read")
  @ApiOperation({ summary: "Get users assigned to office" })
  @ApiParam({
    name: "id",
    description: "Office ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiQuery({
    name: "includeDisabled",
    required: false,
    type: Boolean,
    description:
      "Include deactivated users (default: false, only returns active users)",
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: "List of users assigned to the office",
  })
  @ApiResponse({ status: 404, description: "Office not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getOfficeUsers(
    @Param("id", ParseObjectIdPipe) officeId: Types.ObjectId,
    @UserId() userId: string,
    @Query("includeDisabled") includeDisabled?: string,
  ) {
    const includeDisabledBool = includeDisabled === "true";
    return this.officesService.getOfficeUsers(
      officeId.toString(),
      userId,
      includeDisabledBool,
    );
  }

  @Get(":id/disabled-users")
  @UseGuards(OfficeAccessGuard)
  @RequirePermissionDecorator("office:read")
  @ApiOperation({ summary: "Get disabled users from office" })
  @ApiParam({
    name: "id",
    description: "Office ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiResponse({
    status: 200,
    description: "List of disabled users from the office",
  })
  @ApiResponse({ status: 404, description: "Office not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getDisabledUsers(
    @Param("id", ParseObjectIdPipe) officeId: Types.ObjectId,
    @UserId() userId: string,
  ) {
    return this.officesService.getDisabledUsers(officeId.toString(), userId);
  }

  @Post(":id/assign-new-user")
  @UseGuards(OfficeAccessGuard)
  @RequirePermissionDecorator("user:create")
  @ApiOperation({ summary: "Create a new user and assign to office" })
  @ApiParam({
    name: "id",
    description: "Office ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({
    description: "New user data",
    schema: {
      type: "object",
      properties: {
        firstName: { type: "string", example: "Carlos" },
        lastName: { type: "string", example: "Mendoza" },
        email: { type: "string", example: "carlos@empresa.com" },
        roleCode: {
          type: "string",
          example: "admin",
          description: "User role code (defaults to 'admin' if not provided)",
          enum: ["admin", "ops_admin", "client"],
        },
        phone: { type: "string", example: "+50499999999" },
      },
      required: ["firstName", "lastName", "email"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "User created and assigned to office successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Office not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async assignNewUser(
    @Param("id", ParseObjectIdPipe) officeId: Types.ObjectId,
    @Body()
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      roleCode?: string;
      phone?: string;
    },
    @UserId() userId: string,
  ) {
    return this.officesService.assignNewUser(
      officeId.toString(),
      userData,
      userId,
    );
  }
}
