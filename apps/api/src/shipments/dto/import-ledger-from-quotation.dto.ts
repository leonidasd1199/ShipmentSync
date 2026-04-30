import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsMongoId, IsArray, IsString } from "class-validator";

export class ImportLedgerFromQuotationDto {
  @ApiProperty({
    description: "Quotation ID to import from",
    example: "507f1f77bcf86cd799439003",
  })
  @IsNotEmpty()
  @IsMongoId()
  quotationId: string;

  @ApiProperty({
    description: "Array of quotation item IDs to import",
    example: ["item-12345", "item-12346"],
    type: [String],
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  itemIds: string[];
}