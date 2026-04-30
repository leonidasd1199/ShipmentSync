import {
  Controller,
  Get,
  Param,
  UseGuards,
  Inject,
  forwardRef,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { OfficesService } from "../offices/offices.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  PermissionGuard,
  RequirePermissionDecorator,
} from "../auth/permission.middleware";
import { CompanyAccessGuard } from "../auth/company-access.guard";
import { UserId } from "../auth/current-user.decorator";
import { ParseObjectIdPipe } from "../common/pipes/parse-objectid.pipe";
import { Types } from "mongoose";
import { HistoryService } from "../history/history.service";

@ApiTags("companies")
@ApiBearerAuth("JWT-auth")
@Controller("companies")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CompaniesController {
  constructor(
    @Inject(forwardRef(() => OfficesService))
    private readonly officesService: OfficesService,

    private readonly historyService: HistoryService,
  ) {}

  @Get(":companyId/users")
  @UseGuards(CompanyAccessGuard)
  @RequirePermissionDecorator("user:list")
  @ApiOperation({ summary: "Get all users from a company" })
  @ApiParam({
    name: "companyId",
    description: "Company ID",
    example: "507f1f77bcf86cd799439011",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "List of users from the company",
  })
  @ApiResponse({ status: 404, description: "Company not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getCompanyUsers(
    @Param("companyId", ParseObjectIdPipe) companyId: Types.ObjectId,
    @UserId() userId: string,
  ) {
    return this.officesService.getCompanyUsers(companyId.toString(), userId);
  }

  @Get(":companyId/history")
  @UseGuards(CompanyAccessGuard)
  @RequirePermissionDecorator("audit:view")
  @ApiOperation({ summary: "Get history logs for a specific company" })
  @ApiParam({
    name: "companyId",
    description: "Company ID",
    example: "507f1f77bcf86cd799439011",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "List of history logs for the company",
  })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getCompanyHistory(
    @Param("companyId", ParseObjectIdPipe) companyId: Types.ObjectId,
  ) {
    return this.historyService.findAll({
      entityType: "company",
      entityId: companyId.toString(),
    });
  }
}
