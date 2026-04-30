import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
  CanActivate,
  ExecutionContext,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { AuthService } from "../auth/auth.service";
import { Reflector } from "@nestjs/core";

// Define our custom user interface
interface AuthenticatedUser {
  userId: string;
  email: string;
  roleCode: string;
  permissions?: string[];
}

@Injectable()
export class PermissionMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Get user from JWT authentication (set by JwtAuthGuard)
    const user = req.user as AuthenticatedUser;

    if (!user) {
      throw new UnauthorizedException("User not authenticated");
    }

    try {
      // Get user permissions
      const permissions = await this.authService.getUserPermissions(
        user.userId,
      );

      // Attach permissions to user object
      (req.user as AuthenticatedUser).permissions = permissions;

      next();
    } catch (error) {
      throw new UnauthorizedException("Invalid user");
    }
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>(
      "permission",
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true; // No permission required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new UnauthorizedException("User not authenticated");
    }

    // Use permissions already fetched by middleware (if available)
    if (user.permissions) {
      const hasPermission = user.permissions.includes(requiredPermission);
      if (!hasPermission) {
        throw new ForbiddenException(
          `Permission '${requiredPermission}' required`,
        );
      }
      return true;
    }

    // Fallback: fetch permissions if middleware didn't run
    const hasPermission = await this.authService.hasPermission(
      user.userId,
      requiredPermission,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Permission '${requiredPermission}' required`,
      );
    }

    return true;
  }
}

// Decorator to set required permission
export const RequirePermissionDecorator = (permission: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata("permission", permission, descriptor.value);
    return descriptor;
  };
};
