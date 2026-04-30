import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Shipping, ShippingDocument } from "../schemas/shipping.schema";
import { Agent, AgentDocument } from "../schemas/agent.schema";
import { HistoryService } from "../history/history.service";
import { CreateShippingDto, UpdateShippingDto } from "./dto";
import { ShippingSerializer } from "./serializers";

@Injectable()
export class ShippingsService {
  constructor(
    @InjectModel(Shipping.name) private shippingModel: Model<ShippingDocument>,
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
    private historyService: HistoryService,
  ) { }

  async create(
    createShippingDto: CreateShippingDto,
    userId: string,
    userEmail: string
  ) {
    // Validate: requires name and at least email or phone
    if (!createShippingDto.name) {
      throw new BadRequestException("Name is required");
    }

    // Validate shippingModes (required, at least one value, all must be valid enum values)
    if (!createShippingDto.shippingModes || !Array.isArray(createShippingDto.shippingModes) || createShippingDto.shippingModes.length === 0) {
      throw new BadRequestException("shippingModes is required and must include at least one value");
    }

    const validTypes = ["maritime", "air", "road"];
    const invalidTypes = createShippingDto.shippingModes.filter(
      (type) => !validTypes.includes(type),
    );
    if (invalidTypes.length > 0) {
      throw new BadRequestException(
        `Invalid shippingModes values: ${invalidTypes.join(", ")}. Valid values are: ${validTypes.join(", ")}`,
      );
    }

    // Convert agent string IDs to ObjectIds
    const agents = createShippingDto.agents
      ? createShippingDto.agents.map((id) => new Types.ObjectId(id))
      : [];

    const shipping = new this.shippingModel({
      ...createShippingDto,
      agents,
    });

    const saved = await shipping.save();

    await this.historyService.log({
      action: "create",
      entityType: "shipping",
      entityId: saved._id.toString(),
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Shipping line "${saved.name}" created`,
      after: saved,
    });

    // Return the created shipping using serializer
    return ShippingSerializer.toCreateResponse(saved);
  }

  async findAll() {
    const shippings = await this.shippingModel
      .find({ isActive: true })
      .populate("agents", "firstName lastName email phone")
      .lean()
      .exec();

    // Format response using serializer
    return shippings.map((shipping) =>
      ShippingSerializer.toListResponse(shipping),
    );
  }

  async findOne(id: string) {
    const shipping = await this.shippingModel
      .findById(id)
      .populate("agents", "firstName lastName email phone")
      .exec();

    if (!shipping) {
      throw new NotFoundException(`Shipping with id "${id}" not found`);
    }
    if (!shipping.isActive) {
      throw new NotFoundException(`Shipping with id "${id}" not found`);
    }

    // Return the shipping using serializer
    return ShippingSerializer.toResponse(shipping);
  }

  async update(
    id: string,
    updateShippingDto: UpdateShippingDto,
    userId: string,
    userEmail: string,
  ) {
    const shipping = await this.shippingModel.findById(id).exec();

    if (!shipping) {
      throw new NotFoundException(`Shipping with id "${id}" not found`);
    }
    if (!shipping.isActive) {
      throw new NotFoundException(`Shipping with id "${id}" not found`);
    }

    const before = shipping.toObject();

    // Convert agent string IDs to ObjectIds if provided
    const updateData: any = { ...updateShippingDto };
    if (updateShippingDto.agents) {
      updateData.agents = updateShippingDto.agents.map(
        (agentId) => new Types.ObjectId(agentId),
      );
    }

    // Validate shippingModes if provided (at least one value, all must be valid enum values)
    if (updateShippingDto.shippingModes !== undefined) {
      if (!Array.isArray(updateShippingDto.shippingModes) || updateShippingDto.shippingModes.length === 0) {
        throw new BadRequestException("shippingModes must include at least one value");
      }

      const validTypes = ["maritime", "air", "road"];
      const invalidTypes = updateShippingDto.shippingModes.filter(
        (type) => !validTypes.includes(type),
      );
      if (invalidTypes.length > 0) {
        throw new BadRequestException(
          `Invalid shippingModes values: ${invalidTypes.join(", ")}. Valid values are: ${validTypes.join(", ")}`,
        );
      }
    }

    const updated = await this.shippingModel
      .findByIdAndUpdate(shipping._id, updateData, { new: true })
      .populate("agents", "firstName lastName email phone")
      .exec();

    const diff: Record<string, { from: any; to: any }> = {};
    for (const key of Object.keys(updateShippingDto)) {
      if (before[key] !== (updated as any)[key]) {
        diff[key] = { from: before[key], to: (updated as any)[key] };
      }
    }

    await this.historyService.log({
      action: "update",
      entityType: "shipping",
      entityId: shipping._id.toString(),
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Shipping line "${shipping.name}" updated`,
      before,
      after: updated,
      diff,
    });

    // Return the updated shipping using serializer
    return ShippingSerializer.toResponse(updated);
  }

  async remove(id: string, userId: string, userEmail: string) {
    const shipping = await this.shippingModel.findById(id).exec();

    if (!shipping) {
      throw new NotFoundException(`Shipping with id "${id}" not found`);
    }

    // Check if shipping line has agents
    if (shipping.agents && shipping.agents.length > 0) {
      throw new BadRequestException(
        "Cannot delete shipping line with active agents.",
      );
    }

    await this.shippingModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .exec();

    await this.historyService.log({
      action: "delete",
      entityType: "shipping",
      entityId: id,
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Shipping line "${shipping.name}" deleted`,
      before: shipping,
    });
  }

  async addAgents(
    shippingLineId: string,
    agentIds: string[],
    userId: string,
    userEmail: string
  ) {
    // Validate shipping line exists
    const shipping = await this.shippingModel.findById(shippingLineId).exec();

    if (!shipping) {
      throw new NotFoundException(
        `Shipping line with id "${shippingLineId}" not found`,
      );
    }

    // Validate all agents exist
    const agentObjectIds = agentIds.map((id) => {
      try {
        return new Types.ObjectId(id);
      } catch (error) {
        throw new BadRequestException(`Invalid agent ID format: "${id}"`);
      }
    });

    const existingAgents = await this.agentModel
      .find({ _id: { $in: agentObjectIds } })
      .exec();

    if (existingAgents.length !== agentIds.length) {
      const foundIds = new Set(
        existingAgents.map((agent) => agent._id.toString())
      );
      const missingIds = agentIds.filter(
        (id) => !foundIds.has(new Types.ObjectId(id).toString())
      );
      throw new NotFoundException(`Agents not found: ${missingIds.join(", ")}`);
    }

    // Get current agents in shipping line
    const currentAgentIds = (shipping.agents || []).map((id) => id.toString());

    // Filter out agents that are already associated
    const newAgentIds = agentObjectIds.filter(
      (id) => !currentAgentIds.includes(id.toString())
    );

    if (newAgentIds.length === 0) {
      return { success: true, added: 0 };
    }

    // Add agents to shipping line's agents array
    await this.shippingModel
      .findByIdAndUpdate(shippingLineId, {
        $addToSet: { agents: { $each: newAgentIds } },
      })
      .exec();

    // Update agents' shippingLineId field
    const shippingLineObjectId = new Types.ObjectId(shippingLineId);
    await this.agentModel
      .updateMany(
        { _id: { $in: newAgentIds } },
        { $set: { shippingLineId: shippingLineObjectId } },
      )
      .exec();

    await this.historyService.log({
      action: "update",
      entityType: "shipping",
      entityId: shippingLineId,
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Added ${newAgentIds.length} agent(s) to shipping line "${shipping.name}"`,
      after: {
        agents: [...currentAgentIds, ...newAgentIds.map((id) => id.toString())],
      },
    });

    return { success: true, added: newAgentIds.length };
  }

  async findByMode(mode: string) {
  const validModes = ["maritime", "air", "road"];

  if (!validModes.includes(mode)) {
    throw new BadRequestException(
      `Invalid shipping mode "${mode}". Valid values: ${validModes.join(", ")}`
    );
  }

  const shippings = await this.shippingModel
    .find({ shippingModes: mode })
    .populate("agents", "firstName lastName email phone")
    .lean()
    .exec();

  return shippings.map((shipping) =>
    ShippingSerializer.toListResponse(shipping),
  );
}

  async removeAgentsFromShippingLine(
    shippingLineId: string,
    agentIds: string[] | null, // si es null, quita todos los agentes
    userId: string,
    userEmail: string,
  ) {
    const shipping = await this.shippingModel.findById(shippingLineId).exec();

    if (!shipping) {
      throw new NotFoundException(
        `Shipping line with id "${shippingLineId}" not found`,
      );
    }

    const currentAgentIds = (shipping.agents || []).map((id) => id.toString());

    if (currentAgentIds.length === 0) {
      return { success: true, removed: 0 };
    }

    let agentsToRemove: string[] = currentAgentIds;

    if (agentIds && agentIds.length > 0) {
      const agentObjectIds = agentIds.map((id) => {
        try {
          return new Types.ObjectId(id).toString();
        } catch {
          throw new BadRequestException(`Invalid agent ID format: "${id}"`);
        }
      });

      agentsToRemove = agentObjectIds.filter((id) =>
        currentAgentIds.includes(id),
      );

      if (agentsToRemove.length === 0) {
        return { success: false, removed: 0, message: "No agents to remove" };
      }
    }

    await this.shippingModel
      .findByIdAndUpdate(shippingLineId, {
        $pull: {
          agents: { $in: agentsToRemove.map((id) => new Types.ObjectId(id)) },
        },
      })
      .exec();

    await this.agentModel
      .updateMany(
        { _id: { $in: agentsToRemove.map((id) => new Types.ObjectId(id)) } },
        { $unset: { shippingLineId: null } },
      )
      .exec();

    await this.historyService.log({
      action: "update",
      entityType: "shipping",
      entityId: shippingLineId,
      actorUserId: userId,
      actorEmail: userEmail,
      actorName: userEmail,
      origin: "api",
      status: "success",
      summary: `Removed ${agentsToRemove.length} agent(s) from shipping line "${shipping.name}"`,
      before: { agents: currentAgentIds },
      after: {
        agents: currentAgentIds.filter((id) => !agentsToRemove.includes(id)),
      },
    });

    return { success: true, removed: agentsToRemove.length };
  }
}
