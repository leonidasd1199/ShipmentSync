import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";

@Injectable()
export class MongoConnectionLogger implements OnModuleInit {
  private readonly logger = new Logger("Mongo");

  constructor(@InjectConnection() private readonly connection: Connection) {}

  onModuleInit() {
    this.connection.on("connected", () =>
      this.logger.log("MongoDB connected ✅"),
    );
    this.connection.on("error", (err) =>
      this.logger.error(`MongoDB error ❌ ${err}`),
    );
    this.connection.on("disconnected", () =>
      this.logger.warn("MongoDB disconnected ⚠️"),
    );
  }
}
