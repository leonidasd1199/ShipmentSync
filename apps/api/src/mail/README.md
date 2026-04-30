# Mail Service

This module provides email functionality using NestJS Mailer with Nodemailer and Handlebars templates.

## Configuration

Add the following environment variables to your `.env` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=ShipSync
SMTP_FROM_EMAIL=noreply@shipsync.com

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:5173
```

### Gmail Setup

If using Gmail, you'll need to:
1. Enable 2-Factor Authentication
2. Generate an App Password (not your regular password)
3. Use the App Password in `SMTP_PASS`

## Usage

### Inject the MailService

```typescript
import { Injectable } from '@nestjs/common';
import { MailService } from './mail/mail.service';

@Injectable()
export class YourService {
  constructor(private readonly mailService: MailService) {}

  async sendEmail() {
    // Your code here
  }
}
```

### Available Methods

#### 1. Send Welcome Email

```typescript
await this.mailService.sendWelcomeEmail(
  'user@example.com',
  'John',
  'TempPassword123!' // Optional temporary password
);
```

#### 2. Send Notification Email

```typescript
await this.mailService.sendNotificationEmail(
  'user@example.com',
  'Important Update',
  '<p>Your account has been updated.</p>'
);
```

#### 3. Send Custom Email with Template

```typescript
await this.mailService.sendEmail({
  to: 'user@example.com',
  subject: 'Custom Subject',
  template: 'welcome', // Template file name without .hbs
  context: {
    firstName: 'John',
    customData: 'value'
  }
});
```

#### 4. Send Custom Email with HTML

```typescript
await this.mailService.sendEmail({
  to: 'user@example.com',
  subject: 'Custom Subject',
  html: '<h1>Hello</h1><p>This is a custom HTML email.</p>'
});
```

#### 5. Send Plain Text Email

```typescript
await this.mailService.sendEmail({
  to: 'user@example.com',
  subject: 'Plain Text Email',
  text: 'This is a plain text email.'
});
```

## Available Templates

### 1. `welcome.hbs`
Welcome email for new users.

**Context variables:**
- `firstName` - User's first name
- `temporaryPassword` - Optional temporary password
- `hasTemporaryPassword` - Boolean indicating if temporary password exists

### 2. `notification.hbs`
General notification email.

**Context variables:**
- `message` - HTML message content

## Creating New Templates

1. Create a new `.hbs` file in `src/mail/templates/`
2. Use Handlebars syntax for templating
3. Reference it in `sendEmail()` by the filename (without extension)

Example:
```typescript
// Create src/mail/templates/invitation.hbs
await this.mailService.sendEmail({
  to: 'user@example.com',
  subject: 'You\'re Invited!',
  template: 'invitation',
  context: {
    inviteUrl: 'https://example.com/accept',
    inviterName: 'John Doe'
  }
});
```

## Error Handling

The service will throw errors if email sending fails. Always wrap in try-catch:

```typescript
try {
  await this.mailService.sendWelcomeEmail('user@example.com', 'John');
} catch (error) {
  console.error('Failed to send email:', error);
  // Handle error appropriately
}
```

