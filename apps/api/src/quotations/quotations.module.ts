import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { QuotationsController } from "./quotations.controller";
import { QuotationsService } from "./quotations.service";
import { Counter, CounterSchema } from "../schemas/counter.schema";
import { Quotation, QuotationSchema } from "../schemas/quotation.schema";
import { Client, ClientSchema } from "../schemas/client.schema";
import { Company, CompanySchema } from "../schemas/company.schema";
import { Shipping, ShippingSchema } from "../schemas/shipping.schema";
import { Agent, AgentSchema } from "../schemas/agent.schema";
import { User, UserSchema } from "../schemas/user.schema";
import { Office, OfficeSchema } from "../schemas/office.schema";
import { Template, TemplateSchema } from "../schemas/template.schema";
import { Port, PortSchema } from "../schemas/port.schema";
import {
  QuotationDelivery,
  QuotationDeliverySchema,
} from "../schemas/quotation-delivery.schema";
import {
  AgentPricelist,
  AgentPricelistSchema,
} from "../schemas/agent-pricelist.schema";
import { AuthModule } from "../auth/auth.module";
import { HistoryModule } from "../history/history.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Quotation.name, schema: QuotationSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Shipping.name, schema: ShippingSchema },
      { name: Agent.name, schema: AgentSchema },
      { name: User.name, schema: UserSchema },
      { name: Office.name, schema: OfficeSchema },
      { name: Template.name, schema: TemplateSchema },
      { name: Port.name, schema: PortSchema },
      {
        name: QuotationDelivery.name,
        schema: QuotationDeliverySchema,
      },
      { name: AgentPricelist.name, schema: AgentPricelistSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
    AuthModule,
    HistoryModule,
    MailModule,
  ],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
