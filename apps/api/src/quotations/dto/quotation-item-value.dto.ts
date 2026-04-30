import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum } from "class-validator";

export class QuotationItemValueDto {
  @ApiPropertyOptional({
    example: "1",
    description: "Item ID from template items (optional for pricelist items)",
  })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({
    example: "Ocean Freight - 40ft Container",
    description: "Item description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 1250.0,
    description: "Selling price (cost + profit)",
  })
  @IsOptional()
  @IsNumber()
  price?: number | null;

  @ApiPropertyOptional({
    example: 900.0,
    description: "Raw cost before profit",
  })
  @IsOptional()
  @IsNumber()
  cost?: number | null;

  @ApiPropertyOptional({
    example: 2,
    description: "Quantity",
  })
  @IsOptional()
  @IsNumber()
  quantity?: number | null;

  @ApiPropertyOptional({
    example: 10,
    description: "Discount percentage",
  })
  @IsOptional()
  @IsNumber()
  discount?: number | null;

  @ApiPropertyOptional({
    example: "Item-specific notes",
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  applyTemplateDiscount?: boolean;

  @ApiPropertyOptional({
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  applyTaxes?: boolean;

  @ApiPropertyOptional({
    example: 16,
  })
  @IsOptional()
  @IsNumber()
  taxRate?: number | null;

  @ApiPropertyOptional({
    enum: ["cargo", "custom"],
    example: "cargo",
  })
  @IsOptional()
  @IsEnum(["cargo", "custom"])
  type?: "cargo" | "custom";

  @ApiPropertyOptional({
    enum: ["air", "land", "maritime"],
    example: "maritime",
  })
  @IsOptional()
  @IsEnum(["air", "land", "maritime"])
  transitType?: "air" | "land" | "maritime";

  @ApiPropertyOptional({
    example: "40HC",
    description: "Container/equipment type",
  })
  @IsOptional()
  @IsString()
  equipmentType?: string;
}
