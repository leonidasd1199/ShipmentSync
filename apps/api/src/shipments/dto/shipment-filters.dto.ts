import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsEnum,
  IsString,
  IsMongoId,
} from "class-validator";
import { ShipmentStatus, ShipmentMode } from "../../schemas/shipment.schema";

export class ShipmentFiltersDto {
  @ApiPropertyOptional({
    description: "Filter by status",
    enum: ShipmentStatus,
  })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional({
    description: "Filter by office ID",
  })
  @IsOptional()
  @IsMongoId()
  officeId?: string;

  @ApiPropertyOptional({
    description: "Filter by company ID",
  })
  @IsOptional()
  @IsMongoId()
  companyId?: string;

  @ApiPropertyOptional({
    description: "Filter by mode",
    enum: ShipmentMode,
  })
  @IsOptional()
  @IsEnum(ShipmentMode)
  mode?: ShipmentMode;

  @ApiPropertyOptional({
    description: "Filter by incoterm",
    example: "FOB",
  })
  @IsOptional()
  @IsString()
  incoterm?: string;

  @ApiPropertyOptional({
    description: "Search term (searches in booking number, MBL, HBL, etc.)",
    example: "BK-2026",
  })
  @IsOptional()
  @IsString()
  search?: string;
}