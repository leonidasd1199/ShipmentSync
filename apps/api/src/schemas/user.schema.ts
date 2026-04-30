import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { RoleCode } from "src/common/enums/role.enum";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, trim: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(RoleCode),
    default: RoleCode.CLIENT,
  })
  roleCode: RoleCode;

  @Prop({
    type: Types.ObjectId,
    ref: "Role",
    required: true,
  })
  role: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: "Company",
    required: true,
  })
  company: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: "Office" }],
    default: [],
  })
  offices: Types.ObjectId[];

  /** When set, this user (e.g. roleCode CLIENT) can only access this client record. */
  @Prop({ type: Types.ObjectId, ref: "Client", required: false })
  client?: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: "PermissionModel" }],
    default: [],
  })
  permissions: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  office_disabled?: boolean;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  lastPasswordResetAt?: Date;

  @Prop({ type: Boolean, default: false })
  mustChangePassword?: boolean;

  @Prop({ trim: true })
  avatar?: string;

  @Prop({ trim: true })
  locale?: string;

  @Prop({ trim: true })
  timezone?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Create indexes
UserSchema.index({ roleCode: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ company: 1 });
UserSchema.index({ offices: 1 });
UserSchema.index({ createdAt: -1 });
