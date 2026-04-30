import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../schemas/user.schema";
import { Office, OfficeSchema } from "../schemas/office.schema";
import { Company, CompanySchema } from "../schemas/company.schema";
import { AccessVerificationService } from "./services/access-verification.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Office.name, schema: OfficeSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  providers: [AccessVerificationService],
  exports: [AccessVerificationService],
})
export class CommonModule {}
