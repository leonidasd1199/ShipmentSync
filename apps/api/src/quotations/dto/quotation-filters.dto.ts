import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  IsIn,
} from "class-validator";

export class QuotationFiltersDto {
  @ApiPropertyOptional({
    type: String,
    description: "Filter by client ID",
    example: "507f1f77bcf86cd799439011",
  })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Filter by user who created the quotation",
    example: "507f1f77bcf86cd799439012",
  })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({
    enum: ["maritime", "air", "land"],
    description:
      "Filter by transit type. Returns quotations that contain at least one legacy cargo item with the specified transitType. Note: This filter only applies to legacy items, not template-based items.",
    example: "maritime",
  })
  @IsOptional()
  @IsEnum(["maritime", "air", "land"])
  chargeType?: "maritime" | "air" | "land";

  @ApiPropertyOptional({
    type: String,
    description: "Filter by creation date from (ISO date string)",
    example: "2025-01-01T00:00:00Z",
  })
  @IsOptional()
  @IsString()
  createdAtFrom?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Filter by creation date to (ISO date string)",
    example: "2025-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsString()
  createdAtTo?: string;

  @ApiPropertyOptional({
    type: String,
    description: "Filter by shipping line ID",
    example: "507f1f77bcf86cd799439013",
  })
  @IsOptional()
  @IsString()
  shippingLineId?: string;

  @ApiPropertyOptional({
    type: Number,
    description: "Page number (default: 1, min: 1)",
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    type: Number,
    description: "Items per page (default: 50, min: 1, max: 100)",
    example: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    type: String,
    description:
      "Field to sort by (default: createdAt). Allowed: createdAt, validUntil, clientId, createdBy",
    example: "createdAt",
  })
  @IsOptional()
  @IsString()
  @IsIn(["createdAt", "validUntil", "clientId", "createdBy"])
  sort?: string;

  @ApiPropertyOptional({
    enum: ["ASC", "DESC"],
    description: "Sort order (default: DESC)",
    example: "DESC",
  })
  @IsOptional()
  @IsEnum(["ASC", "DESC"])
  order?: "ASC" | "DESC";

  @ApiPropertyOptional({ type: String, description: "Filter by source pricelist ID" })
  @IsOptional()
  @IsString()
  sourcePricelistId?: string;

  @ApiPropertyOptional({
    enum: ["draft", "sent", "accepted", "rejected", "expired"],
    description: "Filter by quotation status",
    example: "sent",
  })
  @IsOptional()
  @IsEnum(["draft", "sent", "accepted", "rejected", "expired"])
  status?: "draft" | "sent" | "accepted" | "rejected" | "expired";
}
