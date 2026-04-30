# Pricelist Notification Cron Job

## Overview

This cron job automatically sends weekly email notifications to operators about pending pricelists that need review and approval.

## Schedule

- **Frequency**: Every Monday at 9:00 AM
- **Timezone**: Configurable via `CRON_TIMEZONE` environment variable (defaults to UTC)
- **Example**: `CRON_TIMEZONE=America/New_York`

## Manual Testing

### Option 1: API Endpoint (Recommended)

You can manually trigger the cron job via the API endpoint:

```bash
# 1. Login as operator to get JWT token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john.doe@shipsync.com","password":"password123"}' \
  | jq -r '.access_token' > token.txt

# 2. Trigger the cron job manually
curl -X GET http://localhost:3000/cron/pricelist-notification/trigger \
  -H "Authorization: Bearer $(cat token.txt)" \
  | jq .
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Notifications sent to 1 operators",
  "operatorsNotified": 1,
  "pendingCount": 2
}
```

### Option 2: E2E Test Suite

Run the E2E test suite:

```bash
cd apps/api
MONGODB_URI=mongodb://localhost:27017/shipsync npm run test:e2e -- pricelist-notification-cron.e2e-spec.ts
```

The test will:
1. Create test data (operator, agent, supplier, submitted pricelists)
2. Trigger the cron job manually
3. Verify the response
4. Clean up test data

### Option 3: Using Postman/Insomnia

1. **Login**:
   - Method: `POST`
   - URL: `http://localhost:3000/auth/login`
   - Body:
     ```json
     {
       "email": "john.doe@shipsync.com",
       "password": "password123"
     }
     ```
   - Copy the `access_token` from response

2. **Trigger Cron Job**:
   - Method: `GET`
   - URL: `http://localhost:3000/cron/pricelist-notification/trigger`
   - Headers:
     ```
     Authorization: Bearer <your-access-token>
     ```

## Email Content Preview

The email sent to operators includes:

- **Subject**: "Weekly Reminder: X Pending Pricelist(s) Awaiting Review"
- **Content**:
  - Personalized greeting
  - Total count of pending pricelists
  - Breakdown by supplier
  - Direct link to review page
  - Professional HTML formatting

## Prerequisites for Testing

1. **SMTP Configuration**: Ensure SMTP is configured in `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM_EMAIL=noreply@shipsync.com
   FRONTEND_URL=http://localhost:5173
   ```

2. **Test Data**: 
   - At least one operator user with `ops_admin` role (john.doe@shipsync.com)
   - At least one pricelist with `status = "submitted"`

3. **Create Test Pricelist** (if needed):
   ```bash
   # Use the agent pricing API to create and submit a pricelist
   # Or use the E2E test which creates test data automatically
   ```

## Checking Email Content

### Option 1: Check SMTP Logs
If using a development SMTP service (like Mailtrap or Mailhog), check their dashboard.

### Option 2: Use Mailtrap (Recommended for Development)
1. Sign up at https://mailtrap.io
2. Configure SMTP settings in `.env`:
   ```env
   SMTP_HOST=smtp.mailtrap.io
   SMTP_PORT=2525
   SMTP_USER=your-mailtrap-username
   SMTP_PASS=your-mailtrap-password
   ```
3. Trigger the cron job
4. Check Mailtrap inbox for the email

### Option 3: Use Gmail with App Password
1. Enable 2FA on Gmail
2. Generate App Password
3. Use it in `SMTP_PASS`
4. Check your Gmail inbox

## Troubleshooting

### No emails sent?
- Check SMTP configuration in `.env`
- Verify operator email addresses are valid
- Check application logs for errors
- Ensure there are submitted pricelists in database

### Duplicate notifications?
- The cron job tracks `lastNotificationDate` to prevent duplicates
- Manual triggers bypass this check (by design for testing)

### Permission denied?
- Ensure user has `ops_admin` role
- Check JWT token is valid
- Verify `permissions:assign` permission exists (required by endpoint)

## Files

- **Service**: `pricelist-notification.cron.service.ts` - Main cron logic
- **Controller**: `cron.controller.ts` - Manual trigger endpoint
- **Module**: `cron.module.ts` - Module configuration
- **Test**: `test/pricelist-notification-cron.e2e-spec.ts` - E2E test suite
