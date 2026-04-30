import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ClientAddressDto } from "./create-client.dto";

export class ClientOfficeDto {
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
}



export class ClientInvoiceInformationResponseDto {
  @ApiProperty({ type: ClientAddressDto, description: "Billing address" })
  billingAddress: ClientAddressDto;

  @ApiProperty({ example: "billing@abccorp.com", description: "Invoice email" })
  invoiceEmail: string;

  @ApiProperty({ example: "Net 30", description: "Payment terms" })
  paymentTerms: string;

  @ApiProperty({ example: "VAT-123", description: "Tax regime / VAT number" })
  taxRegimeOrVatNumber: string;

  @ApiProperty({ example: "USD", description: "Currency" })
  currency: string;

  @ApiProperty({ example: "Wire Transfer", description: "Preferred payment method" })
  preferredPaymentMethod: string;
}

export class ClientResponseDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Client ID (MongoDB ObjectId)",
  })
  _id: string;

  @ApiProperty({
    example: "ABC Corporation",
    description: "Client name",
  })
  name: string;

  @ApiProperty({
    type: ClientOfficeDto,
    description: "Office information",
  })
  office: ClientOfficeDto;

  @ApiPropertyOptional({
    example: "John Doe",
    description: "Contact person name",
  })
  contactPerson?: string;

  @ApiPropertyOptional({
    example: "contact@abccorp.com",
    description: "Client email",
  })
  email?: string;

  @ApiPropertyOptional({
    example: "+1-555-0123",
    description: "Client phone",
  })
  phone?: string;

  @ApiPropertyOptional({
    type: ClientAddressDto,
    description: "Client address",
  })
  address?: ClientAddressDto;

  @ApiPropertyOptional({
    example: "123456789",
    description: "Tax identification number",
  })
  taxId?: string;

  @ApiPropertyOptional({
    type: ClientInvoiceInformationResponseDto,
    description: "Invoice information",
  })
  invoiceInformation?: ClientInvoiceInformationResponseDto;

  @ApiProperty({
    default: true,
    example: true,
    description: "Whether the client is active",
  })
  isActive: boolean;

  @ApiPropertyOptional({
    type: "string",
    format: "date-time",
    description: "Last contact date",
  })
  lastContactDate?: Date | string;

  @ApiPropertyOptional({
    type: [String],
    example: ["vip", "regular"],
    description: "Tags for categorization",
  })
  tags?: string[];

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

