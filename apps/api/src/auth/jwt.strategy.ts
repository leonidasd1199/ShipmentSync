import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuthService } from "./auth.service";
import { Agent, AgentDocument } from "../schemas/agent.schema";

export interface JwtPayload {
  sub: string; // user ID or agent ID
  email?: string;
  roleCode: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || "your-secret-key-change-in-production",
    });
  }

  async validate(payload: JwtPayload) {
    // Handle agent authentication
    if (payload.roleCode === "AGENT") {
      const agent = await this.agentModel.findById(payload.sub).exec();

      if (!agent) {
        throw new UnauthorizedException("Agent not found");
      }

      if (!agent.isActive) {
        throw new UnauthorizedException("Agent account is inactive");
      }

      return {
        userId: payload.sub,
        email: payload.email || agent.email,
        roleCode: payload.roleCode,
        isAgent: true,
      };
    }

    // Handle user authentication (existing logic)
    const user = await this.authService.validateUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("User account is inactive");
    }

    return {
      userId: payload.sub,
      email: payload.email,
      roleCode: payload.roleCode,
      isAgent: false,
    };
  }
}
