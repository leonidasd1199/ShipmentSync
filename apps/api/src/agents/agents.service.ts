/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Agent, AgentDocument } from "../schemas/agent.schema";
import { Shipping, ShippingDocument } from "../schemas/shipping.schema";
import { HistoryService } from "../history/history.service";

export interface CreateAgentDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  address: {
    street: string;
    city: string;
    state?: string;
    zipCode?: string;
    country: string;
  };
  notes?: string;
  shippingLineId?: string; // MongoDB ObjectId as string
}

export interface UpdateAgentDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  notes?: string;
  shippingLineId?: string;
  isActive?: boolean;
}

export interface AgentResponse extends Omit<Agent, "shippingLineId"> {
  id: string;
  shippingLineId?: string;
  shippingLines: Array<{ id: string; name: string }>;
  _id?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
    @InjectModel(Shipping.name) private shippingModel: Model<ShippingDocument>,
    private historyService: HistoryService,
  ) {}

  async create(
    createAgentDto: CreateAgentDto,
    userId: string,
    userEmail: string,
  ) {
    // Validate shipping line exists if shippingLineId is provided
    let shipping: ShippingDocument | null = null;
    let shippingLineObjectId: Types.ObjectId | undefined = undefined;
    if (createAgentDto.shippingLineId) {
      try {
        shippingLineObjectId = new Types.ObjectId(createAgentDto.shippingLineId);
      } catch (error) {
        throw new BadRequestException(
          `Invalid shippingLineId format: "${createAgentDto.shippingLineId}"`,
        );
      }

      shipping = await this.shippingModel.findById(shippingLineObjectId).exec();

      if (!shipping) {
        throw new NotFoundException(
          `Shipping line with id "${createAgentDto.shippingLineId}" not found`,
        );
      }
    }

    // Create agent with ObjectId shippingLineId
    const agentData: any = { ...createAgentDto };
    if (shippingLineObjectId) {
      agentData.shippingLineId = shippingLineObjectId;
    }
    const agent = new this.agentModel(agentData);

    const saved = await agent.save();

    // If shippingLineId was provided, add agent to shipping's agents array
    if (shippingLineObjectId && shipping) {
      const agentObjectId = new Types.ObjectId(saved._id);

      // Check if agent is already in the array to avoid duplicates
      if (
        !shipping.agents.some(
          (id) => id.toString() === agentObjectId.toString(),
        )
      ) {
        await this.shippingModel
          .findByIdAndUpdate(shippingLineObjectId, {
            $addToSet: { agents: agentObjectId },
          })
          .exec();
      }
    }

    await this.historyService.log({
      action: "create",
      entityType: "agent",
      entityId: saved._id.toString(),
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Agent "${saved.firstName} ${saved.lastName}" created`,
      after: saved,
    });

    // Return response based on whether shippingLineId was provided
    const savedObj = saved.toObject() as any;
    if (createAgentDto.shippingLineId) {
      return {
        id: saved._id.toString(),
        firstName: saved.firstName,
        lastName: saved.lastName,
        shippingLineId: saved.shippingLineId?.toString(),
        createdAt: savedObj.createdAt,
      };
    } else {
      return {
        id: saved._id.toString(),
        firstName: saved.firstName,
        lastName: saved.lastName,
        createdAt: savedObj.createdAt,
      };
    }
  }

  async findAll(
    assigned?: "all" | "true" | "false",
    shippingLineId?: string,
    page: number = 1,
    pageSize: number = 50,
  ): Promise<{
    items: AgentResponse[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    let agentIdsFromShippingLine: Types.ObjectId[] | null = null;
    if (shippingLineId) {
      try {
        const shippingLineObjectId = new Types.ObjectId(shippingLineId);
        const shippingLine = await this.shippingModel
          .findById(shippingLineObjectId)
          .select("agents")
          .lean()
          .exec();

        if (!shippingLine) {
          return { items: [], page, pageSize, total: 0 };
        }

        agentIdsFromShippingLine = (shippingLine.agents || []).map(
          (id) => new Types.ObjectId(id),
        );
      } catch {
        throw new BadRequestException(
          `Invalid shipping line ID format: "${shippingLineId}"`,
        );
      }
    }

    let assignedAgentIds: Types.ObjectId[] | null = null;
    if (assigned === "false") {
      const allShippingLines = await this.shippingModel
        .find({ isActive: true })
        .select("agents")
        .lean()
        .exec();

      const assignedAgentIdSet = new Set<string>();
      for (const sl of allShippingLines) {
        if (sl.agents) {
          for (const agentId of sl.agents) {
            assignedAgentIdSet.add(agentId.toString());
          }
        }
      }
      assignedAgentIds = Array.from(assignedAgentIdSet).map(
        (id) => new Types.ObjectId(id),
      );
    }

    const queryFilter: any = { isActive: true };

    if (assigned === "true" && shippingLineId && agentIdsFromShippingLine) {
      if (agentIdsFromShippingLine.length === 0) {
        return { items: [], page, pageSize, total: 0 };
      }
      queryFilter._id = { $in: agentIdsFromShippingLine };
    } else if (assigned === "false" && assignedAgentIds) {
      queryFilter._id = { $nin: assignedAgentIds };
    } else if (
      assigned !== "all" &&
      shippingLineId &&
      agentIdsFromShippingLine
    ) {
      if (agentIdsFromShippingLine.length === 0) {
        return { items: [], page, pageSize, total: 0 };
      }
      queryFilter._id = { $in: agentIdsFromShippingLine };
    }

    const skip = (page - 1) * pageSize;
    const total = await this.agentModel.countDocuments(queryFilter).exec();

    const agents = await this.agentModel
      .find(queryFilter)
      .skip(skip)
      .limit(pageSize)
      .lean()
      .exec();

    const agentIds = agents.map((agent) => agent._id);

    const shippingLinesWithAgents = await this.shippingModel
      .find({ agents: { $in: agentIds } })
      .select("_id name agents")
      .lean()
      .exec();

    const agentShippingLinesMap = new Map<
      string,
      Array<{ id: string; name: string }>
    >();

    agents.forEach((agent) => {
      agentShippingLinesMap.set(agent._id.toString(), []);
    });

    for (const shippingLine of shippingLinesWithAgents) {
      const slData = {
        id: shippingLine._id.toString(),
        name: shippingLine.name,
      };
      if (shippingLine.agents) {
        for (const agentId of shippingLine.agents) {
          const agentIdStr = agentId.toString();
          if (agentShippingLinesMap.has(agentIdStr)) {
            agentShippingLinesMap.get(agentIdStr)!.push(slData);
          }
        }
      }
    }

    const items: AgentResponse[] = agents.map((agent) => ({
      id: agent._id.toString(),
      ...agent,
      shippingLineId: agent.shippingLineId?.toString(),
      shippingLines: agentShippingLinesMap.get(agent._id.toString()) || [],
    }));

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async update(
    agentId: string,
    updateAgentDto: UpdateAgentDto,
    userId: string,
    userEmail: string,
  ) {
    const agent = await this.agentModel.findById(agentId).exec();

    if (!agent) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    const before = agent.toObject();

    // If shippingLineId is being updated, validate it exists
    let shippingLineObjectId: Types.ObjectId | null | undefined = undefined;
    if (updateAgentDto.shippingLineId !== undefined) {
      if (updateAgentDto.shippingLineId) {
        try {
          shippingLineObjectId = new Types.ObjectId(updateAgentDto.shippingLineId);
        } catch (error) {
          throw new BadRequestException(
            `Invalid shippingLineId format: "${updateAgentDto.shippingLineId}"`,
          );
        }

        const shipping = await this.shippingModel
          .findById(shippingLineObjectId)
          .exec();

        if (!shipping) {
          throw new NotFoundException(
            `Shipping line with id "${updateAgentDto.shippingLineId}" not found`,
          );
        }

        // Add agent to shipping's agents array if not already there
        const agentObjectId = new Types.ObjectId(agentId);
        if (
          !shipping.agents.some(
            (id) => id.toString() === agentObjectId.toString(),
          )
        ) {
          await this.shippingModel
            .findByIdAndUpdate(shippingLineObjectId, {
              $addToSet: { agents: agentObjectId },
            })
            .exec();
        }
      } else {
        // shippingLineId is being cleared (set to null)
        shippingLineObjectId = null;
        
        // Remove agent from previous shipping line's agents array if it exists
        if (agent.shippingLineId) {
          await this.shippingModel
            .findByIdAndUpdate(agent.shippingLineId, {
              $pull: { agents: new Types.ObjectId(agentId) },
            })
            .exec();
        }
      }
    }

    // Handle partial address updates using dot notation to preserve existing fields
    const updateData: any = { ...updateAgentDto };
    
    // Convert shippingLineId string to ObjectId if provided
    if (updateAgentDto.shippingLineId !== undefined) {
      if (shippingLineObjectId !== undefined) {
        updateData.shippingLineId = shippingLineObjectId;
      }
    }
    
    if (updateAgentDto.address) {
      // Use dot notation for address fields to merge instead of replace
      const addressUpdate: any = {};
      if (updateAgentDto.address.street !== undefined) {
        addressUpdate["address.street"] = updateAgentDto.address.street;
      }
      if (updateAgentDto.address.city !== undefined) {
        addressUpdate["address.city"] = updateAgentDto.address.city;
      }
      if (updateAgentDto.address.state !== undefined) {
        addressUpdate["address.state"] = updateAgentDto.address.state;
      }
      if (updateAgentDto.address.zipCode !== undefined) {
        addressUpdate["address.zipCode"] = updateAgentDto.address.zipCode;
      }
      if (updateAgentDto.address.country !== undefined) {
        addressUpdate["address.country"] = updateAgentDto.address.country;
      }
      // Remove address from updateData and merge address fields
      delete updateData.address;
      Object.assign(updateData, addressUpdate);
    }

    const updated = await this.agentModel
      .findByIdAndUpdate(agentId, { $set: updateData }, { new: true })
      .exec();

    const diff: Record<string, { from: any; to: any }> = {};
    for (const key of Object.keys(updateAgentDto)) {
      if (before[key] !== (updated as any)[key]) {
        diff[key] = { from: before[key], to: (updated as any)[key] };
      }
    }

    await this.historyService.log({
      action: "update",
      entityType: "agent",
      entityId: agentId,
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Agent "${agent.firstName} ${agent.lastName}" updated`,
      before,
      after: updated,
      diff,
    });

    return updated;
  }

  async removeAgents(agentIds: string[], userId: string, userEmail: string) {
    // Validate all agent IDs format
    const agentObjectIds = agentIds.map((id) => {
      try {
        return new Types.ObjectId(id);
      } catch (error) {
        throw new BadRequestException(`Invalid agent ID format: "${id}"`);
      }
    });

    // Find all agents that exist
    const existingAgents = await this.agentModel
      .find({ _id: { $in: agentObjectIds } })
      .exec();

    if (existingAgents.length === 0) {
      throw new NotFoundException("No agents found with the provided IDs");
    }

    const foundIds = existingAgents.map((agent) => agent._id);

    // Remove agents from shipping lines' agents arrays
    for (const agent of existingAgents) {
      if (agent.shippingLineId) {
        // shippingLineId is now always Types.ObjectId, so we can use it directly
        await this.shippingModel
          .findByIdAndUpdate(agent.shippingLineId, {
            $pull: { agents: agent._id },
          })
          .exec();
      }
    }

    // Soft delete the agents
    const updateResult = await this.agentModel
      .updateMany(
        { _id: { $in: foundIds } },
        { $set: { isActive: false } },
      )
      .exec();

    // Log deletion for each agent
    for (const agent of existingAgents) {
      await this.historyService.log({
        action: "delete",
        entityType: "agent",
        entityId: agent._id.toString(),
        actorUserId: userId,
        actorEmail: userEmail,
        actorName: userEmail,
        origin: "api",
        status: "success",
        summary: `Agent "${agent.firstName} ${agent.lastName}" soft deleted (isActive = false)`,
        before: agent,
      });
    }

    return { success: true, removed: updateResult.modifiedCount };
  }
}
