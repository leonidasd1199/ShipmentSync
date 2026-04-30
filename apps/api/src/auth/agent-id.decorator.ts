import { createParamDecorator, ExecutionContext, BadRequestException } from "@nestjs/common";

/**
 * Decorator to extract agent ID from JWT token
 * For agents: userId is the agentId
 * For regular users: throws error (agents only)
 * @usage @AgentId() agentId: string
 */
export const AgentId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new BadRequestException("User not authenticated");
    }

    // For agents, userId is the agentId
    if (user.isAgent === true || user.roleCode === "AGENT") {
      return user.userId;
    }

    throw new BadRequestException(
      "This endpoint is only available for agents",
    );
  },
);
