import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsOptional, Validate, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CreateShipmentDto, CargoDto } from "./create-shipment.dto";
import { CargoContainersForModeConstraint } from "./cargo-containers-for-mode.constraint";

export class UpdateShipmentDto extends PartialType(CreateShipmentDto) {
  @ApiPropertyOptional({ description: "Cargo information", type: CargoDto })
  @IsOptional()
  @Validate(CargoContainersForModeConstraint)
  @ValidateNested()
  @Type(() => CargoDto)
  cargo?: CargoDto;
}