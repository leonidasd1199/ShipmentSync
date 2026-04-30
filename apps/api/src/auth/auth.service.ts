import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { Model } from "mongoose";
import { User, UserDocument } from "../schemas/user.schema";
import { Company, CompanyDocument } from "../schemas/company.schema";
import { Office, OfficeDocument } from "../schemas/office.schema";
import {
  PermissionModel,
  PermissionDocument,
} from "../schemas/permission.schema";
import { Role, RoleDocument } from "../schemas/role.schema";
import { Agent, AgentDocument } from "../schemas/agent.schema";
import { JwtPayload } from "./jwt.strategy";
import bcrypt from "bcryptjs";

export interface LoginResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    roleCode: string;
    isActive: boolean;
    mustChangePassword?: boolean;
    company?: {
      id: string;
      name: string;
    };
    offices?: Array<{
      id: string;
      name: string;
      type: string;
    }>;
    permissions: string[];
  };
  access_token: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Office.name) private officeModel: Model<OfficeDocument>,
    @InjectModel(PermissionModel.name)
    private permissionModel: Model<PermissionDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    // Find user by email
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .populate("role")
      .populate("company")
      .populate("offices")
      .populate("permissions")
      .exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException("User account is inactive");
    }

    // Verify password
    if (!user.password) {
      throw new UnauthorizedException("Invalid credentials");
    }

    let isPasswordValid: boolean = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch {
      isPasswordValid = false;
    }
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Update last login
    await this.userModel.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date(),
    });

    // Get company and offices details using populated data
    let companyDetails: { id: string; name: string } | undefined = undefined;
    let officesDetails: Array<{ id: string; name: string; type: string }> = [];

    // Company details from populated data
    if (
      user.company &&
      typeof user.company === "object" &&
      "name" in user.company
    ) {
      companyDetails = {
        id: user.company._id?.toString() ?? "",
        name: user.company.name as string,
      };
    }

    // Office details from populated data
    if (user.offices && user.offices.length > 0) {
      officesDetails = user.offices
        .filter((office) => typeof office === "object" && "name" in office)
        .map((office) => ({
          id: office._id.toString(),
          name: office.name as string,
          type: "",
        }));
    }

    // Extract permission codes
    const permissionCodes =
      (user.permissions as unknown as PermissionDocument[])?.map(
        (p) => p.code,
      ) || [];

    // Generate JWT token
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      roleCode: user.roleCode,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roleCode: user.roleCode,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        company: companyDetails,
        offices: officesDetails,
        permissions: permissionCodes,
      },
      access_token,
    };
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.userModel
      .findById(userId)
      .populate("permissions")
      .exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return (
      (user.permissions as unknown as PermissionDocument[])?.map(
        (p) => p.code,
      ) || []
    );
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  async validateUserById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId).exec();
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // Find user by ID
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException("User account is inactive");
    }

    // Verify current password
    if (!user.password) {
      throw new UnauthorizedException("Invalid current password");
    }

    let isPasswordValid: boolean = false;
    try {
      isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    } catch {
      isPasswordValid = false;
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid current password");
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Build update object
    const updateData: Partial<UserDocument> = {
      password: hashedNewPassword,
      lastPasswordResetAt: new Date(),
    };

    // If mustChangePassword is true, set it to false after successful change
    if (user.mustChangePassword === true) {
      updateData.mustChangePassword = false;
    }

    // Update password, lastPasswordResetAt, and mustChangePassword flag
    await this.userModel.findByIdAndUpdate(userId, updateData).exec();

    return { message: "Password changed successfully" };
  }

  /**
   * Login agent using magic link (generates JWT token)
   */
  async loginAgent(agentId: string): Promise<string> {
    const agent = await this.agentModel.findById(agentId).exec();

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    if (!agent.isActive) {
      throw new UnauthorizedException("Agent account is inactive");
    }

    // Generate JWT token for agent
    // Agents use a special role code "AGENT" for identification
    const payload: JwtPayload = {
      sub: agent._id.toString(),
      email: agent.email,
      roleCode: "AGENT", // Special role code for agents
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Get agent by ID
   */
  async getAgentById(agentId: string): Promise<AgentDocument> {
    const agent = await this.agentModel.findById(agentId).exec();

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    return agent;
  }
}
