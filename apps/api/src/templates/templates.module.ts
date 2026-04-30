import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { TemplatesController } from "./templates.controller";
import { TemplatesService } from "./templates.service";
import { Template, TemplateSchema } from "../schemas/template.schema";
import { Company, CompanySchema } from "../schemas/company.schema";
import { User, UserSchema } from "../schemas/user.schema";
import { HistoryModule } from "../history/history.module";
import { CommonModule } from "../common/common.module";
import { AuthModule } from "../auth/auth.module";
import { TemplateAccessGuard } from "../auth/template-access.guard";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Template.name, schema: TemplateSchema },
      { name: Company.name, schema: CompanySchema },
      { name: User.name, schema: UserSchema },
    ]),
    HistoryModule,
    CommonModule,
    AuthModule,
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplateAccessGuard],
  exports: [TemplatesService],
})
export class TemplatesModule {}

