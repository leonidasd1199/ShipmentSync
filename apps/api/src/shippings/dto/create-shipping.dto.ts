import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
  IsBoolean,
  IsMongoId,
} from "class-validator";

export class CreateShippingDto {
  @ApiProperty({ example: "Maersk Line", description: "Shipping line name" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: "Maersk A/S", description: "Legal name of the shipping line" })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ example: "info@maersk.com", description: "Email address" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: "+504 9999-8888", description: "Phone number" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "https://www.maersk.com", description: "Website URL" })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: "Naviera global con operaciones en Honduras.", description: "Additional notes" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ["507f1f77bcf86cd799439011"],
    description: "Array of Agent ObjectIds to associate with this shipping line",
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  agents?: string[];

  @ApiProperty({
    type: [String],
    enum: ["maritime", "air", "road"],
    example: ["maritime", "road"],
    description: "Shipping modes: maritime, air, road, or combinations (at least one required)",
  })
  @IsArray()
  @IsIn(["maritime", "air", "road"], { each: true })
  shippingModes: ("maritime" | "air" | "road")[];

  @ApiPropertyOptional({ default: true, description: "Whether the shipping line is active" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
