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
  Query,
  Res,
  NotFoundException,
} from "@nestjs/common";
import type { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiExtraModels,
} from "@nestjs/swagger";
import { ClientsService } from "./clients.service";
import {
  CreateClientDto,
  UpdateClientDto,
  ClientResponseDto,
  ClientDateRangeQueryDto,
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

@ApiTags("clients")
@ApiBearerAuth("JWT-auth")
@Controller("clients")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly historyService: HistoryService,
  ) {}

  @Post()
  @RequirePermissionDecorator("client:create")
  @ApiOperation({ summary: "Create a new client" })
  @ApiExtraModels(CreateClientDto, ClientResponseDto)
  @ApiBody({ type: CreateClientDto })
  @ApiResponse({
    status: 201,
    description: "Client created successfully",
    type: ClientResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(
    @Body() createClientDto: CreateClientDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.clientsService.create(createClientDto, userId, userEmail);
  }

  @Get()
  @RequirePermissionDecorator("client:list")
  @ApiOperation({ summary: "Get all clients for user's company" })
  @ApiOkResponse({
    description: "List of clients",
    type: [ClientResponseDto],
  })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findAll(@UserId() userId: string) {
    return this.clientsService.findAll(userId);
  }

  @Get("price-list")
  @RequirePermissionDecorator("client:read")
  @ApiOperation({ summary: "Get quotation deliveries (price list) for the logged-in client" })
  @ApiQuery({ name: "dateFrom", required: false, description: "Filter on or after this date (ISO 8601)" })
  @ApiQuery({ name: "dateTo", required: false, description: "Filter on or before this date (ISO 8601)" })
  @ApiOkResponse({ description: "List of quotation deliveries with snapshot and metadata" })
  @ApiResponse({ status: 403, description: "Forbidden – only client users" })
  async getPriceList(
    @UserId() userId: string,
    @Query() query: ClientDateRangeQueryDto,
  ) {
    return this.clientsService.getPriceList(userId, query);
  }

  @Get("price-list/:id/pdf")
  @RequirePermissionDecorator("client:read")
  @ApiOperation({ summary: "Download the stored PDF for a specific delivery" })
  @ApiParam({ name: "id", description: "Delivery ID" })
  @ApiResponse({ status: 200, description: "PDF file" })
  @ApiResponse({ status: 404, description: "PDF not found" })
  async downloadDeliveryPdf(
    @Param("id") id: string,
    @UserId() userId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.clientsService.downloadDeliveryPdf(id, userId);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quotation-${id}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Get("shipments")
  @RequirePermissionDecorator("client:read")
  @ApiOperation({ summary: "Get shipments for the logged-in client" })
  @ApiQuery({ name: "dateFrom", required: false, description: "Filter on or after this date (ISO 8601)" })
  @ApiQuery({ name: "dateTo", required: false, description: "Filter on or before this date (ISO 8601)" })
  @ApiOkResponse({ description: "List of shipments for the client" })
  @ApiResponse({ status: 403, description: "Forbidden – only client users" })
  async getShipments(
    @UserId() userId: string,
    @Query() query: ClientDateRangeQueryDto,
  ) {
    return this.clientsService.getShipments(userId, query);
  }

  @Patch("me")
  @RequirePermissionDecorator("client:update-own")
  @ApiOperation({ summary: "Update the logged-in client's own record (client users)" })
  @ApiExtraModels(UpdateClientDto, ClientResponseDto)
  @ApiBody({ type: UpdateClientDto })
  @ApiOkResponse({
    description: "Client updated successfully",
    type: ClientResponseDto,
  })
  @ApiResponse({ status: 403, description: "Forbidden – only client users with client:update-own" })
  async updateMe(
    @Body() updateClientDto: UpdateClientDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.clientsService.updateOwnClient(userId, userEmail, updateClientDto);
  }

  @Put("me")
  @RequirePermissionDecorator("client:update-own")
  @ApiOperation({ summary: "Replace the logged-in client's own record (client users)" })
  @ApiExtraModels(UpdateClientDto, ClientResponseDto)
  @ApiBody({ type: UpdateClientDto })
  @ApiOkResponse({
    description: "Client updated successfully",
    type: ClientResponseDto,
  })
  @ApiResponse({ status: 403, description: "Forbidden – only client users with client:update-own" })
  async replaceMe(
    @Body() updateClientDto: UpdateClientDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.clientsService.updateOwnClient(userId, userEmail, updateClientDto);
  }

  @Get(":id")
  @RequirePermissionDecorator("client:read")
  @ApiOperation({ summary: "Get client by ID" })
  @ApiParam({
    name: "id",
    description: "Client ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiOkResponse({
    description: "Client details",
    type: ClientResponseDto,
  })
  @ApiResponse({ status: 404, description: "Client not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findOne(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @UserId() userId: string,
  ) {
    return this.clientsService.findOne(id.toString(), userId);
  }

  @Patch(":id")
  @RequirePermissionDecorator("client:update")
  @ApiOperation({ summary: "Update client (partial)" })
  @ApiExtraModels(UpdateClientDto, ClientResponseDto)
  @ApiParam({
    name: "id",
    description: "Client ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdateClientDto })
  @ApiOkResponse({
    description: "Client updated successfully",
    type: ClientResponseDto,
  })
  @ApiResponse({ status: 404, description: "Client not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async update(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateClientDto: UpdateClientDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string, // ✅ agregado
  ) {
    return this.clientsService.update(id.toString(), updateClientDto, userId, userEmail);
  }

  @Put(":id")
  @RequirePermissionDecorator("client:update")
  @ApiOperation({ summary: "Replace client (full update)" })
  @ApiExtraModels(UpdateClientDto, ClientResponseDto)
  @ApiParam({
    name: "id",
    description: "Client ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdateClientDto })
  @ApiOkResponse({
    description: "Client updated successfully",
    type: ClientResponseDto,
  })
  @ApiResponse({ status: 404, description: "Client not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async replace(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateClientDto: UpdateClientDto,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.clientsService.update(id.toString(), updateClientDto, userId, userEmail);
  }

  @Delete(":id")
  @RequirePermissionDecorator("client:delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete client" })
  @ApiParam({
    name: "id",
    description: "Client ID",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiResponse({ status: 204, description: "Client deleted successfully" })
  @ApiResponse({ status: 404, description: "Client not found" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async remove(
    @Param("id", ParseObjectIdPipe) id: Types.ObjectId,
    @UserId() userId: string,
    @UserEmail() userEmail: string,
  ) {
    return this.clientsService.remove(id.toString(), userId, userEmail);
  }
}
