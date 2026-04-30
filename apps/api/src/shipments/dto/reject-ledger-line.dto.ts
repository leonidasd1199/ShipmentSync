import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class RejectLedgerLineDto {
  @ApiProperty({
    description: "Rejection reason",
    example: "Amount exceeds budget limit",
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}