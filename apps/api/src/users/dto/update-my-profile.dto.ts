import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateMyProfileDto {
  @ApiPropertyOptional({
    example: "John",
    description: "User first name",
  })
  firstName?: string;

  @ApiPropertyOptional({
    example: "Doe",
    description: "User last name",
  })
  lastName?: string;

  @ApiPropertyOptional({
    example: "+1234567890",
    description: "User phone number",
  })
  phone?: string;

  @ApiPropertyOptional({
    example: "https://example.com/avatar.jpg",
    description: "User avatar URL",
  })
  avatar?: string;

  @ApiPropertyOptional({
    example: "en-US",
    description: "User locale",
  })
  locale?: string;

  @ApiPropertyOptional({
    example: "America/New_York",
    description: "User timezone",
  })
  timezone?: string;
}

