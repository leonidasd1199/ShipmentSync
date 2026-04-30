import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import { MagicLinkService } from "./magic-link.service";
import { Agent, AgentSchema } from "../schemas/agent.schema";
import { Shipping, ShippingSchema } from "../schemas/shipping.schema";
import {
  MagicLinkToken,
  MagicLinkTokenSchema,
} from "../schemas/magic-link-token.schema";
import { AuthModule } from "../auth/auth.module";
import { HistoryModule } from "../history/history.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Agent.name, schema: AgentSchema },
      { name: Shipping.name, schema: ShippingSchema },
      { name: MagicLinkToken.name, schema: MagicLinkTokenSchema },
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => HistoryModule),
    MailModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService, MagicLinkService],
  exports: [AgentsService, MagicLinkService],
})
export class AgentsModule {}

