import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  ValidateNested,
  IsArray,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsIn,
  Min,
  Validate,
} from "class-validator";
import { CargoContainersForModeConstraint } from "./cargo-containers-for-mode.constraint";
import { Type } from "class-transformer";
import { ShipmentMode, ShipmentStatus } from "../../schemas/shipment.schema";

export class PartyDto {
  @ApiPropertyOptional({
    description: "Client ID reference",
    example: "507f1f77bcf86cd799439004",
  })
  @IsOptional()
  @IsMongoId()
  clientId?: string;

  @ApiProperty({
    description: "Party name",
    example: "ABC Manufacturing Inc.",
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: "Party address",
    example: "123 Industrial Blvd, Miami, FL 33101, USA",
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: "Contact information",
    example: "John Smith, +1 (305) 555-0123",
  })
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiPropertyOptional({
    description: "Tax ID / RTN",
    example: "12-3456789-001",
  })
  @IsOptional()
  @IsString()
  rtn?: string;
}

export class PartiesDto {
  @ApiProperty({ type: () => PartyDto })
  @ValidateNested()
  @Type(() => PartyDto)
  shipper: PartyDto;

  @ApiProperty({ type: () => PartyDto })
  @ValidateNested()
  @Type(() => PartyDto)
  consignee: PartyDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notifyPartyText?: string;
}

export class TransportAirDto {
  @ApiPropertyOptional({ example: "4046-7770" })
  @IsOptional()
  @IsString()
  hawbNumber?: string;

  @ApiPropertyOptional({ example: "MIA" })
  @IsOptional()
  @IsString()
  airportOfDeparture?: string;

  @ApiPropertyOptional({ example: "SAP" })
  @IsOptional()
  @IsString()
  airportOfDestination?: string;
}

export class TransportDto {
  @ApiPropertyOptional({
    description: "Vessel name",
    example: "MSC OSCAR",
  })
  @IsOptional()
  @IsString()
  vesselName?: string;

  @ApiPropertyOptional({
    description: "Voyage number",
    example: "V123W",
  })
  @IsOptional()
  @IsString()
  voyageNumber?: string;

  @ApiPropertyOptional({
    description: "Port of loading ID",
    example: "507f1f77bcf86cd799439007",
  })
  @IsOptional()
  @IsMongoId()
  portOfLoadingId?: string;

  @ApiPropertyOptional({
    description: "Port of discharge ID",
    example: "507f1f77bcf86cd799439008",
  })
  @IsOptional()
  @IsMongoId()
  portOfDischargeId?: string;

  @ApiPropertyOptional({
    description: "Place of receipt",
    example: "Miami, FL - Warehouse",
  })
  @IsOptional()
  @IsString()
  placeOfReceipt?: string;

  @ApiPropertyOptional({
    description: "Place of delivery",
    example: "San Pedro Sula, Honduras - Warehouse",
  })
  @IsOptional()
  @IsString()
  placeOfDelivery?: string;

  @ApiPropertyOptional({
    description: "Air transport (AIR mode)",
    type: Object,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransportAirDto)
  air?: TransportAirDto;
}

export class ShipmentDatesDto {
  @ApiPropertyOptional({
    description: "Estimated Time of Departure",
    example: "2026-03-15T10:00:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  etd?: string;

  @ApiPropertyOptional({
    description: "Estimated Time of Arrival",
    example: "2026-03-25T14:00:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  eta?: string;

  @ApiPropertyOptional({
    description: "Actual Time of Departure",
  })
  @IsOptional()
  @IsDateString()
  atd?: string;

  @ApiPropertyOptional({
    description: "Actual Time of Arrival",
  })
  @IsOptional()
  @IsDateString()
  ata?: string;
}

export class PackageDimensionsDto {
  @ApiProperty({ description: "Package length", example: 120 })
  @IsNumber()
  @Min(0)
  length: number;

  @ApiProperty({ description: "Package width", example: 80 })
  @IsNumber()
  @Min(0)
  width: number;

  @ApiProperty({ description: "Package height", example: 100 })
  @IsNumber()
  @Min(0)
  height: number;

  @ApiPropertyOptional({
    description: "Dimension unit",
    example: "cm",
    enum: ["cm", "in", "m"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["cm", "in", "m"])
  unit?: string;
}

export class ContainerPackageDto {
  @ApiPropertyOptional({
    description: "Package type",
    example: "PALLET",
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: "Package quantity",
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty({
    description: "Package dimensions",
    type: PackageDimensionsDto,
  })
  @ValidateNested()
  @Type(() => PackageDimensionsDto)
  dimensions: PackageDimensionsDto;
}

export class ContainerDto {
  @ApiPropertyOptional({
    description:
      "Container number (required for each listed container when mode is OCEAN or MULTIMODAL)",
    example: "MSKU1234567",
  })
  @IsOptional()
  @IsString()
  containerNumber?: string;

  @ApiPropertyOptional({
    description: "Seal number",
    example: "SL-001234",
  })
  @IsOptional()
  @IsString()
  sealNumber?: string;

  @ApiPropertyOptional({
    description: "Container type",
    example: "40HC",
  })
  @IsOptional()
  @IsString()
  containerType?: string;

  @ApiPropertyOptional({
    description: "Packages inside this container with individual dimensions",
    type: [ContainerPackageDto],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContainerPackageDto)
  packages?: ContainerPackageDto[];
}

export class CargoDto {
  @ApiProperty({
    description: "Containers",
    type: [ContainerDto],
    default: [],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContainerDto)
  containers: ContainerDto[];

  @ApiPropertyOptional({
    description: "Packages quantity",
    example: 120,
  })
  @IsOptional()
  @IsNumber()
  packagesQuantity?: number;

  @ApiPropertyOptional({
    description: "Packages type",
    example: "PALLETS",
  })
  @IsOptional()
  @IsString()
  packagesType?: string;

  @ApiPropertyOptional({
    description:
      "Cargo-level packages (e.g. air freight) with per-line type, quantity, and dimensions",
    type: [ContainerPackageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContainerPackageDto)
  packages?: ContainerPackageDto[];

  @ApiPropertyOptional({
    description: "Goods description",
    example: "Electronics - Consumer Goods",
  })
  @IsOptional()
  @IsString()
  goodsDescription?: string;

  @ApiPropertyOptional({
    description: "Gross weight in kg",
    example: 24500,
  })
  @IsOptional()
  @IsNumber()
  grossWeightKg?: number;

  @ApiPropertyOptional({
    description: "Volume in cubic meters",
    example: 67.5,
  })
  @IsOptional()
  @IsNumber()
  volumeCbm?: number;

  @ApiPropertyOptional({
    description: "Free-text dimensions for air cargo (e.g. 120×80×100 cm)",
  })
  @IsOptional()
  @IsString()
  airDimensionsText?: string;
}

export class CreateShipmentDto {
  @ApiProperty({
    description: "Company ID",
    example: "507f1f77bcf86cd799439001",
  })
  @IsNotEmpty()
  @IsMongoId()
  companyId: string;

  @ApiProperty({
    description: "Office ID",
    example: "507f1f77bcf86cd799439002",
  })
  @IsNotEmpty()
  @IsMongoId()
  officeId: string;

  @ApiPropertyOptional({
    description: "Quotation ID (presiario)",
    example: "507f1f77bcf86cd799439003",
  })
  @IsOptional()
  @IsMongoId()
  quotationId?: string;

  @ApiProperty({
    description: "Shipment mode",
    enum: ShipmentMode,
    example: ShipmentMode.OCEAN,
  })
  @IsNotEmpty()
  @IsEnum(ShipmentMode)
  mode: ShipmentMode;

  @ApiProperty({
    description: "Incoterm",
    example: "FOB",
  })
  @IsNotEmpty()
  @IsString()
  incoterm: string;

  @ApiPropertyOptional({
    description: "Movement type",
    example: "FCL/FCL",
  })
  @IsOptional()
  @IsString()
  movementType?: string;

  @ApiProperty({ description: "Parties information", type: () => PartiesDto })
  @ValidateNested()
  @Type(() => PartiesDto)
  parties: PartiesDto;

  @ApiPropertyOptional({
    description: "Booking number",
    example: "BK-2026-001234",
  })
  @IsOptional()
  @IsString()
  bookingNumber?: string;

  @ApiPropertyOptional({
    description: "Master Bill of Lading number",
    example: "MAEU123456789",
  })
  @IsOptional()
  @IsString()
  mblNumber?: string;

  @ApiPropertyOptional({
    description: "House Bill of Lading number",
    example: "HBL-2026-001234",
  })
  @IsOptional()
  @IsString()
  hblNumber?: string;

  @ApiPropertyOptional({
    description: "Shipping line ID",
    example: "507f1f77bcf86cd799439006",
  })
  @IsOptional()
  @IsMongoId()
  shippingLineId?: string;

  @ApiPropertyOptional({
    description: "Transport information",
    type: TransportDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransportDto)
  transport?: TransportDto;

  @ApiPropertyOptional({
    description: "Dates information",
    type: ShipmentDatesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShipmentDatesDto)
  dates?: ShipmentDatesDto;

  @ApiProperty({
    description: "Cargo information",
    type: CargoDto,
  })
  @Validate(CargoContainersForModeConstraint)
  @ValidateNested()
  @Type(() => CargoDto)
  cargo: CargoDto;

  @ApiProperty({
    description: "Operational user ID",
    example: "507f1f77bcf86cd799439009",
  })
  @IsNotEmpty()
  @IsMongoId()
  operationalUserId: string;

  @ApiPropertyOptional({
    description: "Quotation snapshot (reference data from quotation)",
    type: Object,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  quotationSnapshot?: {
    quotationId: string;
    serviceType?: string;
    incoterm?: string;
    shippingMode?: "maritime" | "air" | "road";
    clientId?: string;
    agentId?: string;
    shippingLineId?: string;
    portOfOrigin?: string;
    portOfDestination?: string;
    currency?: string;
    templateId?: string;
    items?: Array<{
      itemId: string;
      description?: string;
      price?: number | null;
      quantity?: number | null;
      discount?: number | null;
      applyTaxes?: boolean;
      taxRate?: number | null;
      notes?: string;
      type?: string;
    }>;
    equipmentItems?: Array<{
      equipmentItemId: string;
      label?: string;
      quantity?: number | null;
      price?: number | null;
      discount?: number | null;
      applyTaxes?: boolean;
      taxRate?: number | null;
      notes?: string;
      type?: string;
    }>;
    total?: number;
    validUntil?: string;
    snapshotTakenAt?: string;
    snapshotTakenBy?: string;
  };
}