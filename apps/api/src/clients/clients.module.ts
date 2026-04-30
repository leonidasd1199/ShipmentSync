import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";
import { Client, ClientSchema } from "../schemas/client.schema";
import { User, UserSchema } from "../schemas/user.schema";
import { Office, OfficeSchema } from "../schemas/office.schema";
import { Company, CompanySchema } from "../schemas/company.schema";
import { Role, RoleSchema } from "../schemas/role.schema";
import {
  PermissionModel,
  PermissionSchema,
} from "../schemas/permission.schema";
import {
  QuotationDelivery,
  QuotationDeliverySchema,
} from "../schemas/quotation-delivery.schema";
import { Shipment, ShipmentSchema } from "../schemas/shipment.schema";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { HistoryModule } from "../history/history.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: User.name, schema: UserSchema },
      { name: Office.name, schema: OfficeSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Role.name, schema: RoleSchema },
      { name: PermissionModel.name, schema: PermissionSchema },
      { name: QuotationDelivery.name, schema: QuotationDeliverySchema },
      { name: Shipment.name, schema: ShipmentSchema },
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => CommonModule),
    forwardRef(() => HistoryModule),
    MailModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
