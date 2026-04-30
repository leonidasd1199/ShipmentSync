import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsBoolean } from "class-validator";

export class QuotationPricingConfigDto {
  @ApiProperty({
    example: "USD",
    description: "Currency code",
  })
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiPropertyOptional({
    example: 1000,
    description: "Base template price (optional)",
  })
  @IsOptional()
  @IsNumber()
  templatePrice?: number | null;

  @ApiPropertyOptional({
    example: 10,
    description: "Template discount percentage (0-100)",
  })
  @IsOptional()
  @IsNumber()
  templateDiscount?: number | null;

  @ApiPropertyOptional({
    default: false,
    example: true,
    description: "Whether template discount applies",
  })
  @IsOptional()
  @IsBoolean()
  applyTemplateDiscount?: boolean;

  @ApiPropertyOptional({
    example: 15,
    description: "Template tax rate percentage (0-100)",
  })
  @IsOptional()
  @IsNumber()
  templateTaxRate?: number | null;

  @ApiPropertyOptional({
    default: false,
    example: true,
    description: "Whether template taxes apply",
  })
  @IsOptional()
  @IsBoolean()
  applyTemplateTaxes?: boolean;
}

