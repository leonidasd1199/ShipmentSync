# Pricelist Distribution to Clients - Flow & Implementation

## Overview

This feature allows operators to distribute approved pricelists to clients. Only approved pricelists can be sent, and all distributions are tracked for audit purposes.

## Flow Diagram

```
Operator selects approved pricelist
    ↓
Operator chooses distribution method:
  - Send to specific clients (clientIds array)
  - Send to all active clients (sendToAll = true)
    ↓
POST /pricing/send-to-clients
    ↓
Backend Validation:
  1. Validate pricelistId format
  2. Check pricelist exists
  3. Verify pricelist status = "approved" ✅
  4. If sendToAll = false:
     - Validate clientIds provided
     - Validate all clientIds format
     - Verify all clients exist and are active
  5. If sendToAll = true:
     - Get all active clients from database
    ↓
Create Distribution Record:
  - pricelistId
  - clientIds[] (all recipients)
  - sendToAll flag
  - sentBy (operator ID)
  - sentByEmail (operator email)
  - sentAt (timestamp)
  - totalClients count
    ↓
Return Success Response:
  - success: true
  - message
  - pricelistId
  - totalClients
  - clientIds[]
  - sentAt
  - distributionId (for audit)
```

## API Endpoint

### POST `/pricing/send-to-clients`

**Authentication**: Required (JWT token)
**Authorization**: Requires `shipping:update` permission (ops_admin role)
**Guards**: `JwtAuthGuard`, `PermissionGuard`, `NonAgentGuard`

**Request Body**:
```json
{
  "pricelistId": "507f1f77bcf86cd799439012",
  "clientIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439013"],
  "sendToAll": false
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Pricelist distributed to 2 clients",
  "pricelistId": "507f1f77bcf86cd799439012",
  "totalClients": 2,
  "clientIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439013"],
  "sentAt": "2026-01-27T10:30:00.000Z",
  "distributionId": "507f1f77bcf86cd799439014"
}
```

**Error Responses**:
- `400 Bad Request`: Pricelist not approved, invalid clientIds, or missing fields
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: User is an agent or lacks permission
- `404 Not Found`: Pricelist or clients not found

## Validation Rules

### Pricelist Validation
- ✅ Must exist in database
- ✅ Must have status = `"approved"`
- ❌ Cannot send if status is `draft`, `submitted`, `rejected`, or `superseded`

### Client Validation
- ✅ All clientIds must be valid MongoDB ObjectIds
- ✅ All clients must exist in database
- ✅ All clients must be active (`isActive: true`)
- ✅ If `sendToAll = false`, `clientIds` array is required and cannot be empty
- ✅ If `sendToAll = true`, `clientIds` is ignored

## Database Schema

### PricelistDistribution Collection

```typescript
{
  pricelistId: ObjectId,      // Reference to AgentPricelist
  clientIds: [ObjectId],      // Array of Client IDs
  sendToAll: Boolean,          // Whether sent to all clients
  sentBy: ObjectId,            // Operator User ID
  sentByEmail: String,         // Operator email (for audit)
  sentAt: Date,               // Distribution timestamp
  totalClients: Number,        // Total number of recipients
  createdAt: Date,            // Auto-generated
  updatedAt: Date             // Auto-generated
}
```

**Indexes**:
- `{ pricelistId: 1, sentAt: -1 }` - Query distributions by pricelist
- `{ clientIds: 1 }` - Query distributions by client
- `{ sentBy: 1 }` - Query distributions by operator
- `{ sentAt: -1 }` - Query recent distributions

## Files Created/Modified

### New Files

1. **`/apps/api/src/schemas/pricelist-distribution.schema.ts`**
   - Mongoose schema for tracking distributions
   - Includes audit fields (sentBy, sentByEmail, sentAt)

2. **`/apps/api/src/pricing/dto/send-to-clients.dto.ts`**
   - DTO for request validation
   - Validates pricelistId, clientIds, sendToAll

3. **`/apps/api/test/pricelist-distribution.e2e-spec.ts`**
   - Comprehensive E2E test suite
   - Tests all validation scenarios

### Modified Files

1. **`/apps/api/src/pricing/operator-pricing.service.ts`**
   - Added `sendPricelistToClients()` method
   - Handles validation and distribution logic

2. **`/apps/api/src/pricing/operator-pricing.controller.ts`**
   - Added `POST /pricing/send-to-clients` endpoint
   - Protected with guards and permissions

3. **`/apps/api/src/pricing/pricing.module.ts`**
   - Added `PricelistDistribution` schema
   - Added `Client` schema (for querying clients)

## Testing

### Run E2E Tests

```bash
cd apps/api
MONGODB_URI=mongodb://localhost:27017/shipsync npm run test:e2e -- pricelist-distribution.e2e-spec.ts
```

### Manual Testing with cURL

```bash
# 1. Login as operator
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john.doe@shipsync.com","password":"password123"}' \
  | jq -r '.access_token')

# 2. Send to specific clients
curl -X POST http://localhost:3000/pricing/send-to-clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pricelistId": "YOUR_APPROVED_PRICELIST_ID",
    "clientIds": ["CLIENT_ID_1", "CLIENT_ID_2"],
    "sendToAll": false
  }' | jq .

# 3. Send to all clients
curl -X POST http://localhost:3000/pricing/send-to-clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pricelistId": "YOUR_APPROVED_PRICELIST_ID",
    "clientIds": [],
    "sendToAll": true
  }' | jq .
```

### Test Scenarios Covered

1. ✅ Send to specific clients (success)
2. ✅ Send to all clients (success)
3. ✅ Validation: Unapproved pricelist (400 error)
4. ✅ Validation: Empty clientIds when sendToAll=false (400 error)
5. ✅ Validation: Invalid pricelistId format (400 error)
6. ✅ Validation: Pricelist not found (404 error)
7. ✅ Validation: Client not found (404 error)
8. ✅ Authentication: Unauthorized without token (401 error)
9. ✅ Audit trail: Distribution record created correctly

## Acceptance Criteria

- ✅ Operator can send approved prices to all or selected clients
- ✅ Backend validates approval status
- ✅ Distribution is properly stored for audit
- ✅ Only approved pricelists can be sent
- ✅ Operator controls which clients receive prices
- ✅ Distribution is explicit (not automatic)

## Future Enhancements (Optional)

1. **Email Notifications**: Send email to clients when pricelist is distributed
2. **Distribution History**: GET endpoint to view distribution history
3. **Resend Capability**: Allow resending to same clients
4. **Client Filtering**: Filter clients by office, company, tags
5. **Bulk Distribution**: Send multiple pricelists at once
