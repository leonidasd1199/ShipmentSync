import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsString,
  IsArray,
  IsBoolean,
  IsOptional,
} from "class-validator";

export class SendToClientsDto {
  @ApiProperty({
    description:
      "Quotation ID. If sent without pricelistId, sends that quotation to its own client. If sent with pricelistId+pdf, used as the canonical quotationId for deliveries (do not create placeholder quotations).",
    example: "507f1f77bcf86cd799439015",
    required: false,
  })
  @IsOptional()
  @IsString()
  quotationId?: string;

  @ApiProperty({
    description: "Pricelist ID to distribute (required when sending pricelist; omit when quotationId is set)",
    example: "507f1f77bcf86cd799439012",
    required: false,
  })
  @IsString()
  @IsOptional()
  pricelistId?: string;

  @ApiProperty({
    description:
      "Optional array of client IDs. When provided, only these clients receive the pricelist. When omitted, use sendToAll (true = all active clients).",
    example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439013"],
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value == null ? undefined : [value]))
  @IsArray()
  @IsString({ each: true })
  clientIds?: string[];

  @ApiProperty({
    description:
      "When clientIds is omitted, if true send to all active clients; if false, clientIds must be provided. Ignored when clientIds is provided.",
    example: false,
    default: false,
  })
  @IsBoolean()
  sendToAll: boolean;

  @ApiProperty({
    description:
      "Optional JSON string of quote data (legacyItems, total, validUntil) so the stored QuotationDelivery matches the PDF. Used when sending pricelist from the quote screen.",
    required: false,
  })
  @IsOptional()
  @IsString()
  quoteSnapshot?: string;

  @ApiProperty({
    description:
      "Optional JSON string of legacyItems array only. When provided, used as the source of truth for snapshot legacyItems (avoids truncation of embedded array in quoteSnapshot).",
    required: false,
  })
  @IsOptional()
  @IsString()
  quoteSnapshotLegacyItems?: string;
}
