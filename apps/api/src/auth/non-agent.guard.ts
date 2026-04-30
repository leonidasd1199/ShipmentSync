import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";

/**
 * Guard that ensures the authenticated user is NOT an agent
 * Used for operator endpoints that should only be accessible to regular users
 */
@Injectable()
export class NonAgentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    // Check if user is an agent
    if (user.isAgent === true || user.roleCode === "AGENT") {
      throw new ForbiddenException(
        "This endpoint is not available for agents",
      );
    }

    return true;
  }
}
