import { ApiPropertyOptional } from "@nestjs/swagger";

export interface TemplateFiltersDto {
  serviceType?: string;
  category?: string;
  shippingMode?: string;
  isActive?: boolean;
}

