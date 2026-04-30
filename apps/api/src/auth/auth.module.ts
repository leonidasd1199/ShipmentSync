import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PermissionGuard } from "./permission.middleware";
import { JwtStrategy } from "./jwt.strategy";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { OfficeAccessGuard } from "./office-access.guard";
import { CompanyAccessGuard } from "./company-access.guard";
import { User, UserSchema } from "../schemas/user.schema";
import { Company, CompanySchema } from "../schemas/company.schema";
import { Office, OfficeSchema } from "../schemas/office.schema";
import {
  PermissionModel,
  PermissionSchema,
} from "../schemas/permission.schema";
import { Role, RoleSchema } from "../schemas/role.schema";
import { Agent, AgentSchema } from "../schemas/agent.schema";
import { AgentsModule } from "../agents/agents.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Office.name, schema: OfficeSchema },
      { name: PermissionModel.name, schema: PermissionSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
    PassportModule,
    forwardRef(() => AgentsModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
      signOptions: { expiresIn: "24h" },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PermissionGuard,
    JwtStrategy,
    JwtAuthGuard,
    OfficeAccessGuard,
    CompanyAccessGuard,
  ],
  exports: [
    AuthService,
    PermissionGuard,
    JwtAuthGuard,
    OfficeAccessGuard,
    CompanyAccessGuard,
  ],
})
export class AuthModule {}
