import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UserCompanyDto {
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
}

export class UserRoleDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Role ID (MongoDB ObjectId)",
  })
  _id: string;

  @ApiProperty({
    example: "admin",
    description: "Role code",
  })
  code: string;

  @ApiProperty({
    example: "Administrator",
    description: "Role name",
  })
  name: string;
}

export class UserOfficeDto {
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

export class UserPermissionDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Permission ID (MongoDB ObjectId)",
  })
  _id: string;

  @ApiProperty({
    example: "user:create",
    description: "Permission code",
  })
  code: string;

  @ApiProperty({
    example: "Create User",
    description: "Permission name",
  })
  name: string;
}

export class UserResponseDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "User ID (MongoDB ObjectId)",
  })
  _id: string;

  @ApiProperty({
    example: "John",
    description: "User first name",
  })
  firstName: string;

  @ApiProperty({
    example: "Doe",
    description: "User last name",
  })
  lastName: string;

  @ApiProperty({
    example: "john.doe@example.com",
    description: "User email",
  })
  email: string;

  @ApiProperty({
    example: "admin",
    description: "Role code",
  })
  roleCode: string;

  @ApiProperty({
    type: UserRoleDto,
    description: "User role",
  })
  role: UserRoleDto;

  @ApiProperty({
    type: UserCompanyDto,
    description: "User company",
  })
  company: UserCompanyDto;

  @ApiPropertyOptional({
    type: [UserOfficeDto],
    description: "User offices",
  })
  offices?: UserOfficeDto[];

  @ApiPropertyOptional({
    type: [UserPermissionDto],
    description: "User permissions",
  })
  permissions?: UserPermissionDto[];

  @ApiProperty({
    default: true,
    example: true,
    description: "Whether the user is active",
  })
  isActive: boolean;

  @ApiPropertyOptional({
    example: "+1234567890",
    description: "User phone",
  })
  phone?: string;

  @ApiPropertyOptional({
    example: "123 Main St",
    description: "User address",
  })
  address?: string;

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

export class ResetPasswordResponseDto {
  @ApiProperty({
    example: "Password reset successfully",
    description: "Success message",
  })
  message: string;

  @ApiProperty({
    type: UserResponseDto,
    description: "Updated user",
  })
  user: UserResponseDto;

  @ApiProperty({
    example: "TempPass123!",
    description: "Generated temporary password",
  })
  temporaryPassword: string;
}

