import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsDateString, IsBoolean, IsArray, ValidateNested, IsNumber } from "class-validator";
import { Type } from "class-transformer";
import { QuotationHeaderFieldValueDto } from "./quotation-header-field-value.dto";
import { QuotationItemValueDto } from "./quotation-item-value.dto";
import { QuotationEquipmentItemValueDto } from "./quotation-equipment-item-value.dto";
import { QuotationPricingConfigDto } from "./quotation-pricing-config.dto";

// Legacy item DTO (for backward compatibility)
export class QuotationItemDto {
  @ApiProperty({
    enum: ["cargo", "custom"],
    example: "cargo",
  })
  @IsNotEmpty()
  @IsEnum(["cargo", "custom"])
  type: "cargo" | "custom";

  @ApiProperty({
    example: "40FT container transport",
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    example: 1250.0,
  })
  @IsNotEmpty()
  @IsNumber()
  price: number;

  @ApiPropertyOptional({
    example: "Estimated time: 7 days",
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    enum: ["air", "land", "maritime"],
    example: "maritime",
  })
  @IsOptional()
  @IsEnum(["air", "land", "maritime"])
  transitType?: "air" | "land" | "maritime";

  @ApiPropertyOptional({
    example: 900.0,
    description: "Raw cost before profit, used for ledger import",
  })
  @IsOptional()
  @IsNumber()
  cost?: number;

  @ApiPropertyOptional({
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional({
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiPropertyOptional({
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  applyTaxes?: boolean;

  @ApiPropertyOptional({
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  applyDiscount?: boolean;

  @ApiPropertyOptional({
    example: "40HC",
    description: "Equipment/container type",
  })
  @IsOptional()
  @IsString()
  equipmentType?: string;
}

export class CreateQuotationDto {
  @ApiProperty({
    example: "LCL",
    description: "Service type of the quotation",
  })
  @IsNotEmpty()
  @IsString()
  serviceType: string;

  @ApiProperty({
    example: "EXW",
    description: "Incoterm of the quotation",
  })
  @IsNotEmpty()
  @IsString()
  incoterm: string;

  @ApiPropertyOptional({
    enum: ["maritime", "air", "road"],
    example: "maritime",
    description: "Shipping mode of the quotation",
  })
  @IsOptional()
  @IsEnum(["maritime", "air", "road"])
  shippingMode?: "maritime" | "air" | "road";

  @ApiPropertyOptional({
    example: "507f1f77bcf86cd799439015",
    description: "Template ID (MongoDB ObjectId). If provided, quotation will be created from template.",
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
  })
  @IsNotEmpty()
  @IsString()
  clientId: string;

  @ApiProperty({
    example: "507f1f77bcf86cd799439012",
  })
  @IsNotEmpty()
  @IsString()
  companyId: string;

  @ApiProperty({
    example: "507f1f77bcf86cd799439013",
  })
  @IsNotEmpty()
  @IsString()
  shippingLineId: string;

  @ApiPropertyOptional({
    example: "507f1f77bcf86cd799439014",
  })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({
    example: "507f1f77bcf86cd799439016",
  })
  @IsOptional()
  @IsString()
  portOfOrigin?: string;

  @ApiPropertyOptional({
    example: "507f1f77bcf86cd799439017",
  })
  @IsOptional()
  @IsString()
  portOfDestination?: string;

  @ApiPropertyOptional({
    type: [QuotationHeaderFieldValueDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationHeaderFieldValueDto)
  headerFieldValues?: QuotationHeaderFieldValueDto[];

  @ApiPropertyOptional({
    type: [QuotationItemValueDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemValueDto)
  items?: QuotationItemValueDto[];

  @ApiPropertyOptional({
    type: [QuotationEquipmentItemValueDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationEquipmentItemValueDto)
  equipmentItems?: QuotationEquipmentItemValueDto[];

  @ApiPropertyOptional({
    type: QuotationPricingConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuotationPricingConfigDto)
  pricingConfig?: QuotationPricingConfigDto;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showAgentToClient?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showCarrierToClient?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showCommodityToClient?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showNotesToClient?: boolean;

  @ApiPropertyOptional({
    type: [QuotationItemDto],
    description: "Legacy items (custom quotations)",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  legacyItems?: QuotationItemDto[];

  @ApiPropertyOptional({
    example: "Urgent shipment, please prioritize",
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: "string",
    format: "date-time",
    example: "2025-12-31T23:59:59Z",
  })
  @IsNotEmpty()
  @IsDateString()
  validUntil: string | Date;

  @ApiPropertyOptional({
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  summarize?: boolean;

  @ApiPropertyOptional({
    enum: ["draft", "sent", "accepted", "rejected", "expired"],
    default: "draft",
  })
  @IsOptional()
  @IsEnum(["draft", "sent", "accepted", "rejected", "expired"])
  status?: "draft" | "sent" | "accepted" | "rejected" | "expired";

  @ApiPropertyOptional({
    example: "507f1f77bcf86cd799439016",
  })
  @IsOptional()
  @IsString()
  originPortId?: string;

  @ApiPropertyOptional({
    example: "507f1f77bcf86cd799439017",
  })
  @IsOptional()
  @IsString()
  destinationPortId?: string;

  @ApiPropertyOptional({
    example: "pl_abc123",
    description: "ID of the pricelist this quotation was generated from",
  })
  @IsOptional()
  @IsString()
  sourcePricelistId?: string;

}
