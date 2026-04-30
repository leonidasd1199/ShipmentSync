import { IsOptional, IsString, MaxLength } from "class-validator";

export class ApproveShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}
