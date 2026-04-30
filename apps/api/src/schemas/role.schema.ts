import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { RoleCode } from "src/common/enums/role.enum";

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true, collection: "roles" })
export class Role {
  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    enum: Object.values(RoleCode),
  })
  code: RoleCode;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
