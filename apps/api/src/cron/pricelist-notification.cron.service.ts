import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AgentPricelist, AgentPricelistDocument, PricelistStatus } from "../schemas/agent-pricelist.schema";
import { User, UserDocument } from "../schemas/user.schema";
import { RoleCode } from "../common/enums/role.enum";
import { MailService } from "../mail/mail.service";
import { ConfigService } from "@nestjs/config";

/**
 * Cron service that sends weekly email notifications to operators
 * about pending pricelists that need review.
 * 
 * Schedule: Every Monday at 9:00 AM (configurable via CRON_TIMEZONE env var)
 * 
 * Flow:
 * 1. Runs every Monday at configured time
 * 2. Queries for all pricelists with status = "submitted"
 * 3. Gets all active operators (ops_admin role)
 * 4. If pending pricelists exist, sends email notification
 * 5. Tracks last notification date to prevent duplicates
 */
@Injectable()
export class PricelistNotificationCronService {
  private readonly logger = new Logger(PricelistNotificationCronService.name);
  private lastNotificationDate: Date | null = null;

  constructor(
    @InjectModel(AgentPricelist.name)
    private pricelistModel: Model<AgentPricelistDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private mailService: MailService,
    private configService: ConfigService,
  ) {}

  /**
   * Cron job that runs every Monday at 9:00 AM
   * Cron expression: "0 9 * * 1" = At 09:00 on Monday
   * 
   * Note: Timezone can be configured via CRON_TIMEZONE environment variable
   * Example: CRON_TIMEZONE=America/New_York
   */
  @Cron("0 9 * * 1", {
    name: "weekly-pricelist-notification",
    timeZone: process.env.CRON_TIMEZONE || "UTC",
  })
  async handleWeeklyPricelistNotification() {
    this.logger.log("Starting weekly pricelist notification cron job...");

    try {
      // Check if we already sent notification this week
      const today = new Date();
      const lastMonday = this.getLastMonday(today);
      
      if (this.lastNotificationDate && this.lastNotificationDate >= lastMonday) {
        this.logger.log(
          `Notification already sent this week (last sent: ${this.lastNotificationDate.toISOString()}). Skipping.`
        );
        return;
      }

      // Query for all submitted (pending) pricelists
      const pendingPricelists = await this.pricelistModel
        .find({
          status: PricelistStatus.SUBMITTED,
        })
        .populate("agentId", "firstName lastName email")
        .populate("supplierId", "name")
        .sort({ weekStart: -1, submittedAt: -1 })
        .lean()
        .exec();

      this.logger.log(`Found ${pendingPricelists.length} pending pricelists`);

      // If no pending pricelists, skip sending email
      if (pendingPricelists.length === 0) {
        this.logger.log("No pending pricelists found. Skipping email notification.");
        return;
      }

      // Get all active operators (ops_admin role)
      const operators = await this.userModel
        .find({
          roleCode: RoleCode.OPS_ADMIN,
          isActive: true,
        })
        .select("email firstName lastName")
        .lean()
        .exec();

      if (operators.length === 0) {
        this.logger.warn("No active operators found. Cannot send notifications.");
        return;
      }

      this.logger.log(`Found ${operators.length} active operators to notify`);

      // Group pricelists by supplier for better email content
      const pricelistsBySupplier = this.groupPricelistsBySupplier(pendingPricelists);

      // Send email to each operator
      const emailPromises = operators.map((operator) =>
        this.sendNotificationEmail(operator, pendingPricelists.length, pricelistsBySupplier)
      );

      await Promise.allSettled(emailPromises);

      // Update last notification date
      this.lastNotificationDate = new Date();

      this.logger.log(
        `Successfully sent notifications to ${operators.length} operators about ${pendingPricelists.length} pending pricelists`
      );
    } catch (error) {
      this.logger.error("Error in weekly pricelist notification cron job:", error);
      // Don't throw - allow cron to continue running
    }
  }

  /**
   * Get the last Monday date (start of current week)
   */
  private getLastMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  /**
   * Group pricelists by supplier for better email organization
   */
  private groupPricelistsBySupplier(pricelists: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    for (const pricelist of pricelists) {
      const supplierId = pricelist.supplierId?._id?.toString() || pricelist.supplierId?.toString() || "unknown";
      const supplierName = pricelist.supplierId?.name || "Unknown Supplier";

      if (!grouped.has(supplierId)) {
        grouped.set(supplierId, []);
      }

      grouped.get(supplierId)!.push({
        ...pricelist,
        supplierName,
      });
    }

    return grouped;
  }

  /**
   * Send notification email to an operator
   */
  private async sendNotificationEmail(
    operator: { email: string; firstName: string; lastName: string },
    totalPendingCount: number,
    pricelistsBySupplier: Map<string, any[]>,
  ): Promise<void> {
    try {
      const operatorName = `${operator.firstName} ${operator.lastName}`.trim() || "Operator";
      const frontendUrl = this.configService.get<string>("FRONTEND_URL") || "http://localhost:5173";
      const reviewUrl = `${frontendUrl}/pricing/suppliers`;

      // Build HTML content
      const supplierList = Array.from(pricelistsBySupplier.entries())
        .map(([supplierId, pricelists]) => {
          const supplierName = pricelists[0]?.supplierName || "Unknown Supplier";
          const count = pricelists.length;
          return `<li><strong>${supplierName}</strong>: ${count} pending pricelist${count > 1 ? "s" : ""}</li>`;
        })
        .join("");

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Pending Pricelist Review Required</h2>
          <p>Hello ${operatorName},</p>
          <p>This is a weekly reminder that there are <strong>${totalPendingCount} pending pricelist${totalPendingCount > 1 ? "s" : ""}</strong> awaiting your review and approval.</p>
          
          <div style="background-color: #f8f9fa; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2563eb;">Pending by Supplier:</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${supplierList}
            </ul>
          </div>

          <p>Please review and approve or reject these pricelists at your earliest convenience.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reviewUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Review Pricelists
            </a>
          </div>

          <p style="color: #666666; font-size: 14px; margin-top: 30px;">
            This is an automated weekly reminder. You will receive this email every Monday if there are pending pricelists.
          </p>
        </div>
      `;

      await this.mailService.sendEmail({
        to: operator.email,
        subject: `Weekly Reminder: ${totalPendingCount} Pending Pricelist${totalPendingCount > 1 ? "s" : ""} Awaiting Review`,
        html: htmlContent,
      });

      this.logger.log(`Sent notification email to ${operator.email}`);
    } catch (error) {
      this.logger.error(`Failed to send notification email to ${operator.email}:`, error);
      // Don't throw - continue with other operators
    }
  }

  /**
   * Manual trigger for testing purposes
   * Can be called via API endpoint if needed
   */
  async triggerNotificationManually(): Promise<{ success: boolean; message: string; operatorsNotified: number; pendingCount: number }> {
    this.logger.log("Manual trigger of pricelist notification");
    
    try {
      const pendingPricelists = await this.pricelistModel
        .find({
          status: PricelistStatus.SUBMITTED,
        })
        .populate("agentId", "firstName lastName email")
        .populate("supplierId", "name")
        .sort({ weekStart: -1, submittedAt: -1 })
        .lean()
        .exec();

      if (pendingPricelists.length === 0) {
        return {
          success: true,
          message: "No pending pricelists found",
          operatorsNotified: 0,
          pendingCount: 0,
        };
      }

      const operators = await this.userModel
        .find({
          roleCode: RoleCode.OPS_ADMIN,
          isActive: true,
        })
        .select("email firstName lastName")
        .lean()
        .exec();

      if (operators.length === 0) {
        return {
          success: false,
          message: "No active operators found",
          operatorsNotified: 0,
          pendingCount: pendingPricelists.length,
        };
      }

      const pricelistsBySupplier = this.groupPricelistsBySupplier(pendingPricelists);
      const emailPromises = operators.map((operator) =>
        this.sendNotificationEmail(operator, pendingPricelists.length, pricelistsBySupplier)
      );

      await Promise.allSettled(emailPromises);

      return {
        success: true,
        message: `Notifications sent to ${operators.length} operators`,
        operatorsNotified: operators.length,
        pendingCount: pendingPricelists.length,
      };
    } catch (error) {
      this.logger.error("Error in manual notification trigger:", error);
      throw error;
    }
  }
}
