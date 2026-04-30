import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AgentPricingService } from "./agent-pricing.service";
import { OperatorPricingService } from "./operator-pricing.service";
import { AgentPricingController } from "./agent-pricing.controller";
import { OperatorPricingController } from "./operator-pricing.controller";
import { AgentPricelist, AgentPricelistSchema } from "../schemas/agent-pricelist.schema";
import { Agent, AgentSchema } from "../schemas/agent.schema";
import { Shipping, ShippingSchema } from "../schemas/shipping.schema";
import { PricelistDistribution, PricelistDistributionSchema } from "../schemas/pricelist-distribution.schema";
import { Client, ClientSchema } from "../schemas/client.schema";
import { HistoryModule } from "../history/history.module";
import { AuthModule } from "../auth/auth.module";
import { MailModule } from "../mail/mail.module";
import { PortsModule } from "../ports/ports.module";
import { QuotationsModule } from "../quotations/quotations.module";

@Module({
  imports: [
    QuotationsModule,
    MongooseModule.forFeature([
      { name: AgentPricelist.name, schema: AgentPricelistSchema },
      { name: Agent.name, schema: AgentSchema },
      { name: Shipping.name, schema: ShippingSchema },
      { name: PricelistDistribution.name, schema: PricelistDistributionSchema },
      { name: Client.name, schema: ClientSchema },
    ]),
    forwardRef(() => HistoryModule),
    forwardRef(() => AuthModule),
    MailModule,
    PortsModule,
  ],
  controllers: [AgentPricingController, OperatorPricingController],
  providers: [AgentPricingService, OperatorPricingService],
  exports: [AgentPricingService, OperatorPricingService],
})
export class PricingModule {}
