import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional } from "class-validator";

export class QuotationHeaderFieldValueDto {
  @ApiProperty({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "Field ID from template headerFields",
  })
  @IsNotEmpty()
  @IsString()
  fieldId: string;

  @ApiProperty({
    example: "Shanghai",
    description: "The actual value filled in by user (can be empty string for optional fields)",
  })
  @IsOptional()
  value: any;
}

