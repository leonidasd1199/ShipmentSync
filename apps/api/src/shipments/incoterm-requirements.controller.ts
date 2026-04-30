import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { IncotermRequirementService } from "./services/incoterm-requirement.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionGuard } from "../auth/permission.middleware";
import { RequirementMode } from "../schemas/incoterm-requirement.schema";

@ApiTags("incoterm-requirements")
@ApiBearerAuth("JWT-auth")
@Controller("incotermRequirements")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IncotermRequirementsController {
  constructor(
    private readonly requirementService: IncotermRequirementService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Get incoterm requirement",
    description: "Returns requirement for given mode and incoterm",
  })
  @ApiQuery({
    name: "mode",
    enum: RequirementMode,
    description: "Shipment mode",
    example: RequirementMode.OCEAN,
  })
  @ApiQuery({
    name: "incoterm",
    description: "Incoterm",
    example: "FOB",
  })
  @ApiResponse({ status: 200, description: "Incoterm requirement" })
  @ApiResponse({ status: 404, description: "Requirement not found" })
  async findByModeAndIncoterm(
    @Query("mode") mode: string,
    @Query("incoterm") incoterm: string,
  ) {
    if (!mode || !incoterm) {
      throw new BadRequestException(
        "Both 'mode' and 'incoterm' query parameters are required",
      );
    }

    return this.requirementService.findByModeAndIncoterm(mode, incoterm);
  }
}