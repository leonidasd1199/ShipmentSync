import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  IncotermRequirement,
  IncotermRequirementDocument,
  RequirementMode,
} from "../../schemas/incoterm-requirement.schema";

@Injectable()
export class IncotermRequirementService {
  constructor(
    @InjectModel(IncotermRequirement.name)
    private requirementModel: Model<IncotermRequirementDocument>,
  ) {}

  /**
   * Get incoterm requirement by mode and incoterm
   */
  async findByModeAndIncoterm(
    mode: RequirementMode | string,
    incoterm: string,
  ): Promise<IncotermRequirementDocument> {
    // Normalize mode (MARITIME -> OCEAN)
    const normalizedMode =
      mode === "MARITIME" ? RequirementMode.OCEAN : (mode as RequirementMode);

    const requirement = await this.requirementModel
      .findOne({
        mode: normalizedMode,
        incoterm: incoterm.toUpperCase().trim(),
        active: true,
      })
      .exec();

    if (!requirement) {
      throw new NotFoundException(
        `No active requirement found for mode=${mode}, incoterm=${incoterm}`,
      );
    }

    return requirement;
  }

  /**
   * Get all active requirements
   */
  async findAllActive(): Promise<IncotermRequirementDocument[]> {
    return this.requirementModel.find({ active: true }).exec();
  }

  /**
   * Create or update requirement
   */
  async upsert(
    mode: RequirementMode,
    incoterm: string,
    data: Partial<IncotermRequirement>,
  ): Promise<IncotermRequirementDocument> {
    return this.requirementModel
      .findOneAndUpdate(
        { mode, incoterm: incoterm.toUpperCase().trim() },
        { ...data, mode, incoterm: incoterm.toUpperCase().trim() },
        { upsert: true, new: true },
      )
      .exec();
  }
}