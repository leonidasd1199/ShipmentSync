import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ShippingLineHelperDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Shipping line ID (MongoDB ObjectId)",
  })
  _id: string;

  @ApiProperty({
    example: "Maersk Line",
    description: "Shipping line name",
  })
  name: string;
}

export class AgentHelperDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Agent ID (MongoDB ObjectId)",
  })
  _id: string;

  @ApiProperty({
    example: "Juan Ramírez",
    description: "Agent full name (firstName + lastName)",
  })
  name: string;
}

export class CompanyAddressDto {
  @ApiPropertyOptional()
  street?: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  state?: string;

  @ApiPropertyOptional()
  zipCode?: string;

  @ApiPropertyOptional()
  country?: string;
}

export class CompanyHelperDto {
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

  @ApiPropertyOptional({
    example: "Company description",
  })
  description?: string;

  @ApiPropertyOptional({
    example: "123456789",
  })
  taxId?: string;

  @ApiPropertyOptional({
    example: "company@example.com",
  })
  email?: string;

  @ApiPropertyOptional({
    example: "+504 9999-8888",
  })
  phone?: string;

  @ApiPropertyOptional({
    type: CompanyAddressDto,
  })
  address?: CompanyAddressDto;

  @ApiProperty({
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    type: "string",
    format: "date-time",
  })
  createdAt: Date | string;

  @ApiPropertyOptional({
    type: "string",
    format: "date-time",
  })
  updatedAt?: Date | string;
}

export class ClientHelperDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Client ID (MongoDB ObjectId)",
  })
  _id: string;

  @ApiProperty({
    example: "Client Name",
    description: "Client name",
  })
  clientName: string;
}

