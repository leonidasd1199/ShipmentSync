import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdatePortDto {
  @ApiPropertyOptional({
    example: "Shanghai",
    description: "Port name",
  })
  name?: string;

  @ApiPropertyOptional({
    example: "CNSHA",
    description: "UN/LOCODE (e.g., CNSHA)",
  })
  unlocode?: string;

  @ApiPropertyOptional({
    example: "CN",
    description: "ISO 3166-1 alpha-2 country code (e.g., CN, HN)",
    maxLength: 2,
    minLength: 2,
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

  @ApiPropertyOptional({
    enum: ["sea", "air", "rail", "inland", "other"],
    example: "sea",
    description: "Port type",
  })
  type?: "sea" | "air" | "rail" | "inland" | "other";

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

  @ApiPropertyOptional({
    default: true,
    example: true,
    description: "Whether the port is active",
  })
  isActive?: boolean;
}

