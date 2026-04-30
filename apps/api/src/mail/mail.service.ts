import { Injectable, Logger } from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  context?: Record<string, any>;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Send an email using a template
   * @param options Email options including recipient, subject, template, and context
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    const { to, subject, template, context, text, html, attachments } = options;

    try {
      const mailOptions: any = {
        to,
        subject,
      };

      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType || "application/pdf",
        }));
      }

      if (template) {
        // Send email using a template
        mailOptions.template = template; // Template file name without extension
        mailOptions.context = context; // Data to pass to the template
      } else if (html) {
        // Send email with HTML content
        mailOptions.html = html;
      } else if (text) {
        // Send plain text email
        mailOptions.text = text;
      } else {
        throw new Error("Either template, html, or text must be provided");
      }

      await this.mailerService.sendMail(mailOptions);
    } catch (error) {
      this.logger.error(
        "Error sending email",
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Send a welcome email to a new user
   * @param email User's email address
   * @param firstName User's first name
   * @param temporaryPassword Temporary password (if applicable)
   */
  async sendWelcomeEmail(
    email: string,
    firstName: string,
    temporaryPassword?: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: "Welcome to ShipSync",
      template: "welcome",
      context: {
        firstName,
        temporaryPassword,
        hasTemporaryPassword: !!temporaryPassword,
      },
    });
  }

  /**
   * Send a simple notification email
   * @param email Recipient's email address
   * @param subject Email subject
   * @param message Message content
   */
  async sendNotificationEmail(
    email: string,
    subject: string,
    message: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject,
      template: "notification",
      context: {
        message,
      },
    });
  }

  /**
   * Send quotation email to client
   * @param email Client's email address
   * @param quotationData Quotation data including items, total, etc.
   */
  async sendQuotationEmail(
    email: string,
    quotationData: {
      quotationId: string;
      clientName: string;
      quotationDate: string;
      items: Array<{
        description: string;
        price: number;
        originalPrice?: number;
        quantity?: number;
        discount?: number;
        notes?: string;
        transitType?: string;
      }>;
      total?: number;
      showTotal: boolean;
      validUntil: string;
      notes?: string;
      companyName: string;
      companyEmail?: string;
      companyPhone?: string;
      companyAddress?: string;
      companyTaxId?: string;
    },
  ): Promise<void> {
    // Format prices with 2 decimal places
    const formatPrice = (price: number) => {
      return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // Format items with formatted prices
    // Explicitly exclude 'type' field to prevent Handlebars strict mode errors
    // Use JSON parse/stringify to create completely clean objects without any unwanted properties
    const formattedItems = quotationData.items.map((item) => {
      // Extract only the properties we need, explicitly excluding 'type'
      const {
        type: _type, // Extract and discard 'type' if it exists
        ...rest
      } = item as any;
      
      // Build clean object with only allowed properties
      const cleanItem: {
        description: string;
        price: number;
        originalPrice?: number;
        quantity?: number;
        discount?: number;
        notes?: string;
        transitType?: string;
        formattedPrice: string;
        formattedOriginalPrice?: string;
      } = {
        description: item.description,
        price: item.price,
        formattedPrice: formatPrice(item.price),
      };
      
      if (item.originalPrice !== undefined) {
        cleanItem.originalPrice = item.originalPrice;
        cleanItem.formattedOriginalPrice = formatPrice(item.originalPrice);
      }
      if (item.quantity !== undefined) {
        cleanItem.quantity = item.quantity;
      }
      if (item.discount !== undefined) {
        cleanItem.discount = item.discount;
      }
      if (item.notes !== undefined) {
        cleanItem.notes = item.notes;
      }
      if (item.transitType !== undefined) {
        cleanItem.transitType = item.transitType;
      }
      
      // Use JSON parse/stringify to ensure no hidden properties or getters
      const finalItem = JSON.parse(JSON.stringify(cleanItem));
      
      // Verify 'type' is not in the final object
      if ('type' in finalItem) {
        this.logger.error("'type' property still exists in formatted item after cleanup", finalItem);
        delete (finalItem as any).type;
      }
      
      return finalItem;
    });

    // Final verification - check if any item has 'type' property
    const itemsWithType = formattedItems.filter((item: any) => 'type' in item);
    if (itemsWithType.length > 0) {
      this.logger.error("Found items with 'type' property after cleanup", itemsWithType);
      // Remove 'type' from all items as a safety measure
      formattedItems.forEach((item: any) => {
        if ('type' in item) {
          delete item.type;
        }
      });
    }

    await this.sendEmail({
      to: email,
      subject: `Estimate from ${quotationData.companyName}`,
      template: "quotation",
      context: {
        ...quotationData,
        items: formattedItems,
        formattedTotal: quotationData.total ? formatPrice(quotationData.total) : undefined,
      },
    });
  }
}
