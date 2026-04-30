import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthService, LoginResponse } from "./auth.service";
import { Public } from "./public.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { UserId } from "./current-user.decorator";
import { MagicLinkService } from "../agents/magic-link.service";
import { ValidateMagicLinkDto } from "../agents/dto/magic-link.dto";
import { Req } from "@nestjs/common";
import type { Request } from "express";

export interface LoginDto {
  email: string;
  password: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly magicLinkService: MagicLinkService,
  ) {}

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "User login" })
  @ApiBody({
    description: "User login credentials",
    schema: {
      type: "object",
      properties: {
        email: { type: "string", example: "john.doe@shipsync.com" },
        password: { type: "string", example: "password123" },
      },
      required: ["email", "password"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    schema: {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            id: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            roleCode: { type: "string" },
            isActive: { type: "boolean" },
            mustChangePassword: { type: "boolean" },
            company: { type: "object" },
            offices: { type: "array" },
            permissions: { type: "array" },
          },
        },
        access_token: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiResponse({ status: 404, description: "User not found" })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Change user password" })
  @ApiBody({
    description: "Password change data",
    schema: {
      type: "object",
      properties: {
        currentPassword: {
          type: "string",
          example: "currentPassword123",
          description: "Current password",
        },
        newPassword: {
          type: "string",
          example: "newPassword456",
          description: "New password",
        },
      },
      required: ["currentPassword", "newPassword"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Password changed successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", example: "Password changed successfully" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Invalid current password" })
  @ApiResponse({ status: 404, description: "User not found" })
  async changePassword(
    @Body()
    changePasswordDto: {
      currentPassword: string;
      newPassword: string;
    },
    @UserId() userId: string,
  ) {
    return this.authService.changePassword(
      userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }

  @Post("magic-link/login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Authenticate agent using magic link",
    description:
      "Validate magic link token and return JWT access token for agent authentication",
  })
  @ApiBody({
    description: "Magic link token",
    schema: {
      type: "object",
      properties: {
        token: {
          type: "string",
          example: "abc123def456...",
          description: "Magic link token from URL",
        },
      },
      required: ["token"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Authentication successful",
    schema: {
      type: "object",
      properties: {
        agent: {
          type: "object",
          properties: {
            id: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
          },
        },
        access_token: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Invalid or expired magic link" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async magicLinkLogin(
    @Body() dto: ValidateMagicLinkDto,
    @Req() req: Request,
  ): Promise<{
    agent: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    access_token: string;
  }> {
    // Get client IP for tracking
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      undefined;

    // Validate magic link token
    const agentInfo = await this.magicLinkService.validateMagicLinkToken(
      dto.token,
      clientIp,
    );

    // Generate JWT token for agent
    const access_token = await this.authService.loginAgent(agentInfo.agentId);

    // Get agent details
    const agent = await this.authService.getAgentById(agentInfo.agentId);

    return {
      agent: {
        id: agent._id.toString(),
        firstName: agent.firstName,
        lastName: agent.lastName,
        email: agent.email,
      },
      access_token,
    };
  }
}
