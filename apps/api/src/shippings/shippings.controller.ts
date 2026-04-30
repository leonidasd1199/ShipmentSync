import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
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
} from "@nestjs/swagger";
import { ShippingsService } from "./shippings.service";
import {
  CreateShippingDto,
  UpdateShippingDto,
  ShippingResponseDto,
  CreateShippingResponseDto,
  AddAgentsResponseDto,
  RemoveAgentsResponseDto,
} from "./dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { UserId, UserEmail } from "../auth/current-user.decorator";
import { HistoryService } from "../history/history.service";

@ApiTags("shipping-lines")
@ApiBearerAuth("JWT-auth")
@Controller("shipping-lines")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ShippingsController {
  constructor(
    private readonly shippingsService: ShippingsService,
    private readonly historyService: HistoryService,
  ) {}

  @Post()
  @RequirePermissionDecorator("shipping:create")
  @ApiOperation({ summary: "Create a new shipping line" })
  @ApiExtraModels(CreateShippingDto, CreateShippingResponseDto)
  @ApiBody({ type: CreateShippingDto })
  @ApiResponse({
    status: 201,
    description: "Shipping line created successfully",
    type: CreateShippingResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(
    @Body() createShippingDto: CreateShippingDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.shippingsService.create(createShippingDto, userId, userEmail);
  }

  @Get()
  @RequirePermissionDecorator("shipping:list")
  @ApiOperation({ summary: "Get all shipping lines" })
  @ApiOkResponse({
    description: "List of shipping lines",
    type: [ShippingResponseDto],
  })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findAll() {
    return this.shippingsService.findAll();
  }

  @Get(":id")
  @RequirePermissionDecorator("shipping:read")
  @ApiOperation({ summary: "Get shipping line by ID" })
  @ApiParam({
    name: "id",
    description: "Shipping line MongoDB _id",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiOkResponse({
    description: "Shipping line details",
    type: ShippingResponseDto,
  })
  @ApiResponse({ status: 404, description: "Shipping line not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findOne(@Param("id") id: string) {
    return this.shippingsService.findOne(id);
  }

  @Patch(":id")
  @RequirePermissionDecorator("shipping:update")
  @ApiOperation({ summary: "Update shipping line (partial)" })
  @ApiExtraModels(UpdateShippingDto, ShippingResponseDto)
  @ApiParam({
    name: "id",
    description: "Shipping line MongoDB _id",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdateShippingDto })
  @ApiOkResponse({
    description: "Shipping line updated successfully",
    type: ShippingResponseDto,
  })
  @ApiResponse({ status: 404, description: "Shipping line not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async update(
    @Param("id") id: string,
    @Body() updateShippingDto: UpdateShippingDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.shippingsService.update(
      id,
      updateShippingDto,
      userId,
      userEmail,
    );
  }

  @Put(":id")
  @RequirePermissionDecorator("shipping:update")
  @ApiOperation({ summary: "Replace shipping line (full update)" })
  @ApiExtraModels(UpdateShippingDto, ShippingResponseDto)
  @ApiParam({
    name: "id",
    description: "Shipping line MongoDB _id",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdateShippingDto })
  @ApiOkResponse({
    description: "Shipping line updated successfully",
    type: ShippingResponseDto,
  })
  @ApiResponse({ status: 404, description: "Shipping line not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async replace(
    @Param("id") id: string,
    @Body() updateShippingDto: UpdateShippingDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.shippingsService.update(
      id,
      updateShippingDto,
      userId,
      userEmail,
    );
  }

  @Delete(":id")
  @RequirePermissionDecorator("shipping:delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete shipping line" })
  @ApiParam({
    name: "id",
    description: "Shipping line MongoDB _id",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiResponse({
    status: 204,
    description: "Shipping line deleted successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Cannot delete shipping line with active agents",
  })
  @ApiResponse({ status: 404, description: "Shipping line not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async remove(
    @Param("id") id: string,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.shippingsService.remove(id, userId, userEmail);
  }

  @Post(":shippingLineId/agents/add")
  @RequirePermissionDecorator("shipping:update")
  @ApiOperation({ summary: "Add agents to a shipping line" })
  @ApiExtraModels(AddAgentsResponseDto)
  @ApiParam({
    name: "shippingLineId",
    description: "Shipping line MongoDB _id",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({
    description: "Agent IDs to add to shipping line",
    schema: {
      type: "object",
      properties: {
        agentIds: {
          type: "array",
          items: { type: "string" },
          example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
          description: "Array of Agent MongoDB ObjectIds",
        },
      },
      required: ["agentIds"],
    },
  })
  @ApiOkResponse({
    description: "Agents added successfully",
    type: AddAgentsResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({
    status: 404,
    description: "Shipping line or agents not found",
  })
  async addAgents(
    @Param("shippingLineId") shippingLineId: string,
    @Body() body: { agentIds: string[] },
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.shippingsService.addAgents(
      shippingLineId,
      body.agentIds,
      userId,
      userEmail,
    );
  }

  @Get(":id/history")
  @RequirePermissionDecorator("audit:view")
  @ApiOperation({
    summary: "Get history logs for a specific shipping line",
    description:
      "Returns all history logs related to the specified shipping line, including creation, edits, deletions, and actions by users involving this shipping line.",
  })
  @ApiParam({
    name: "id",
    description: "Shipping line MongoDB _id",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiResponse({ status: 200, description: "Shipping line history list" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Shipping line not found" })
  async getShippingHistory(@Param("id") id: string) {
    const shipping = await this.shippingsService.findOne(id);
    return this.historyService.findAll({
      entityType: "shipping",
      entityId: shipping._id.toString(),
    });
  }

    @Get("by-mode/:mode")
  @RequirePermissionDecorator("shipping:list")
  @ApiOperation({ summary: "Get shipping lines filtered by shipping mode" })
  @ApiParam({
    name: "mode",
    description: "Shipping mode",
    example: "maritime",
  })
  @ApiOkResponse({
    description: "List of shipping lines for the given mode",
    type: [ShippingResponseDto],
  })
  @ApiResponse({ status: 400, description: "Invalid mode" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findByMode(@Param("mode") mode: string) {
    return this.shippingsService.findByMode(mode);
  }

  @Delete(":shippingLineId/agents/remove")
  @RequirePermissionDecorator("shipping:delete")
  @ApiOperation({ summary: "Remove agents from a shipping line" })
  @ApiExtraModels(RemoveAgentsResponseDto)
  @ApiParam({
    name: "shippingLineId",
    description: "Shipping line MongoDB _id",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({
    description:
      "Agent IDs to remove from shipping line. If omitted or empty, ALL agents will be removed.",
    schema: {
      type: "object",
      properties: {
        agentIds: {
          type: "array",
          items: { type: "string" },
          example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
          description:
            "Array of Agent MongoDB ObjectIds. Optional, if not provided removes all agents.",
        },
      },
    },
  })
  @ApiOkResponse({
    description: "Agents removed successfully",
    type: RemoveAgentsResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({
    status: 404,
    description: "Shipping line or agents not found",
  })
  async removeAgents(
    @Param("shippingLineId") shippingLineId: string,
    @Body() body: { agentIds?: string[] }, // opcional
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.shippingsService.removeAgentsFromShippingLine(
      shippingLineId,
      body.agentIds || null,
      userId,
      userEmail,
    );
  }
}
