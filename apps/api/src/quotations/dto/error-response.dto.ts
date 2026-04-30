import { ApiProperty } from "@nestjs/swagger";

export class BadRequestErrorDto {
  @ApiProperty({
    example: 400,
    description: "HTTP status code",
  })
  statusCode: number;

  @ApiProperty({
    example: "Bad Request",
    description: "Error message",
  })
  message: string | string[];

  @ApiProperty({
    example: "Bad Request",
    description: "Error type",
  })
  error: string;
}

export class ForbiddenErrorDto {
  @ApiProperty({
    example: 403,
    description: "HTTP status code",
  })
  statusCode: number;

  @ApiProperty({
    example: "Forbidden",
    description: "Error message",
  })
  message: string;

  @ApiProperty({
    example: "Forbidden",
    description: "Error type",
  })
  error: string;
}

export class NotFoundErrorDto {
  @ApiProperty({
    example: 404,
    description: "HTTP status code",
  })
  statusCode: number;

  @ApiProperty({
    example: "Resource not found",
    description: "Error message",
  })
  message: string;

  @ApiProperty({
    example: "Not Found",
    description: "Error type",
  })
  error: string;
}

