import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { FilterQuery, Model } from "mongoose";
import { History, HistoryDocument } from "../schemas/history.schema";

export class CreateHistoryDto {
  action: string;
  entityType: string;
  entityId: string;
  targetType?: string;
  targetId?: string;
  actorUserId: string;
  actorName: string;
  actorEmail?: string;
  companyId?: string;
  officeId?: string;
  origin: string;
  sourceIp?: string;
  userAgent?: string;
  correlationId?: string;
  status: string;
  reason?: string;
  summary: string;
  before?: any;
  after?: any;
  diff?: Record<string, { from: any; to: any }>;
  tags?: string[];
}

@Injectable()
export class HistoryService {
  constructor(
    @InjectModel(History.name)
    private readonly historyModel: Model<HistoryDocument>,
  ) {}

  async log(dto: CreateHistoryDto) {
    const doc = new this.historyModel({
      ...dto,
      timestamp: new Date(),
    });
    await doc.save();
    return doc;
  }

  async findAll(params: {
    entityType?: string;
    entityId?: string;
    targetType?: string;
    targetId?: string;
    actorUserId?: string;
    action?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
    or?: FilterQuery<HistoryDocument>[]; // supports multi-condition OR filters
  }) {
    const {
      entityType,
      entityId,
      targetType,
      targetId,
      actorUserId,
      action,
      status,
      from,
      to,
      page = 1,
      pageSize = 50,
      or,
    } = params;

    const query: FilterQuery<HistoryDocument> = {};
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (targetType) query.targetType = targetType;
    if (targetId) query.targetId = targetId;
    if (actorUserId) query.actorUserId = actorUserId;
    if (action) query.action = action;
    if (status) query.status = status;

    if (from || to) {
      query.timestamp = {};
      if (from) (query.timestamp as any).$gte = new Date(from);
      if (to) (query.timestamp as any).$lte = new Date(to);
    }

    // merge OR conditions when provided
    const finalQuery: FilterQuery<HistoryDocument> =
      Array.isArray(or) && or.length > 0 ? { $or: or, ...query } : query;

    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.historyModel
        .find(finalQuery)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      this.historyModel.countDocuments(finalQuery),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
