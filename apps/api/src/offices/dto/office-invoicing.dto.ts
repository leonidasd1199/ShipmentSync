import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class OfficeInvoicingAddressDto {
  @ApiProperty({ example: "123 Main St" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  street: string;

  @ApiProperty({ example: "New York" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: "NY" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  state: string;

  @ApiProperty({ example: "10001" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  zipCode: string;

  @ApiProperty({ example: "US" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  country: string;
}

export class OfficeInvoiceRangeDto {
  @ApiProperty({ example: 1, description: "First invoice number in range" })
  @IsInt()
  @Min(1)
  from: number;

  @ApiProperty({ example: 9999, description: "Last invoice number in range" })
  @IsInt()
  @Min(1)
  to: number;
}

/** Client input for office invoicing (never includes lastUsedInvoiceNumber). */
export class OfficeInvoicingInputDto {
  @ApiPropertyOptional({
    description: "CAI — número de impresiones de autorización",
    example: "12345678901234",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cai?: string;

  @ApiProperty({ example: "12-3456789" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  ein: string;

  @ApiProperty({ example: "billing@company.com" })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(120)
  email: string;

  @ApiProperty({ type: OfficeInvoicingAddressDto })
  @ValidateNested()
  @Type(() => OfficeInvoicingAddressDto)
  address: OfficeInvoicingAddressDto;

  @ApiProperty({ type: OfficeInvoiceRangeDto })
  @ValidateNested()
  @Type(() => OfficeInvoiceRangeDto)
  invoiceRange: OfficeInvoiceRangeDto;
}
