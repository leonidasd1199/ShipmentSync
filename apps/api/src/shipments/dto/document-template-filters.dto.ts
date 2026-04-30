import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsEnum, IsBoolean } from "class-validator";
import { ShipmentMode } from "../../schemas/shipment.schema";
import { DocumentType } from "../../schemas/shipment-document.schema";

export class DocumentTemplateFiltersDto {
  @ApiPropertyOptional({
    description: "Filter by mode",
    enum: ShipmentMode,
  })
  @IsOptional()
  @IsEnum(ShipmentMode)
  mode?: ShipmentMode;

  @ApiPropertyOptional({
    description: "Filter by document type",
    enum: DocumentType,
  })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiPropertyOptional({
    description: "Filter by active status",
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
