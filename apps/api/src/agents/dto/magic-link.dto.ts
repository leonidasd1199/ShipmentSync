import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsMongoId,
} from "class-validator";

export class GenerateMagicLinkDto {
  @ApiProperty({
    description: "Agent MongoDB ObjectId",
    example: "507f1f77bcf86cd799439011",
  })
  @IsMongoId()
  agentId: string;

  @ApiPropertyOptional({
    description: "Purpose of the magic link",
    enum: ["onboarding", "support", "temporary"],
    default: "temporary",
  })
  @IsOptional()
  @IsEnum(["onboarding", "support", "temporary"])
  purpose?: "onboarding" | "support" | "temporary";

  @ApiPropertyOptional({
    description: "Optional notes about the link",
    example: "Agent onboarding for new shipping line",
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      "Expiration time in hours (minimum: 72, default: 72). Links can be used multiple times until expiration.",
    example: 72,
    minimum: 72,
    default: 72,
  })
  @IsOptional()
  @IsNumber()
  @Min(72, { message: "Expiration must be at least 72 hours" })
  expiresInHours?: number;
}

export class MagicLinkResponseDto {
  @ApiProperty({
    description: "The generated magic link URL",
    example: "https://app.example.com/agent/auth?token=abc123...",
  })
  magicLink: string;

  @ApiProperty({
    description: "Expiration date/time in ISO format",
    example: "2025-01-30T15:30:00.000Z",
  })
  expiresAt: string;

  @ApiProperty({
    description: "Purpose of the magic link",
    enum: ["onboarding", "support", "temporary"],
  })
  purpose: "onboarding" | "support" | "temporary";

  @ApiProperty({
    description: "Agent email address",
    example: "agent@example.com",
  })
  agentEmail: string;

  @ApiProperty({
    description: "Agent full name",
    example: "Juan Ramírez",
  })
  agentName: string;
}

export class ValidateMagicLinkDto {
  @ApiProperty({
    description: "The raw token from the magic link URL",
    example: "a1b2c3d4e5f6...",
  })
  @IsString()
  token: string;
}

export class MagicLinkInfoDto {
  @ApiProperty({
    description: "Magic link ID",
    example: "507f1f77bcf86cd799439011",
  })
  id: string;

  @ApiProperty({
    description: "Purpose of the magic link",
    enum: ["onboarding", "support", "temporary"],
  })
  purpose: string;

  @ApiProperty({
    description: "Expiration date",
  })
  expiresAt: Date;

  @ApiProperty({
    description: "Whether the link has been revoked",
  })
  revoked: boolean;

  @ApiProperty({
    description: "Number of times the link has been used",
  })
  useCount: number;

  @ApiPropertyOptional({
    description: "Last time the link was used",
  })
  lastUsedAt?: Date;

  @ApiProperty({
    description: "Creation date",
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: "Email of user who created the link",
  })
  createdBy?: string;

  @ApiPropertyOptional({
    description: "Notes about the link",
  })
  notes?: string;

  @ApiProperty({
    description: "Whether the link is currently active (not revoked and not expired)",
  })
  isActive: boolean;
}