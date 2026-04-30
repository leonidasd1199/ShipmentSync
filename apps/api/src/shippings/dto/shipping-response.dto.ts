import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ShippingAgentDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Agent ID (MongoDB ObjectId)",
  })
  _id: string;

  @ApiProperty({
    example: "John",
    description: "Agent first name",
  })
  firstName: string;

  @ApiProperty({
    example: "Doe",
    description: "Agent last name",
  })
  lastName: string;

  @ApiProperty({
    example: "john.doe@example.com",
    description: "Agent email",
  })
  email: string;

  @ApiPropertyOptional({
    example: "+504 9999-8888",
    description: "Agent phone",
  })
  phone?: string;
}

export class ShippingResponseDto {
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

  @ApiPropertyOptional({
    example: "Maersk A/S",
    description: "Legal name",
  })
  legalName?: string;

  @ApiPropertyOptional({
    example: "info@maersk.com",
    description: "Email address",
  })
  email?: string;

  @ApiPropertyOptional({
    example: "+504 9999-8888",
    description: "Phone number",
  })
  phone?: string;

  @ApiPropertyOptional({
    example: "https://www.maersk.com",
    description: "Website URL",
  })
  website?: string;

  @ApiPropertyOptional({
    example: "Naviera global con operaciones en Honduras.",
    description: "Additional notes",
  })
  notes?: string;

  @ApiPropertyOptional({
    type: [ShippingAgentDto],
    description: "List of agents associated with this shipping line",
  })
  agents?: ShippingAgentDto[];

  @ApiProperty({
    type: [String],
    enum: ["maritime", "air", "road"],
    example: ["maritime", "road"],
    description: "Shipping modes: maritime, air, road, or combinations",
    minItems: 1,
  })
  shippingModes: ("maritime" | "air" | "road")[];

  @ApiProperty({
    default: true,
    example: true,
    description: "Whether the shipping line is active",
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

export class CreateShippingResponseDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Shipping line ID (MongoDB ObjectId)",
  })
  id: string;

  @ApiProperty({
    example: "Maersk Line",
    description: "Shipping line name",
  })
  name: string;

  @ApiProperty({
    type: "string",
    format: "date-time",
    example: "2025-11-03T20:00:00Z",
    description: "Creation timestamp",
  })
  createdAt: Date | string;
}

export class AddAgentsResponseDto {
  @ApiProperty({
    example: true,
    description: "Whether the operation was successful",
  })
  success: boolean;

  @ApiProperty({
    example: 2,
    description: "Number of agents added",
  })
  added: number;
}

export class RemoveAgentsResponseDto {
  @ApiProperty({
    example: true,
    description: "Whether the operation was successful",
  })
  success: boolean;

  @ApiProperty({
    example: 2,
    description: "Number of agents removed",
  })
  removed: number;

  @ApiPropertyOptional({
    example: "Removed 2 agent(s) from shipping line.",
    description: "Optional message",
  })
  message?: string;
}

