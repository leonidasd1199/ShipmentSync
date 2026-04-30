import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class HeaderFieldDto {
  @ApiProperty({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "UUID identifier for the field",
  })
  id: string;

  @ApiProperty({
    example: "Port of Origin",
    description: "Display label for the field (e.g., 'Port of Origin', 'Expiration Date', 'Potato')",
  })
  label: string;

  @ApiProperty({
    enum: ["text", "textarea", "number", "date", "select"],
    example: "text",
    description: "Input type for the field",
  })
  inputType: "text" | "textarea" | "number" | "date" | "select";

  @ApiPropertyOptional({
    type: [String],
    example: ["Option 1", "Option 2"],
    description: "Options for select type fields (only if inputType === 'select')",
  })
  options?: string[];

  @ApiPropertyOptional({
    description: "Default value for the field (can be string, number, date, etc.)",
  })
  defaultValue?: any;

  @ApiPropertyOptional({
    default: false,
    example: true,
    description: "Whether the field is required",
  })
  required?: boolean;

  @ApiPropertyOptional({
    example: 1,
    description: "Order for display",
  })
  order?: number;
}

export class TemplateItemDto {
  @ApiProperty({
    example: "1",
    description: "Item identifier (e.g., '1', UUID, etc.)",
  })
  id: string;

  @ApiProperty({
    example: "Pick up",
    description: "Item label (e.g., 'Pick up', 'Ocean Freight CBM', 'DTHC', 'Cargo', 'Potato', etc.)",
  })
  label: string;

  @ApiProperty({
    example: true,
    description: "Whether this item has a price field",
  })
  hasPrice: boolean;

  @ApiProperty({
    example: true,
    description: "Whether this item has a quantity field",
  })
  hasQuantity: boolean;

  @ApiProperty({
    example: true,
    description: "Whether this item has a discount field",
  })
  hasDiscount: boolean;

  @ApiPropertyOptional({
    example: null,
    description: "Default price value (null if not set)",
  })
  defaultPrice?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description: "Default quantity value (null if not set)",
  })
  defaultQuantity?: number | null;

  @ApiPropertyOptional({
    example: 0,
    description: "Default discount value (null if not set)",
  })
  defaultDiscount?: number | null;

  @ApiPropertyOptional({
    example: "This pickup is because of this",
    description: "Item-specific note",
  })
  notes?: string;

  @ApiPropertyOptional({
    example: 1,
    description: "Display order",
  })
  order?: number;

  @ApiPropertyOptional({
    example: true,
    description: "Should this item consider the template's general discount?",
  })
  applyTemplateDiscount?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: "Does this item generate taxes?",
  })
  applyTaxes?: boolean;

  @ApiPropertyOptional({
    example: 15,
    description: "Specific tax rate for this item (e.g., 15%, null if not set)",
  })
  taxRate?: number | null;
}

export class TemplateEquipmentFieldDto {
  @ApiProperty({
    example: "size",
    description: "Field key identifier (e.g., 'size', 'length', 'width', 'height', 'unit', 'weightKg', etc.)",
  })
  key: string;

  @ApiProperty({
    example: "Size",
    description: "Display label for the field (e.g., 'Size', 'Length', 'Width', 'Height', 'Unit', 'Weight (kg)', etc.)",
  })
  label: string;

  @ApiProperty({
    enum: ["text", "number"],
    example: "text",
    description: "Input type for the field",
  })
  inputType: "text" | "number";

  @ApiPropertyOptional({
    example: "20DV",
    description: "Default value for the field (can be string, number, or null)",
  })
  defaultValue?: string | number | null;

  @ApiPropertyOptional({
    example: 1,
    description: "Display order for the field",
  })
  order?: number;
}

export class TemplateEquipmentItemDto {
  @ApiProperty({
    example: "1",
    description: "Equipment identifier (e.g., '1', UUID, etc.)",
  })
  id: string;

  @ApiProperty({
    example: "20DV",
    description: "Equipment label (e.g., '20DV', '40HC', 'Equipment', etc.)",
  })
  label: string;

  @ApiProperty({
    type: [TemplateEquipmentFieldDto],
    example: [
      {
        key: "size",
        label: "Size",
        inputType: "text",
        defaultValue: "20DV",
        order: 1,
      },
      {
        key: "length",
        label: "Length",
        inputType: "number",
        defaultValue: 6.06,
        order: 2,
      },
      {
        key: "width",
        label: "Width",
        inputType: "number",
        defaultValue: 2.44,
        order: 3,
      },
      {
        key: "height",
        label: "Height",
        inputType: "number",
        defaultValue: 2.59,
        order: 4,
      },
      {
        key: "unit",
        label: "Unit",
        inputType: "text",
        defaultValue: "m",
        order: 5,
      },
      {
        key: "weightKg",
        label: "Weight (kg)",
        inputType: "number",
        defaultValue: 28000,
        order: 6,
      },
    ],
    description: "Required: Configurable subfields for equipment (size, length, width, height, unit, weightKg, etc.)",
  })
  fields: TemplateEquipmentFieldDto[];

  @ApiProperty({
    example: true,
    description: "Whether this equipment item has a price field",
  })
  hasPrice: boolean;

  @ApiProperty({
    example: true,
    description: "Whether this equipment item has a quantity field",
  })
  hasQuantity: boolean;

  @ApiProperty({
    example: true,
    description: "Whether this equipment item has a discount field",
  })
  hasDiscount: boolean;

  @ApiPropertyOptional({
    example: null,
    description: "Default price value (null if not set)",
  })
  defaultPrice?: number | null;

  @ApiPropertyOptional({
    example: null,
    description: "Default quantity value (null if not set)",
  })
  defaultQuantity?: number | null;

  @ApiPropertyOptional({
    example: null,
    description: "Default discount value (null if not set)",
  })
  defaultDiscount?: number | null;

  @ApiPropertyOptional({
    example: true,
    description: "Should this equipment item consider the template's general discount?",
  })
  applyTemplateDiscount?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: "Does this equipment item generate taxes?",
  })
  applyTaxes?: boolean;

  @ApiPropertyOptional({
    example: 15,
    description: "Specific tax rate for this equipment item (e.g., 15%, null if not set)",
  })
  taxRate?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description: "Display order",
  })
  order?: number;
}

export class TemplatePricingConfigDto {
  @ApiProperty({
    example: "USD",
    description: "Currency code",
  })
  currency: string;

  @ApiPropertyOptional({
    example: 1500,
    description: "Base template price (if applicable)",
  })
  templatePrice?: number | null;

  @ApiPropertyOptional({
    example: 10,
    description: "General template discount percentage (0-100)",
  })
  templateDiscount?: number | null;

  @ApiPropertyOptional({
    example: true,
    description: "Whether the general template discount should be applied",
  })
  applyTemplateDiscount?: boolean;

  @ApiPropertyOptional({
    example: 15,
    description: "General template tax rate percentage (0-100)",
  })
  templateTaxRate?: number | null;

  @ApiPropertyOptional({
    example: true,
    description: "Whether the general template taxes should be applied",
  })
  applyTemplateTaxes?: boolean;
}


export class CreateTemplateDto {
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
    description: "Modes of transportation (e.g., ['maritime'], ['air'], ['maritime', 'air'], etc.)",
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
    description: "Equipment items (containers/equipment)",
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

  @ApiPropertyOptional({
    default: true,
    example: true,
    description: "Whether the template is active",
  })
  isActive?: boolean;
}

