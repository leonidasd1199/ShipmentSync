import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { randomBytes, createHash } from "crypto";
import { Agent, AgentDocument } from "../schemas/agent.schema";
import {
  MagicLinkToken,
  MagicLinkTokenDocument,
} from "../schemas/magic-link-token.schema";
import { MailService } from "../mail/mail.service";
import { ConfigService } from "@nestjs/config";
import type {
  GenerateMagicLinkDto,
  MagicLinkResponseDto,
} from "./dto/magic-link.dto";

@Injectable()
export class MagicLinkService {
  private readonly logger = new Logger(MagicLinkService.name);
  private readonly frontendUrl: string;
  private readonly defaultExpirationHours: number = 72; // Changed from 24 to 72 hours

  constructor(
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
    @InjectModel(MagicLinkToken.name)
    private magicLinkTokenModel: Model<MagicLinkTokenDocument>,
    private mailService: MailService,
    private configService: ConfigService,
  ) {
    // Get frontend URL from environment or use default
    this.frontendUrl =
      this.configService.get<string>("FRONTEND_URL") ||
      process.env.VITE_API_BASE?.replace("/api", "") ||
      "http://localhost:5173";
  }

  /**
   * Generate a secure random token
   */
  private generateSecureToken(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Hash token for storage (using SHA-256)
   */
  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /**
   * Generate magic link for an agent
   * Links can be used multiple times until they expire or are revoked
   */
  async generateMagicLink(
    dto: GenerateMagicLinkDto,
    createdByEmail: string,
  ): Promise<MagicLinkResponseDto> {
    // Validate agent exists and is active
    let agentObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(dto.agentId);
    } catch (error) {
      throw new BadRequestException(`Invalid agentId format: "${dto.agentId}"`);
    }

    const agent = await this.agentModel.findById(agentObjectId).exec();
    if (!agent) {
      throw new NotFoundException(`Agent with id "${dto.agentId}" not found`);
    }

    if (!agent.isActive) {
      throw new BadRequestException(
        "Cannot generate magic link for inactive agent",
      );
    }

    // Calculate expiration - minimum 72 hours
    let expiresInHours = dto.expiresInHours || this.defaultExpirationHours;
    if (expiresInHours < 72) {
      expiresInHours = 72; // Enforce minimum 72 hours
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Generate token
    let rawToken = this.generateSecureToken();
    let hashedToken = this.hashToken(rawToken);

    // Check if token already exists (very unlikely but handle it)
    const existingToken = await this.magicLinkTokenModel
      .findOne({ token: hashedToken })
      .exec();
    if (existingToken) {
      // Retry once (extremely rare case)
      rawToken = this.generateSecureToken();
      hashedToken = this.hashToken(rawToken);
    }

    // Create magic link token record
    const magicLinkToken = new this.magicLinkTokenModel({
      agentId: agentObjectId,
      token: hashedToken,
      expiresAt,
      purpose: dto.purpose || "temporary",
      createdBy: createdByEmail,
      notes: dto.notes,
      revoked: false,
      useCount: 0,
      usageHistory: [],
      // Legacy fields for backward compatibility
      used: false,
    });

    await magicLinkToken.save();

    // Generate magic link URL
    const magicLink = `${this.frontendUrl}/agent/auth?token=${rawToken}`;

    // Send email to agent
    try {
      await this.mailService.sendEmail({
        to: agent.email,
        subject: "Your ShipSync Portal Access Link",
        template: "magic-link",
        context: {
          agentName: `${agent.firstName} ${agent.lastName}`,
          magicLink,
          expiresAt: expiresAt.toISOString(),
          expiresInHours,
          purpose: dto.purpose || "temporary",
        },
      });
    } catch (error) {
      this.logger.error("Failed to send magic link email", error);
    }

    return {
      magicLink,
      expiresAt: expiresAt.toISOString(),
      purpose: dto.purpose || "temporary",
      agentEmail: agent.email,
      agentName: `${agent.firstName} ${agent.lastName}`,
    };
  }

  /**
   * Validate magic link token and return agent info
   * Links can be used multiple times until they expire or are revoked
   */
  async validateMagicLinkToken(
    rawToken: string,
    clientIp?: string,
  ): Promise<{
    agentId: string;
    agentEmail: string;
    agentName: string;
  }> {
    if (!rawToken || rawToken.length < 10) {
      throw new BadRequestException("Invalid token format");
    }

    const hashedToken = this.hashToken(rawToken);

    // Find token
    const tokenDoc = await this.magicLinkTokenModel
      .findOne({ token: hashedToken })
      .populate("agentId")
      .exec();

    if (!tokenDoc) {
      throw new UnauthorizedException("Invalid or expired magic link");
    }

    // Check if revoked
    if (tokenDoc.revoked) {
      throw new UnauthorizedException("Magic link has been revoked");
    }

    // Check expiration
    if (new Date() > tokenDoc.expiresAt) {
      throw new UnauthorizedException("Magic link has expired");
    }

    // Get agent
    const agent = tokenDoc.agentId as unknown as AgentDocument;
    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    if (!agent.isActive) {
      throw new UnauthorizedException("Agent account is inactive");
    }

    // Track usage (but don't invalidate the token)
    const usageEntry = {
      usedAt: new Date(),
      usedByIp: clientIp,
    };

    await this.magicLinkTokenModel
      .findByIdAndUpdate(tokenDoc._id, {
        $inc: { useCount: 1 },
        $set: {
          lastUsedAt: usageEntry.usedAt,
          lastUsedByIp: clientIp,
          // Legacy fields
          used: true,
          usedAt: usageEntry.usedAt,
          usedByIp: clientIp,
        },
        $push: {
          usageHistory: {
            $each: [usageEntry],
            $slice: -100, // Keep only last 100 usages
          },
        },
      })
      .exec();

    return {
      agentId: agent._id.toString(),
      agentEmail: agent.email,
      agentName: `${agent.firstName} ${agent.lastName}`,
    };
  }

  /**
   * Revoke all active magic links for an agent
   */
  async revokeAgentMagicLinks(agentId: string): Promise<{ revoked: number }> {
    let agentObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(agentId);
    } catch (error) {
      throw new BadRequestException(`Invalid agentId format: "${agentId}"`);
    }

    const result = await this.magicLinkTokenModel.updateMany(
      {
        agentId: agentObjectId,
        revoked: false,
        expiresAt: { $gt: new Date() },
      },
      {
        revoked: true,
        // Legacy field
        used: true,
        usedAt: new Date(),
      },
    );

    return { revoked: result.modifiedCount };
  }

  /**
   * Revoke a specific magic link by ID
   */
  async revokeMagicLinkById(
    linkId: string,
  ): Promise<{ success: boolean; message: string }> {
    let linkObjectId: Types.ObjectId;
    try {
      linkObjectId = new Types.ObjectId(linkId);
    } catch (error) {
      throw new BadRequestException(`Invalid link ID format: "${linkId}"`);
    }

    const result = await this.magicLinkTokenModel
      .findByIdAndUpdate(
        linkObjectId,
        {
          revoked: true,
          used: true,
          usedAt: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!result) {
      throw new NotFoundException(`Magic link with id "${linkId}" not found`);
    }

    return { success: true, message: "Magic link revoked successfully" };
  }

  /**
   * Get active magic links for an agent
   */
  async getAgentMagicLinks(agentId: string): Promise<
    Array<{
      id: string;
      purpose: string;
      expiresAt: Date;
      revoked: boolean;
      useCount: number;
      lastUsedAt?: Date;
      createdAt: Date;
      createdBy?: string;
      notes?: string;
      isActive: boolean;
    }>
  > {
    let agentObjectId: Types.ObjectId;
    try {
      agentObjectId = new Types.ObjectId(agentId);
    } catch (error) {
      throw new BadRequestException(`Invalid agentId format: "${agentId}"`);
    }

    const tokens = await this.magicLinkTokenModel
      .find({ agentId: agentObjectId })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    const now = new Date();

    return tokens.map((token) => ({
      id: token._id.toString(),
      purpose: token.purpose,
      expiresAt: token.expiresAt,
      revoked: token.revoked || false,
      useCount: token.useCount || 0,
      lastUsedAt: token.lastUsedAt,
      createdAt: token.createdAt || new Date(),
      createdBy: token.createdBy,
      notes: token.notes,
      // Link is active if not revoked and not expired
      isActive: !token.revoked && token.expiresAt > now,
    }));
  }
}