import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, SchemaTypes } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

export type HistoryDocument = HydratedDocument<History>;

@Schema({
  collection: 'history',
  timestamps: { createdAt: 'timestamp', updatedAt: false },
})
export class History {
  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  entityType: string;

  @Prop({ required: true })
  entityId: string;

  @Prop()
  targetType?: string;

  @Prop()
  targetId?: string;

  @Prop({ required: true })
  actorUserId: string;

  @Prop({ required: true })
  actorName: string;

  @Prop()
  companyId?: string;

  @Prop()
  officeId?: string;

  @Prop({ required: true, enum: ['api', 'ui', 'system', 'script'] })
  origin: string;

  @Prop()
  sourceIp?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  correlationId?: string;

  @Prop({ required: true, enum: ['success', 'failure'] })
  status: string;

  @Prop()
  reason?: string;

  @Prop({ required: true })
  summary: string;

  @Prop({ type: SchemaTypes.Mixed })
  before?: Record<string, any>;

  @Prop({ type: SchemaTypes.Mixed })
  after?: Record<string, any>;

  @Prop({ type: SchemaTypes.Mixed })
  diff?: Record<string, { from: any; to: any }>;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ type: MongooseSchema.Types.Date, default: Date.now })
  timestamp?: Date;
}

export const HistorySchema = SchemaFactory.createForClass(History);

// Indexes for query optimization
HistorySchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
HistorySchema.index({ targetType: 1, targetId: 1, timestamp: -1 });
HistorySchema.index({ actorUserId: 1, timestamp: -1 });
HistorySchema.index({ companyId: 1, timestamp: -1 });
HistorySchema.index({ action: 1, timestamp: -1 });
HistorySchema.index({ status: 1, timestamp: -1 });
HistorySchema.index({ tags: 1, timestamp: -1 });
