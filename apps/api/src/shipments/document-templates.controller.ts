import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { DocumentTemplateService } from "./services/document-template.service";
import {
  CreateDocumentTemplateDto,
  UpdateDocumentTemplateDto,
  DocumentTemplateFiltersDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { UserId } from "../auth/current-user.decorator";
import { Permission } from "../common/enums/permission.enum";

@ApiTags("document-templates")
@ApiBearerAuth("JWT-auth")
@Controller("documentTemplates")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DocumentTemplatesController {
  constructor(private templateService: DocumentTemplateService) {}

  @Post()
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create document template",
    description: "Creates a new document template",
  })
  @ApiResponse({ status: 201, description: "Template created" })
  @ApiResponse({ status: 400, description: "Invalid input" })
  async create(
    @Body() dto: CreateDocumentTemplateDto,
    @UserId() userId: string,
  ) {
    return this.templateService.create({
      ...dto,
      userId,
    });
  }

  @Get()
  @RequirePermissionDecorator(Permission.SHIPMENT_READ)
  @ApiOperation({
    summary: "List document templates",
    description: "Get templates with optional filters",
  })
  @ApiQuery({ name: "mode", required: false, enum: ["OCEAN", "LAND", "AIR", "MULTIMODAL"] })
  @ApiQuery({ name: "documentType", required: false })
  @ApiQuery({ name: "active", required: false, type: Boolean })
  @ApiResponse({ status: 200, description: "Templates list" })
  async findAll(@Query() filters: DocumentTemplateFiltersDto) {
    return this.templateService.findAll(filters);
  }

  @Get(":id")
  @RequirePermissionDecorator(Permission.SHIPMENT_READ)
  @ApiOperation({
    summary: "Get template by ID",
  })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 200, description: "Template details" })
  @ApiResponse({ status: 404, description: "Template not found" })
  async findOne(@Param("id") id: string) {
    return this.templateService.findOne(id);
  }

  @Patch(":id")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @ApiOperation({
    summary: "Update template",
  })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 200, description: "Template updated" })
  @ApiResponse({ status: 404, description: "Template not found" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateDocumentTemplateDto,
    @UserId() userId: string,
  ) {
    return this.templateService.update(id, { ...dto, userId });
  }

  @Post(":id/activate")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Activate template",
    description:
      "Activates this template and deactivates others for the same mode+documentType",
  })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 200, description: "Template activated" })
  @ApiResponse({ status: 404, description: "Template not found" })
  async activate(@Param("id") id: string, @UserId() userId: string) {
    return this.templateService.activate(id, userId);
  }

  @Delete(":id")
  @RequirePermissionDecorator(Permission.SHIPMENT_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete template",
  })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 204, description: "Template deleted" })
  @ApiResponse({ status: 404, description: "Template not found" })
  async delete(@Param("id") id: string) {
    await this.templateService.delete(id);
  }
}
