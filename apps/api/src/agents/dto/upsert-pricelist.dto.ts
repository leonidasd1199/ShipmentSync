import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
  MinLength,
  IsDateString,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";
import {
  MaritimeIncoterm,
  MARITIME_INCOTERMS,
  Currency,
  CURRENCIES,
} from "../../common/enums/maritime-incoterms.enum";
import {
  ChargeType,
  CHARGE_TYPES,
  EquipmentType,
  EQUIPMENT_TYPES,
  PricingUnit,
  PRICING_UNITS,
} from "../../common/enums/pricelist-item.enum";

export class UpsertPricelistItemLaneDto {
  @ApiPropertyOptional({
    example: "USNYC",
    description: "Origin port code",
  })
  @IsOptional()
  @IsString()
  originPortCode?: string;

  @ApiPropertyOptional({
    example: "CNPVG",
    description: "Destination port code",
  })
  @IsOptional()
  @IsString()
  destinationPortCode?: string;

  @ApiPropertyOptional({
    example: "New York",
    description: "Origin port name",
  })
  @IsOptional()
  @IsString()
  originName?: string;

  @ApiPropertyOptional({
    example: "Shanghai",
    description: "Destination port name",
  })
  @IsOptional()
  @IsString()
  destinationName?: string;
}

export class UpsertPricelistItemDto {
  @ApiProperty({
    example: "40FT Container Transport",
    description: "Item name",
    minLength: 1,
    maxLength: 200,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1, { message: "Name must be at least 1 character" })
  @MaxLength(200, { message: "Name must not exceed 200 characters" })
  name: string;

  @ApiProperty({
    enum: CHARGE_TYPES,
    example: "OCEAN_FREIGHT",
    description: "Type of charge",
  })
  @IsNotEmpty()
  @IsEnum(ChargeType, {
    message: `chargeType must be one of: ${CHARGE_TYPES.join(", ")}`,
  })
  chargeType: ChargeType;

  @ApiProperty({
    enum: MARITIME_INCOTERMS,
    example: "FOB",
    description: "Maritime incoterm (ICC 2020)",
  })
  @IsNotEmpty()
  @IsEnum(MaritimeIncoterm, {
    message: `incoterm must be one of: ${MARITIME_INCOTERMS.join(", ")}`,
  })
  incoterm: MaritimeIncoterm;

  @ApiPropertyOptional({
    enum: EQUIPMENT_TYPES,
    example: "40GP",
    description: "Equipment type",
  })
  @IsOptional()
  @IsEnum(EquipmentType, {
    message: `equipmentType must be one of: ${EQUIPMENT_TYPES.join(", ")}`,
  })
  equipmentType?: EquipmentType;

  @ApiPropertyOptional({
    type: UpsertPricelistItemLaneDto,
    description: "Lane information (origin and destination ports)",
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpsertPricelistItemLaneDto)
  lane?: UpsertPricelistItemLaneDto;

  @ApiProperty({
    example: 1250.0,
    description: "Cost amount (must be >= 0)",
    minimum: 0,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "Cost must be a valid number with max 2 decimal places" },
  )
  @Min(0, { message: "Cost must be >= 0" })
  cost: number;

  @ApiPropertyOptional({
    example: 200.0,
    description: "Profit/markup amount (must be >= 0)",
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "Profit must be a valid number with max 2 decimal places" },
  )
  @Min(0, { message: "Profit must be >= 0" })
  profit?: number;

  @ApiProperty({
    enum: CURRENCIES,
    example: "USD",
    description: "Currency code",
  })
  @IsNotEmpty()
  @IsEnum(Currency, {
    message: `currency must be one of: ${CURRENCIES.join(", ")}`,
  })
  currency: Currency;

  @ApiPropertyOptional({
    enum: PRICING_UNITS,
    example: "PER_CONTAINER",
    description: "Pricing unit",
  })
  @IsOptional()
  @IsEnum(PricingUnit, {
    message: `pricingUnit must be one of: ${PRICING_UNITS.join(", ")}`,
  })
  pricingUnit?: PricingUnit;

  @ApiPropertyOptional({
    example: "2024-01-01T00:00:00Z",
    description: "Valid from date (ISO 8601)",
  })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({
    example: "2024-12-31T23:59:59Z",
    description: "Valid to date (ISO 8601)",
  })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({
    example: 7,
    description: "Free time in days",
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: "freeTimeDays must be >= 0" })
  freeTimeDays?: number;

  @ApiPropertyOptional({
    example: 20,
    description: "Minimum transit time in days",
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: "transitTimeDaysMin must be >= 0" })
  transitTimeDaysMin?: number;

  @ApiPropertyOptional({
    example: 30,
    description: "Maximum transit time in days",
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: "transitTimeDaysMax must be >= 0" })
  transitTimeDaysMax?: number;

  @ApiPropertyOptional({
    example: "Maersk Line",
    description: "Carrier name",
  })
  @IsOptional()
  @IsString()
  carrierName?: string;

  @ApiPropertyOptional({
    description: "Optional metadata (any JSON-serializable object)",
    example: { notes: "Rush order available", minQuantity: 10 },
  })
  @IsOptional()
  metadata?: any;
}

export class UpsertPricelistDto {
  @ApiProperty({
    type: [UpsertPricelistItemDto],
    description: "Array of pricelist items",
    minItems: 1,
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertPricelistItemDto)
  items: UpsertPricelistItemDto[];
}
