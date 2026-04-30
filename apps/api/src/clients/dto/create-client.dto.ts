import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsMongoId,
  IsBoolean,
  IsArray,
  IsDateString,
  ValidateNested,
  IsEmail,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";

export class ClientAddressDto {
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

export class ClientBillingAddressDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  street: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  state: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  zipCode: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  country: string;
}

export class ClientInvoiceInformationDto {
  @ApiProperty({ type: ClientBillingAddressDto, description: "Billing address" })
  @ValidateNested()
  @Type(() => ClientBillingAddressDto)
  billingAddress: ClientBillingAddressDto;

  @ApiProperty({ example: "billing@abccorp.com", description: "Invoice email" })
  @IsNotEmpty()
  @Matches(/\S/, { message: "invoiceEmail should not be empty" })
  @IsEmail()
  invoiceEmail: string;

  @ApiProperty({ example: "Net 30", description: "Payment terms" })
  @IsNotEmpty()
  @IsString()
  paymentTerms: string;

  @ApiProperty({ example: "VAT-123456", description: "Tax regime or VAT number" })
  @IsNotEmpty()
  @IsString()
  taxRegimeOrVatNumber: string;

  @ApiProperty({ example: "USD", description: "Invoice currency" })
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiProperty({ example: "Wire Transfer", description: "Preferred payment method" })
  @IsNotEmpty()
  @IsString()
  preferredPaymentMethod: string;
}

export class CreateClientDto {
  @ApiProperty({
    example: "ABC Corporation",
    description: "Client name",
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Office ID (MongoDB ObjectId)",
  })
  @IsNotEmpty()
  @IsMongoId()
  officeId: string;

  @ApiPropertyOptional({
    example: "John Doe",
    description: "Contact person name",
  })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiProperty({
    example: "contact@abccorp.com",
    description: "Client email",
  })
  @IsNotEmpty()
  @Matches(/\S/, { message: "email should not be empty" })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: "+1-555-0123",
    description: "Client phone",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    type: ClientAddressDto,
    description: "Client address",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClientAddressDto)
  address?: ClientAddressDto;

  @ApiPropertyOptional({
    example: "123456789",
    description: "Tax identification number",
  })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiProperty({
    type: ClientInvoiceInformationDto,
    description: "Client invoice information",
  })
  @ValidateNested()
  @Type(() => ClientInvoiceInformationDto)
  invoiceInformation: ClientInvoiceInformationDto;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description: "Whether the client is active",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: "string",
    format: "date-time",
    description: "Last contact date",
  })
  @IsOptional()
  @IsDateString()
  lastContactDate?: Date | string;

  @ApiPropertyOptional({
    type: [String],
    example: ["vip", "regular"],
    description: "Tags for categorization",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
