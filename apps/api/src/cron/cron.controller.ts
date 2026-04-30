import { Controller, Get, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionGuard, RequirePermissionDecorator } from "../auth/permission.middleware";
import { PricelistNotificationCronService } from "./pricelist-notification.cron.service";

@ApiTags("cron")
@ApiBearerAuth("JWT-auth")
@Controller("cron")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CronController {
  constructor(
    private readonly pricelistNotificationCronService: PricelistNotificationCronService,
  ) {}

  @Get("pricelist-notification/trigger")
  @HttpCode(HttpStatus.OK)
  @RequirePermissionDecorator("permissions:assign") // Only ops_admin can trigger
  @ApiOperation({
    summary: "Manually trigger pricelist notification cron job",
    description:
      "Manually triggers the weekly pricelist notification cron job. Useful for testing email content and functionality. Only accessible to operators (ops_admin role).",
  })
  @ApiResponse({
    status: 200,
    description: "Cron job triggered successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        operatorsNotified: { type: "number" },
        pendingCount: { type: "number" },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Only operators can trigger this endpoint",
  })
  async triggerPricelistNotification() {
    return this.pricelistNotificationCronService.triggerNotificationManually();
  }
}
