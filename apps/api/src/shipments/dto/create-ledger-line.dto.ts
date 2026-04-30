import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsMongoId,
  Min,
} from "class-validator";
import { LedgerSide } from "../../schemas/shipment-ledger-line.schema";

export class CreateLedgerLineDto {
  @ApiProperty({
    description: "Ledger side",
    enum: LedgerSide,
    example: LedgerSide.DEBIT,
  })
  @IsNotEmpty()
  @IsEnum(LedgerSide)
  side: LedgerSide;

  @ApiProperty({
    description: "Description",
    example: "Ocean Freight - FCL Container",
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: "Amount",
    example: 2500.0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: "Currency",
    example: "USD",
    default: "USD",
  })
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiPropertyOptional({
    description: "Supplier ID (overrides the shipment's default supplier)",
    example: "507f1f77bcf86cd799439012",
  })
  @IsOptional()
  @IsMongoId()
  supplierId?: string;

  @ApiPropertyOptional({
    description: "Base currency",
    example: "USD",
    default: "USD",
  })
  @IsOptional()
  @IsString()
  baseCurrency?: string;

  @ApiPropertyOptional({
    description: "FX rate",
    example: 1.0,
    default: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fxRate?: number;
}