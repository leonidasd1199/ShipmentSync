import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";

/**
 * Guard that ensures the authenticated user IS an agent
 * Used for agent endpoints that should only be accessible to agents
 */
@Injectable()
export class AgentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    // Check if user is an agent
    if (user.isAgent !== true && user.roleCode !== "AGENT") {
      throw new ForbiddenException(
        "This endpoint is only available for agents",
      );
    }

    return true;
  }
}
