import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { User, UserSchema } from "../schemas/user.schema";
import { Company, CompanySchema } from "../schemas/company.schema";
import {
  PermissionModel,
  PermissionSchema,
} from "../schemas/permission.schema";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { HistoryModule } from "../history/history.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Company.name, schema: CompanySchema },
      { name: PermissionModel.name, schema: PermissionSchema },
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => CommonModule),
    forwardRef(() => HistoryModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
