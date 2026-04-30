import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { HistoryService, CreateHistoryDto } from "./history.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { CurrentUser } from "../auth/current-user.decorator";

@ApiTags("history")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller("history")
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Post()
  @RequirePermissionDecorator("audit:create")
  @ApiOperation({ summary: "Create a new history record" })
  @ApiResponse({
    status: 201,
    description: "History record created successfully",
  })
  @ApiResponse({ status: 403, description: "Forbidden - Missing permission" })
  async create(
    @Body() body: CreateHistoryDto,
    @CurrentUser() user: any,
    @Ip() ip: string,
    @Req() req: any,
  ) {
    const dto: CreateHistoryDto = {
      ...body,
      actorUserId: user?.id || user?.sub || "unknown",
      actorName: user?.name || user?.email || "Unknown User",
      sourceIp: body.sourceIp || ip,
      userAgent: req.headers["user-agent"] || "",
    };
    return this.historyService.log(dto);
  }

  @Get()
  @RequirePermissionDecorator("audit:view")
  @ApiOperation({
    summary: "List history logs",
    description:
      "Fetch all audit logs. You can filter by action, entityType, entityId, date range, or paginate results.",
  })
  @ApiQuery({
    name: "entityType",
    required: false,
    example: "user",
    description: "Filter by entity type (e.g. user, client, office)",
  })
  @ApiQuery({
    name: "entityId",
    required: false,
    example: "654a6f35b2e1d3b8b13d8f70",
    description: "Filter by entity ID (Mongo ObjectId)",
  })
  @ApiQuery({
    name: "action",
    required: false,
    example: "update",
    description: "Filter by action name (e.g. create, update, delete)",
  })
  @ApiQuery({
    name: "from",
    required: false,
    example: "2025-11-01T00:00:00.000Z",
    description: "Start date (ISO format)",
  })
  @ApiQuery({
    name: "to",
    required: false,
    example: "2025-11-30T23:59:59.999Z",
    description: "End date (ISO format)",
  })
  @ApiQuery({
    name: "page",
    required: false,
    example: 1,
    description: "Page number for pagination",
  })
  @ApiQuery({
    name: "pageSize",
    required: false,
    example: 10,
    description: "Number of items per page",
  })
  @ApiResponse({ status: 200, description: "List of history records" })
  @ApiResponse({ status: 403, description: "Forbidden - Missing permission" })
  async getAllHistory(
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("action") action?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.historyService.findAll({
      entityType,
      entityId,
      action,
      from,
      to,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
    });
  }
}
