import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PortResponseDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Port ID",
  })
  _id: string;

  @ApiProperty({
    example: "Shanghai",
    description: "Port name",
  })
  name: string;

  @ApiPropertyOptional({
    example: "CNSHA",
    description: "UN/LOCODE",
  })
  unlocode?: string;

  @ApiPropertyOptional({
    example: "CN",
    description: "ISO 3166-1 alpha-2 country code",
  })
  countryCode?: string;

  @ApiPropertyOptional({
    example: "China",
    description: "Country name",
  })
  countryName?: string;

  @ApiPropertyOptional({
    example: "Shanghai",
    description: "City name",
  })
  city?: string;

  @ApiProperty({
    enum: ["sea", "air", "rail", "inland", "other"],
    example: "sea",
    description: "Port type",
  })
  type: "sea" | "air" | "rail" | "inland" | "other";

  @ApiPropertyOptional({
    example: 31.2304,
    description: "Latitude coordinate",
  })
  latitude?: number;

  @ApiPropertyOptional({
    example: 121.4737,
    description: "Longitude coordinate",
  })
  longitude?: number;

  @ApiProperty({
    default: true,
    example: true,
    description: "Whether the port is active",
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

export class CreatePortResponseDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Port ID",
  })
  id: string;

  @ApiProperty({
    example: "Shanghai",
    description: "Port name",
  })
  name: string;

  @ApiProperty({
    type: "string",
    format: "date-time",
    description: "Creation timestamp",
  })
  createdAt: Date | string;
}

