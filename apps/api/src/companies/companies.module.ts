import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CompaniesController } from "./companies.controller";
import { OfficesModule } from "../offices/offices.module";
import { AuthModule } from "../auth/auth.module";
import { HistoryModule } from "../history/history.module";
import { User, UserSchema } from "../schemas/user.schema";
import { Company, CompanySchema } from "../schemas/company.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
    forwardRef(() => OfficesModule),
    forwardRef(() => AuthModule),
    forwardRef(() => HistoryModule),
  ],
  controllers: [CompaniesController],
})
export class CompaniesModule {}
