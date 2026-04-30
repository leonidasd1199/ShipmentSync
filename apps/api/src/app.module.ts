import { join } from "path";
import { Module, Logger } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { MongoConnectionLogger } from "./mongo/mongo-connection.logger";
import { AuthModule } from "./auth/auth.module";
import { OfficesModule } from "./offices/offices.module";
import { CompaniesModule } from "./companies/companies.module";
import { ClientsModule } from "./clients/clients.module";
import { UsersModule } from "./users/users.module";
import { MailModule } from "./mail/mail.module";
import { HistoryModule } from "./history/history.module";
import { ShippingsModule } from "./shippings/shippings.module";
import { AgentsModule } from "./agents/agents.module";
import { QuotationsModule } from "./quotations/quotations.module";
import { TemplatesModule } from "./templates/templates.module";
import { PortsModule } from "./ports/ports.module";
import { MetadataModule } from "./metadata/metadata.module";
import { ShipmentsModule } from "./shipments/shipments.module";
import { PricingModule } from "./pricing/pricing.module";
import { CronModule } from "./cron/cron.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";

const logger = new Logger("Mongo");

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load repo root .env first, then cwd .env (works from apps/api or monorepo root)
      envFilePath: [
        join(process.cwd(), "..", ".env"),
        join(process.cwd(), ".env"),
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.get<string>("MONGODB_URI") ?? "mongodb://mongo:27017/shipsync",
      }),
    }),
    AuthModule,
    OfficesModule,
    CompaniesModule,
    ClientsModule,
    UsersModule,
    MailModule,
    HistoryModule,
    ShippingsModule,
    AgentsModule,
    QuotationsModule,
    TemplatesModule,
    PortsModule,
    MetadataModule,
    ShipmentsModule,
    PricingModule,
    CronModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    MongoConnectionLogger,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
