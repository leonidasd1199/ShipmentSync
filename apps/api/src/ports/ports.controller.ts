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
  ApiBody,
  ApiExtraModels,
  ApiQuery,
} from "@nestjs/swagger";
import { PortsService } from "./ports.service";
import {
  CreatePortDto,
  UpdatePortDto,
  PortResponseDto,
  CreatePortResponseDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { ParseObjectIdPipe } from "../common/pipes/parse-objectid.pipe";
import { Types } from "mongoose";

@ApiTags("ports")
@ApiBearerAuth("JWT-auth")
@Controller("ports")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PortsController {
  constructor(private readonly portsService: PortsService) {}

  @Post()
  @RequirePermissionDecorator("port:create")
  @ApiOperation({ summary: "Create a new port" })
  @ApiExtraModels(CreatePortDto, CreatePortResponseDto)
  @ApiBody({ type: CreatePortDto })
  @ApiResponse({
    status: 201,
    description: "Port created successfully",
    type: CreatePortResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(@Body() createPortDto: CreatePortDto) {
    return this.portsService.create(createPortDto);
  }

  @Get()
  @RequirePermissionDecorator("port:list")
  @ApiOperation({
    summary: "Get all ports",
    description: "Get ports with optional filters: type, countryCode, isActive, search",
  })
  @ApiQuery({
    name: "type",
    required: false,
    enum: ["sea", "air", "rail", "inland", "other"],
    description: "Filter by port type",
  })
  @ApiQuery({
    name: "countryCode",
    required: false,
    description: "Filter by ISO 3166-1 alpha-2 country code (e.g., CN, HN)",
  })
  @ApiQuery({
    name: "isActive",
    required: false,
    type: Boolean,
    description: "Filter by active status",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search in name, city, countryName, or unlocode",
  })
  @ApiOkResponse({
    description: "List of ports",
    type: [PortResponseDto],
  })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findAll(
    @Query("type") type?: string,
    @Query("countryCode") countryCode?: string,
    @Query("isActive") isActive?: string,
    @Query("search") search?: string,
  ) {
    return this.portsService.findAll({
      type,
      countryCode,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      search,
    });
  }

  @Get(":id")
  @RequirePermissionDecorator("port:read")
  @ApiOperation({ summary: "Get port by ID" })
  @ApiParam({
    name: "id",
    description: "Port ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiOkResponse({
    description: "Port details",
    type: PortResponseDto,
  })
  @ApiResponse({ status: 404, description: "Port not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findOne(@Param("id", ParseObjectIdPipe) id: Types.ObjectId) {
    return this.portsService.findOne(id.toString());
  }

  @Patch(":id")
  @RequirePermissionDecorator("port:update")
  @ApiOperation({ summary: "Update port (partial)" })
  @ApiExtraModels(UpdatePortDto, PortResponseDto)
  @ApiParam({
    name: "id",
    description: "Port ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdatePortDto })
  @ApiOkResponse({
    description: "Port updated successfully",
    type: PortResponseDto,
  })
  @ApiResponse({ status: 404, description: "Port not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async update(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updatePortDto: UpdatePortDto,
  ) {
    return this.portsService.update(id.toString(), updatePortDto);
  }

  @Put(":id")
  @RequirePermissionDecorator("port:update")
  @ApiOperation({ summary: "Replace port (full update)" })
  @ApiExtraModels(UpdatePortDto, PortResponseDto)
  @ApiParam({
    name: "id",
    description: "Port ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdatePortDto })
  @ApiOkResponse({
    description: "Port updated successfully",
    type: PortResponseDto,
  })
  @ApiResponse({ status: 404, description: "Port not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async replace(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updatePortDto: UpdatePortDto,
  ) {
    return this.portsService.update(id.toString(), updatePortDto);
  }

  @Delete(":id")
  @RequirePermissionDecorator("port:delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete port",
    description: "Soft delete: sets isActive = false. Port is not permanently removed from the database.",
  })
  @ApiParam({
    name: "id",
    description: "Port ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiResponse({
    status: 204,
    description: "Port soft deleted successfully (isActive = false)",
  })
  @ApiResponse({ status: 404, description: "Port not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async remove(@Param("id", ParseObjectIdPipe) id: Types.ObjectId) {
    return this.portsService.remove(id.toString());
  }
}

