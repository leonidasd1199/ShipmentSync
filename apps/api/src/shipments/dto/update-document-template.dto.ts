import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional } from "class-validator";

export class UpdateDocumentTemplateDto {
  @ApiPropertyOptional({
    description: "HTML template (Handlebars)",
  })
  @IsOptional()
  @IsString()
  html?: string;

  @ApiPropertyOptional({
    description: "CSS styles",
  })
  @IsOptional()
  @IsString()
  css?: string;
}
