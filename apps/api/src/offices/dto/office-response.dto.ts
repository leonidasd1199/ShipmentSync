import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OfficeAddressDto } from "./create-office.dto";

export class OfficeInvoicingRangeResponseDto {
  @ApiProperty({ example: 1 })
  from: number;

  @ApiProperty({ example: 9999 })
  to: number;
}

export class OfficeInvoicingResponseDto {
  @ApiPropertyOptional({ description: "CAI (número de impresiones de autorización)" })
  cai?: string;

  @ApiPropertyOptional()
  ein?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional({ type: OfficeAddressDto })
  address?: OfficeAddressDto;

  @ApiPropertyOptional({ type: OfficeInvoicingRangeResponseDto })
  invoiceRange?: OfficeInvoicingRangeResponseDto;

  @ApiPropertyOptional({
    description: "Last invoice number issued (server-managed)",
  })
  lastUsedInvoiceNumber?: number;
}

export class OfficeCompanyDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Company ID (MongoDB ObjectId)",
  })
  _id: string;

  @ApiProperty({
    example: "Company Name",
    description: "Company name",
  })
  name: string;
}

export class OfficeResponseDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Office ID (MongoDB ObjectId)",
  })
  _id: string;

  @ApiProperty({
    example: "New York Office",
    description: "Office name",
  })
  name: string;

  @ApiProperty({
    type: OfficeCompanyDto,
    description: "Company information",
  })
  company: OfficeCompanyDto;

  @ApiPropertyOptional({
    example: "Main office location",
    description: "Office description",
  })
  description?: string;

  @ApiPropertyOptional({
    enum: ["headquarters", "warehouse", "operations", "distribution", "hub", "branch"],
    example: "headquarters",
    description: "Office type",
  })
  type?: string;

  @ApiPropertyOptional({
    example: "office@example.com",
    description: "Office email",
  })
  email?: string;

  @ApiPropertyOptional({
    example: "+1-555-0123",
    description: "Office phone",
  })
  phone?: string;

  @ApiPropertyOptional({
    type: OfficeAddressDto,
    description: "Office address",
  })
  address?: OfficeAddressDto;

  @ApiPropertyOptional({
    type: OfficeInvoicingResponseDto,
    description: "Invoicing configuration",
  })
  invoicing?: OfficeInvoicingResponseDto;

  @ApiProperty({
    default: true,
    example: true,
    description: "Whether the office is active",
  })
  isActive: boolean;

  @ApiProperty({
    type: "string",
    format: "date-time",
    description: "Creation timestamp",
  })
  createdAt: Date | string;

  @ApiProperty({
    type: "string",
    format: "date-time",
    description: "Last update timestamp",
  })
  updatedAt: Date | string;
}

