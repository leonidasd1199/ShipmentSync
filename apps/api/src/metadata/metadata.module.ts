import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MetadataService } from "./metadata.service";
import { MetadataController } from "./metadata.controller";

@Module({
  imports: [MongooseModule.forFeature([])],
  controllers: [MetadataController],
  providers: [MetadataService],
})
export class MetadataModule {}
