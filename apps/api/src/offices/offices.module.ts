import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OfficesController } from "./offices.controller";
import { OfficesService } from "./offices.service";
import { Office, OfficeSchema } from "../schemas/office.schema";
import { Company, CompanySchema } from "../schemas/company.schema";
import { User, UserSchema } from "../schemas/user.schema";
import { AuthModule } from "../auth/auth.module";
import { MailModule } from "../mail/mail.module";
import { HistoryModule } from "../history/history.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Office.name, schema: OfficeSchema },
      { name: Company.name, schema: CompanySchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => MailModule),
    forwardRef(() => HistoryModule),
  ],
  controllers: [OfficesController],
  providers: [OfficesService],
  exports: [OfficesService],
})
export class OfficesModule {}
