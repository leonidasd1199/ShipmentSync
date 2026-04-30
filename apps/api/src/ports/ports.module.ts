import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PortsController } from "./ports.controller";
import { PortsService } from "./ports.service";
import { Port, PortSchema } from "../schemas/port.schema";
import { HistoryModule } from "../history/history.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Port.name, schema: PortSchema }]),
    HistoryModule,
    AuthModule,
  ],
  controllers: [PortsController],
  providers: [PortsService],
  exports: [PortsService],
})
export class PortsModule {}

