import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class QuotationItemResponseDto {
  @ApiProperty({ enum: ["cargo", "custom"] })
  type: "cargo" | "custom";

  @ApiProperty()
  description: string;

  @ApiProperty()
  price: number;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional({ enum: ["air", "land", "maritime"] })
  transitType?: "air" | "land" | "maritime";
}

export class QuotationResponseDto {
  @ApiProperty({
    example: "507f1f77bcf86cd799439015",
    description: "MongoDB ObjectId",
  })
  id: string;

  @ApiProperty({ example: "507f1f77bcf86cd799439011" })
  clientId: string;

  @ApiProperty({ example: "507f1f77bcf86cd799439012" })
  companyId: string;

  @ApiProperty({ example: "507f1f77bcf86cd799439013" })
  shippingLineId: string;

  @ApiPropertyOptional({ example: "507f1f77bcf86cd799439014" })
  agentId?: string;

  @ApiProperty({ type: [QuotationItemResponseDto] })
  items: QuotationItemResponseDto[];

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ type: "string", format: "date-time" })
  validUntil: Date | string;

  @ApiProperty()
  summarize: boolean;

  @ApiPropertyOptional({
    description: "Total sum of all item prices (if summarize is true)",
  })
  total?: number;

  @ApiProperty({ enum: ["draft", "sent", "accepted", "rejected", "expired"] })
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";

  @ApiProperty({ type: "string", format: "date-time" })
  createdAt: Date | string;
}

export class QuotationListClientDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  phone?: string;
}

export class QuotationListCompanyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class QuotationListShippingLineDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class QuotationListAgentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;
}

export class QuotationListCreatorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;
}

export class QuotationListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  clientId: string;

  @ApiPropertyOptional({ type: QuotationListClientDto })
  client?: QuotationListClientDto;

  @ApiProperty()
  companyId: string;

  @ApiPropertyOptional({ type: QuotationListCompanyDto })
  company?: QuotationListCompanyDto;

  @ApiProperty()
  shippingLineId: string;

  @ApiPropertyOptional({ type: QuotationListShippingLineDto })
  shippingLine?: QuotationListShippingLineDto;

  @ApiPropertyOptional()
  agentId?: string;

  @ApiPropertyOptional({ type: QuotationListAgentDto })
  agent?: QuotationListAgentDto;

  @ApiProperty()
  createdBy: string;

  @ApiPropertyOptional({ type: QuotationListCreatorDto })
  creator?: QuotationListCreatorDto;

  @ApiProperty({ type: [QuotationItemResponseDto] })
  items: QuotationItemResponseDto[];

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ type: "string", format: "date-time" })
  validUntil: Date | string;

  @ApiProperty()
  summarize: boolean;

  @ApiPropertyOptional()
  total?: number;

  @ApiProperty({ type: "string", format: "date-time" })
  createdAt: Date | string;

  @ApiPropertyOptional({ type: "string", format: "date-time" })
  updatedAt?: Date | string;
}

export class QuotationListResponseDto {
  @ApiProperty({ type: [QuotationListItemResponseDto] })
  items: QuotationListItemResponseDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;
}

