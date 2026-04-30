import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsDateString } from "class-validator";

/**
 * Query DTO for date range filtering (dateFrom / dateTo as ISO date strings).
 */
export class ClientDateRangeQueryDto {
  @ApiPropertyOptional({
    description: "Filter records on or after this date (ISO 8601)",
    example: "2025-01-01",
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: "Filter records on or before this date (ISO 8601)",
    example: "2025-12-31",
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
