import { Module } from "@nestjs/common";
import { MailerModule } from "@nestjs-modules/mailer";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { HandlebarsAdapter } from "@nestjs-modules/mailer/dist/adapters/handlebars.adapter";
import { MailService } from "./mail.service";
import { join } from "path";

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const smtpUser = configService.get<string>("SMTP_USER");
        const smtpFromEmail =
          configService.get<string>("SMTP_FROM_EMAIL") ||
          smtpUser ||
          "noreply@shipsync.com";
        const smtpFromName = configService.get<string>("SMTP_FROM_NAME") || "ShipSync";

        const smtpPort = configService.get<number>("SMTP_PORT", 465);
        const smtpSecure = configService.get<boolean>(
          "SMTP_SECURE",
          smtpPort === 465,
        );

        return {
          transport: {
            host: configService.get<string>("SMTP_HOST", "smtp.gmail.com"),
            port: smtpPort,
            secure: smtpSecure, // true for 465 (SSL), false for 587 (STARTTLS)
            auth: {
              user: smtpUser,
              pass: configService.get<string>("SMTP_PASS"),
            },
            // Gmail configuration - use port 465 with secure: true for better compatibility
            // If using port 587, STARTTLS will be used automatically
            tls: {
              rejectUnauthorized: false, // Allow self-signed certificates in development
            },
          },
          defaults: {
            from: `"${smtpFromName}" <${smtpFromEmail}>`,
          },
          template: {
            dir: join(process.cwd(), "dist", "mail", "templates"),
            adapter: new HandlebarsAdapter(), // or new PugAdapter() or new EjsAdapter()
            options: {
              strict: false, // Disabled to prevent errors with undefined properties like 'type'
            },
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
