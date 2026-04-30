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
  ForbiddenException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiExtraModels,
  ApiQuery,
} from "@nestjs/swagger";
import { TemplatesService } from "./templates.service";
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateResponseDto,
  CreateTemplateResponseDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { UserId, UserEmail } from "../auth/current-user.decorator";
import { ParseObjectIdPipe } from "../common/pipes/parse-objectid.pipe";
import { Types } from "mongoose";
import { HistoryService } from "../history/history.service";
import { TemplateAccessGuard } from "../auth/template-access.guard";

@ApiTags("templates")
@ApiBearerAuth("JWT-auth")
@Controller("templates")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly historyService: HistoryService,
  ) {}

  @Post()
  @RequirePermissionDecorator("template:create")
  @ApiOperation({ summary: "Create a new template" })
  @ApiExtraModels(CreateTemplateDto, CreateTemplateResponseDto)
  @ApiBody({ type: CreateTemplateDto })
  @ApiResponse({
    status: 201,
    description: "Template created successfully",
    type: CreateTemplateResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(
    @Body() createTemplateDto: CreateTemplateDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.templatesService.create(createTemplateDto, userId, userEmail);
  }

  @Get()
  @RequirePermissionDecorator("template:list")
  @ApiOperation({
    summary: "Get all templates for user's company",
    description: "Get templates with optional filters: serviceType, category, shippingMode, isActive",
  })
  @ApiQuery({
    name: "serviceType",
    required: false,
    enum: ["FCL", "LCL", "AIR", "FTL", "INSURANCE", "CUSTOMS", "LOCAL_TRUCKING", "OTHER"],
    description: "Filter by service type",
  })
  @ApiQuery({
    name: "category",
    required: false,
    enum: ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"],
    description: "Filter by Incoterm category",
  })
  @ApiQuery({
    name: "shippingMode",
    required: false,
    enum: ["maritime", "air", "road"],
    description: "Filter by shipping mode (checks if template includes this mode in shippingModes array)",
  })
  @ApiQuery({
    name: "isActive",
    required: false,
    type: Boolean,
    description: "Filter by active status",
  })
  @ApiOkResponse({
    description: "List of templates",
    type: [TemplateResponseDto],
  })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findAll(
    @Query("serviceType") serviceType?: string,
    @Query("category") category?: string,
    @Query("shippingMode") shippingMode?: string,
    @Query("isActive") isActive?: string,
    @UserId() userId?: string,
  ) {
    if (!userId) {
      throw new ForbiddenException("User ID is required");
    }
    return this.templatesService.findAll(userId, {
      serviceType,
      category,
      shippingMode,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
    });
  }

  @Get(":id")
  @RequirePermissionDecorator("template:read")
  @UseGuards(TemplateAccessGuard)
  @ApiOperation({ summary: "Get template by ID" })
  @ApiParam({
    name: "id",
    description: "Template ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiOkResponse({
    description: "Template details",
    type: TemplateResponseDto,
  })
  @ApiResponse({ status: 404, description: "Template not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findOne(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @UserId() userId: string,
  ) {
    return this.templatesService.findOne(id.toString(), userId);
  }

  @Patch(":id")
  @RequirePermissionDecorator("template:update")
  @UseGuards(TemplateAccessGuard)
  @ApiOperation({ summary: "Update template (partial)" })
  @ApiExtraModels(UpdateTemplateDto, TemplateResponseDto)
  @ApiParam({
    name: "id",
    description: "Template ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdateTemplateDto })
  @ApiOkResponse({
    description: "Template updated successfully",
    type: TemplateResponseDto,
  })
  @ApiResponse({ status: 404, description: "Template not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async update(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.templatesService.update(
      id.toString(),
      updateTemplateDto,
      userId,
      userEmail,
    );
  }

  @Put(":id")
  @RequirePermissionDecorator("template:update")
  @UseGuards(TemplateAccessGuard)
  @ApiOperation({ summary: "Replace template (full update)" })
  @ApiExtraModels(UpdateTemplateDto, TemplateResponseDto)
  @ApiParam({
    name: "id",
    description: "Template ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdateTemplateDto })
  @ApiOkResponse({
    description: "Template updated successfully",
    type: TemplateResponseDto,
  })
  @ApiResponse({ status: 404, description: "Template not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async replace(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.templatesService.update(
      id.toString(),
      updateTemplateDto,
      userId,
      userEmail,
    );
  }

  @Delete(":id")
  @RequirePermissionDecorator("template:delete")
  @UseGuards(TemplateAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete template",
    description: "Soft delete: sets isActive = false. Template is not permanently removed from the database.",
  })
  @ApiParam({
    name: "id",
    description: "Template ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiResponse({
    status: 204,
    description: "Template soft deleted successfully (isActive = false)",
  })
  @ApiResponse({ status: 404, description: "Template not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async remove(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.templatesService.remove(id.toString(), userId, userEmail);
  }
}

