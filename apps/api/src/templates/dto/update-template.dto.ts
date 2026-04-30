import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  HeaderFieldDto,
  TemplateItemDto,
  TemplateEquipmentItemDto,
  TemplatePricingConfigDto,
} from "./create-template.dto";

export class UpdateTemplateDto {
  @ApiPropertyOptional({
    example: "LCL – EXW",
    description: "Template name",
  })
  name?: string;

  @ApiPropertyOptional({
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
  category?: string;

  @ApiPropertyOptional({
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
  serviceType?: string;

  @ApiPropertyOptional({
    type: [String],
    enum: ["maritime", "air", "road"],
    example: ["maritime"],
    description: "Modes of transportation (e.g., ['maritime'], ['air'], ['maritime', 'air'], etc.)",
  })
  shippingModes?: string[];

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
    description: "Equipment items (containers/equipment)",
  })
  equipmentItems?: TemplateEquipmentItemDto[];

  @ApiPropertyOptional({
    type: TemplatePricingConfigDto,
    description: "Price configuration",
  })
  pricingConfig?: TemplatePricingConfigDto;

  @ApiPropertyOptional({
    example: "1000KGS: 1CBM",
    description: "General notes/conditions block (e.g., '1000KGS: 1CBM', 'Subject to ...', port charges, etc.). Client visibility is controlled by showNotesToClient.",
  })
  notes?: string;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description: "Agent visible to the client in quotation/PDF",
  })
  showAgentToClient?: boolean;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description: "Carrier (shipping line) visible to the client in quotation/PDF",
  })
  showCarrierToClient?: boolean;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description: "Commodity visible to the client in quotation/PDF",
  })
  showCommodityToClient?: boolean;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description: "General notes visible to the client in quotation/PDF",
  })
  showNotesToClient?: boolean;

  @ApiPropertyOptional({
    default: true,
    example: true,
    description: "Whether the template is active",
  })
  isActive?: boolean;
}

