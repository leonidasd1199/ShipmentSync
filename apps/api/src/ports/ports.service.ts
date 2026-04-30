import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Port, PortDocument } from "../schemas/port.schema";
import { CreatePortDto, UpdatePortDto } from "./dto";
import { PortSerializer } from "./serializers";

@Injectable()
export class PortsService {
  constructor(
    @InjectModel(Port.name) private portModel: Model<PortDocument>,
  ) {}

  async create(createPortDto: CreatePortDto) {
    // Validate port type
    const validTypes = ["sea", "air", "rail", "inland", "other"];
    if (!validTypes.includes(createPortDto.type)) {
      throw new BadRequestException(
        `Invalid type: "${createPortDto.type}". Valid values are: ${validTypes.join(", ")}`,
      );
    }

    // Validate countryCode format if provided
    if (createPortDto.countryCode && createPortDto.countryCode.length !== 2) {
      throw new BadRequestException(
        "countryCode must be exactly 2 characters (ISO 3166-1 alpha-2)",
      );
    }

    // Validate coordinates if provided
    if (createPortDto.latitude !== undefined) {
      if (createPortDto.latitude < -90 || createPortDto.latitude > 90) {
        throw new BadRequestException(
          "latitude must be between -90 and 90",
        );
      }
    }

    if (createPortDto.longitude !== undefined) {
      if (createPortDto.longitude < -180 || createPortDto.longitude > 180) {
        throw new BadRequestException(
          "longitude must be between -180 and 180",
        );
      }
    }

    const port = new this.portModel({
      ...createPortDto,
      isActive: createPortDto.isActive !== undefined ? createPortDto.isActive : true,
    });

    const saved = await port.save();
    return PortSerializer.toCreateResponse(saved);
  }

  async findAll(filters?: {
    type?: string;
    countryCode?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const queryFilter: any = {};

    // Apply type filter
    if (filters?.type) {
      queryFilter.type = filters.type;
    }

    // Apply countryCode filter
    if (filters?.countryCode) {
      queryFilter.countryCode = filters.countryCode.toUpperCase();
    }

    // Apply isActive filter
    if (filters?.isActive !== undefined) {
      queryFilter.isActive = filters.isActive;
    }

    // Apply search filter (searches in name, city, countryName, unlocode)
    if (filters?.search) {
      queryFilter.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { city: { $regex: filters.search, $options: "i" } },
        { countryName: { $regex: filters.search, $options: "i" } },
        { unlocode: { $regex: filters.search, $options: "i" } },
      ];
    }

    const ports = await this.portModel.find(queryFilter).lean().exec();

    return ports.map((port) => PortSerializer.toListResponse(port));
  }

  async findOne(id: string) {
    const port = await this.portModel.findById(id).exec();

    if (!port) {
      throw new NotFoundException(`Port with id "${id}" not found`);
    }

    return PortSerializer.toResponse(port);
  }

  async update(id: string, updatePortDto: UpdatePortDto) {
    const port = await this.portModel.findById(id).exec();

    if (!port) {
      throw new NotFoundException(`Port with id "${id}" not found`);
    }

    // Validate port type if provided
    if (updatePortDto.type) {
      const validTypes = ["sea", "air", "rail", "inland", "other"];
      if (!validTypes.includes(updatePortDto.type)) {
        throw new BadRequestException(
          `Invalid type: "${updatePortDto.type}". Valid values are: ${validTypes.join(", ")}`,
        );
      }
    }

    // Validate countryCode format if provided
    if (updatePortDto.countryCode && updatePortDto.countryCode.length !== 2) {
      throw new BadRequestException(
        "countryCode must be exactly 2 characters (ISO 3166-1 alpha-2)",
      );
    }

    // Validate coordinates if provided
    if (updatePortDto.latitude !== undefined) {
      if (updatePortDto.latitude < -90 || updatePortDto.latitude > 90) {
        throw new BadRequestException(
          "latitude must be between -90 and 90",
        );
      }
    }

    if (updatePortDto.longitude !== undefined) {
      if (updatePortDto.longitude < -180 || updatePortDto.longitude > 180) {
        throw new BadRequestException(
          "longitude must be between -180 and 180",
        );
      }
    }

    const updated = await this.portModel
      .findByIdAndUpdate(id, updatePortDto, { new: true })
      .exec();

    return PortSerializer.toResponse(updated);
  }

  async remove(id: string) {
    const port = await this.portModel.findById(id).exec();

    if (!port) {
      throw new NotFoundException(`Port with id "${id}" not found`);
    }

    // Soft delete: set isActive = false
    const updated = await this.portModel
      .findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true },
      )
      .exec();

    return PortSerializer.toResponse(updated);
  }
}

