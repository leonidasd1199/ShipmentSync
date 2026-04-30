import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateUserDto {
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
    example: "john.doe@example.com",
    description: "User email address",
  })
  email?: string;

  @ApiPropertyOptional({
    example: "+1234567890",
    description: "User phone number",
  })
  phone?: string;

  @ApiPropertyOptional({
    example: "123 Main St, City, State",
    description: "User address",
  })
  address?: string;
}

