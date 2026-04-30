import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  HeaderFieldDto,
  TemplateItemDto,
  TemplateEquipmentItemDto,
  TemplatePricingConfigDto,
} from "./create-template.dto";

export class TemplateCompanyDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Company ID",
  })
  _id: string;

  @ApiProperty({
    example: "Company Name",
    description: "Company name",
  })
  name: string;
}

export class TemplateCreatorDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "User ID",
  })
  _id: string;

  @ApiProperty({
    example: "John",
    description: "First name",
  })
  firstName: string;

  @ApiProperty({
    example: "Doe",
    description: "Last name",
  })
  lastName: string;

  @ApiProperty({
    example: "john.doe@example.com",
    description: "Email",
  })
  email: string;
}

export class TemplateResponseDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Template ID",
  })
  _id: string;

  @ApiProperty({
    example: "LCL – EXW",
    description: "Template name",
  })
  name: string;

  @ApiProperty({
    enum: [
      "EXW",
      "FCA",
      "FAS",
      "FOB",
      "CFR",
      "CIF",
      "CPT",
      "CIP",
      "DAP",
      "DPU",
      "DDP",
    ],
    example: "EXW",
    description: "Incoterm category (ICC 2020). Most commonly used: EXW, CIF, FOB, DAP, CFR",
  })
  category: string;

  @ApiProperty({
    enum: [
      "FCL",
      "LCL",
      "AIR",
      "FTL",
      "INSURANCE",
      "CUSTOMS",
      "LOCAL_TRUCKING",
      "OTHER",
    ],
    example: "LCL",
    description: "Service type",
  })
  serviceType: string;

  @ApiProperty({
    type: [String],
    enum: ["maritime", "air", "road"],
    example: ["maritime"],
    description: "Modes of transportation",
  })
  shippingModes: string[];

  @ApiPropertyOptional({
    type: [HeaderFieldDto],
    description: "Dynamic header fields configuration",
  })
  headerFields?: HeaderFieldDto[];

  @ApiPropertyOptional({
    type: [TemplateItemDto],
    description: "Template items/charges",
  })
  items?: TemplateItemDto[];

  @ApiPropertyOptional({
    type: [TemplateEquipmentItemDto],
    description: "Equipment items",
  })
  equipmentItems?: TemplateEquipmentItemDto[];

  @ApiProperty({
    type: TemplatePricingConfigDto,
    description: "Price configuration",
  })
  pricingConfig: TemplatePricingConfigDto;

  @ApiPropertyOptional({
    example: "1000KGS: 1CBM",
    description: "General notes/conditions block (e.g., '1000KGS: 1CBM', 'Subject to ...', port charges, etc.). Client visibility is controlled by showNotesToClient.",
  })
  notes?: string;

  @ApiProperty({
    default: true,
    example: true,
    description: "Agent visible to the client in quotation/PDF",
  })
  showAgentToClient: boolean;

  @ApiProperty({
    default: true,
    example: true,
    description: "Carrier (shipping line) visible to the client in quotation/PDF",
  })
  showCarrierToClient: boolean;

  @ApiProperty({
    default: true,
    example: true,
    description: "Commodity visible to the client in quotation/PDF",
  })
  showCommodityToClient: boolean;

  @ApiProperty({
    default: true,
    example: true,
    description: "General notes visible to the client in quotation/PDF",
  })
  showNotesToClient: boolean;

  @ApiProperty({
    type: TemplateCompanyDto,
    description: "Company information",
  })
  companyId: TemplateCompanyDto;

  @ApiProperty({
    type: TemplateCreatorDto,
    description: "Creator information",
  })
  createdBy: TemplateCreatorDto;

  @ApiPropertyOptional({
    type: TemplateCreatorDto,
    description: "Last updater information",
  })
  updatedBy?: TemplateCreatorDto;

  @ApiProperty({
    default: true,
    example: true,
    description: "Whether the template is active",
  })
  isActive: boolean;

  @ApiProperty({
    type: "string",
    format: "date-time",
    description: "Creation timestamp",
  })
  createdAt: Date | string;

  @ApiProperty({
    type: "string",
    format: "date-time",
    description: "Last update timestamp",
  })
  updatedAt: Date | string;
}

export class CreateTemplateResponseDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439011",
    description: "Template ID",
  })
  id: string;

  @ApiProperty({
    example: "LCL – EXW",
    description: "Template name",
  })
  name: string;

  @ApiProperty({
    type: "string",
    format: "date-time",
    description: "Creation timestamp",
  })
  createdAt: Date | string;
}

