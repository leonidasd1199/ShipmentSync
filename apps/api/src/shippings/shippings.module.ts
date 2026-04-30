import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ShippingsController } from "./shippings.controller";
import { ShippingsService } from "./shippings.service";
import { Shipping, ShippingSchema } from "../schemas/shipping.schema";
import { Agent, AgentSchema } from "../schemas/agent.schema";
import { AuthModule } from "../auth/auth.module";
import { HistoryModule } from "../history/history.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shipping.name, schema: ShippingSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => HistoryModule),
  ],
  controllers: [ShippingsController],
  providers: [ShippingsService],
  exports: [ShippingsService],
})
export class ShippingsModule {}
