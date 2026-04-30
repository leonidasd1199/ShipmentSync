import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const url = request.url || request.path;

    // Skip authentication for Swagger UI routes and static files
    if (
      url &&
      (url.startsWith("/api") ||
        url.startsWith("/api-json") ||
        url.includes("swagger-ui") ||
        url.includes(".css") ||
        url.includes(".js") ||
        url.includes(".png") ||
        url.includes(".ico") ||
        url.includes("favicon"))
    ) {
      return true;
    }

    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context) as boolean;
  }
}
