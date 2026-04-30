import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { MongooseModule } from "@nestjs/mongoose";
import { PricelistNotificationCronService } from "./pricelist-notification.cron.service";
import { CronController } from "./cron.controller";
import { AgentPricelist, AgentPricelistSchema } from "../schemas/agent-pricelist.schema";
import { User, UserSchema } from "../schemas/user.schema";
import { MailModule } from "../mail/mail.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: AgentPricelist.name, schema: AgentPricelistSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MailModule,
    AuthModule,
  ],
  controllers: [CronController],
  providers: [PricelistNotificationCronService],
})
export class CronModule {}
