import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class QuotationEquipmentFieldValueDto {
  @ApiProperty({
    example: "size",
    description: "Field key from template equipmentItem.fields",
  })
  @IsNotEmpty()
  @IsString()
  fieldKey: string;

  @ApiProperty({
    example: "20DV",
    description: "Actual field value",
  })
  @IsOptional()
  value: any;
}

export class QuotationEquipmentItemValueDto {
  @ApiProperty({
    example: "1",
    description: "Equipment item ID from template equipmentItems",
  })
  @IsNotEmpty()
  @IsString()
  equipmentItemId: string;

  @ApiPropertyOptional({
    example: 2,
    description: "Actual quantity value",
  })
  @IsOptional()
  @IsNumber()
  quantity?: number | null;

  @ApiPropertyOptional({
    example: 2500.0,
    description: "Actual price value",
  })
  @IsOptional()
  @IsNumber()
  price?: number | null;

  @ApiPropertyOptional({
    example: 5,
    description: "Actual discount value",
  })
  @IsOptional()
  @IsNumber()
  discount?: number | null;

  @ApiPropertyOptional({
    type: [QuotationEquipmentFieldValueDto],
    description: "Field values for equipment subfields",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationEquipmentFieldValueDto)
  fieldValues?: QuotationEquipmentFieldValueDto[];

  @ApiPropertyOptional({
    example: "Equipment-specific notes",
    description: "Equipment-specific notes",
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: true,
    description: "Whether taxes apply to this equipment item",
  })
  @IsOptional()
  @IsBoolean()
  applyTaxes?: boolean;

  @ApiPropertyOptional({
    example: 15,
    description: "Tax rate percentage applied to this equipment item",
  })
  @IsOptional()
  @IsNumber()
  taxRate?: number | null;

  @ApiPropertyOptional({
    example: true,
    description: "Whether template-level discount applies to this equipment item (defaults to true/opt-in)",
  })
  @IsOptional()
  @IsBoolean()
  applyTemplateDiscount?: boolean;

  @ApiPropertyOptional({
    example: "Custom Label",
    description: "Custom label for this equipment item",
  })
  @IsOptional()
  @IsString()
  label?: string;
}

