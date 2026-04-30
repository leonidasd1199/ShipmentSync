import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsMongoId,
  IsBoolean,
  IsIn,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { OfficeInvoicingInputDto } from "./office-invoicing.dto";

const OFFICE_TYPES = [
  "headquarters",
  "warehouse",
  "operations",
  "distribution",
  "hub",
  "branch",
] as const;

export class OfficeAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;
}

export class CreateOfficeDto {
  @ApiProperty({
    example: "New York Office",
    description: "Office name",
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Company ID (MongoDB ObjectId)",
  })
  @IsNotEmpty()
  @IsMongoId()
  companyId: string;

  @ApiPropertyOptional({
    example: "Main office location",
    description: "Office description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: OFFICE_TYPES,
    example: "headquarters",
    description: "Office type",
  })
  @IsOptional()
  @IsIn(OFFICE_TYPES)
  type?: (typeof OFFICE_TYPES)[number];

  @ApiPropertyOptional({
    example: "office@example.com",
    description: "Office email",
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    example: "+1-555-0123",
    description: "Office phone",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    type: OfficeAddressDto,
    description: "Office address",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => OfficeAddressDto)
  address?: OfficeAddressDto;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description: "Whether the office is active",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: OfficeInvoicingInputDto,
    description: "Invoicing / fiscal configuration for this office",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => OfficeInvoicingInputDto)
  invoicing?: OfficeInvoicingInputDto;
}

