import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
} from "class-validator";
import { ShipmentMode } from "../../schemas/shipment.schema";
import { DocumentType } from "../../schemas/shipment-document.schema";

export class CreateDocumentTemplateDto {
  @ApiProperty({
    description: "Shipment mode",
    enum: ShipmentMode,
    example: ShipmentMode.OCEAN,
  })
  @IsNotEmpty()
  @IsEnum(ShipmentMode)
  mode: ShipmentMode;

  @ApiProperty({
    description: "Document type",
    enum: DocumentType,
    example: DocumentType.BL,
  })
  @IsNotEmpty()
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({
    description: "HTML template (Handlebars)",
    example: "<html><body><h1>{{shipment.bookingNumber}}</h1></body></html>",
  })
  @IsNotEmpty()
  @IsString()
  html: string;

  @ApiPropertyOptional({
    description: "CSS styles",
    example: "body { font-family: Arial; }",
  })
  @IsOptional()
  @IsString()
  css?: string;
}
