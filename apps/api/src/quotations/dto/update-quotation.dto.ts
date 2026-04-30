import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsEnum, IsDateString, IsBoolean, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { QuotationItemDto } from "./create-quotation.dto";
import { QuotationItemValueDto } from "./quotation-item-value.dto";
import { QuotationEquipmentItemValueDto } from "./quotation-equipment-item-value.dto";
import { QuotationPricingConfigDto } from "./quotation-pricing-config.dto";
import { QuotationHeaderFieldValueDto } from "./quotation-header-field-value.dto";

export class UpdateQuotationDto {
  @ApiPropertyOptional({
    example: "LCL",
  })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiPropertyOptional({
    example: "EXW",
  })
  @IsOptional()
  @IsString()
  incoterm?: string;

  @ApiPropertyOptional({
    enum: ["maritime", "air", "road"],
  })
  @IsOptional()
  @IsEnum(["maritime", "air", "road"])
  shippingMode?: "maritime" | "air" | "road";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shippingLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({
    type: [QuotationItemValueDto],
    description: "Template-based items",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemValueDto)
  items?: QuotationItemValueDto[];

  @ApiPropertyOptional({
    type: [QuotationItemDto],
    description: "Legacy items",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  legacyItems?: QuotationItemDto[];

  @ApiPropertyOptional({
    type: [QuotationEquipmentItemValueDto],
    description: "Equipment items",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationEquipmentItemValueDto)
  equipmentItems?: QuotationEquipmentItemValueDto[];

  @ApiPropertyOptional({
    type: QuotationPricingConfigDto,
    description: "Pricing configuration",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuotationPricingConfigDto)
  pricingConfig?: QuotationPricingConfigDto;

  @ApiPropertyOptional({
    type: [QuotationHeaderFieldValueDto],
    description: "Header field values",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationHeaderFieldValueDto)
  headerFieldValues?: QuotationHeaderFieldValueDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    type: "string",
    format: "date-time",
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string | Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  summarize?: boolean;

  @ApiPropertyOptional({
    enum: ["draft", "sent", "accepted", "rejected", "expired"],
  })
  @IsOptional()
  @IsEnum(["draft", "sent", "accepted", "rejected", "expired"])
  status?: "draft" | "sent" | "accepted" | "rejected" | "expired";

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showAgentToClient?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showCarrierToClient?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showCommodityToClient?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showNotesToClient?: boolean;

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
}
