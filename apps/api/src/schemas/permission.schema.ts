import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { Permission as PermissionEnum } from "src/common/enums/permission.enum";

export type PermissionDocument = HydratedDocument<PermissionModel>;

@Schema({ timestamps: true, collection: "permissions" })
export class PermissionModel {
  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    enum: Object.values(PermissionEnum),
  })
  code: PermissionEnum;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, trim: true })
  category: string; // e.g., 'user', 'company', 'shipment', 'system'

  @Prop({ default: true })
  isActive: boolean;
}

export const PermissionSchema = SchemaFactory.createForClass(PermissionModel);
