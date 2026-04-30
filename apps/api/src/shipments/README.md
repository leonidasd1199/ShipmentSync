# Shipment Operations Module

Complete implementation of Shipment Operations with Document Generation and Financial T Ledger.

## Overview

This module provides:
- **Shipment CRUD** with workflow state management
- **Document Generation** with versioning and locking
- **Financial Ledger** (T-account) with approval workflow
- **Incoterm Requirements** for validation

## Module Structure

```
shipments/
├── dto/                          # Data Transfer Objects
│   ├── create-shipment.dto.ts
│   ├── update-shipment.dto.ts
│   ├── shipment-filters.dto.ts
│   ├── import-ledger-from-quotation.dto.ts
│   ├── create-ledger-line.dto.ts
│   ├── update-ledger-line.dto.ts
│   └── reject-ledger-line.dto.ts
├── services/                     # Business Logic
│   ├── shipment.service.ts
│   ├── shipment-document.service.ts
│   ├── shipment-ledger.service.ts
│   ├── incoterm-requirement.service.ts
│   └── storage.service.ts
├── helpers/                      # Utility Functions
│   ├── field-validator.helper.ts
│   └── seed.helper.ts
├── shipments.controller.ts       # Main API Controller
├── incoterm-requirements.controller.ts
└── shipments.module.ts           # NestJS Module
```

## API Endpoints

### Incoterm Requirements

- `GET /incotermRequirements?mode=OCEAN&incoterm=FOB` - Get requirement for mode/incoterm

### Shipments

**CRUD:**
- `POST /shipments` - Create shipment (status: DRAFT)
- `GET /shipments` - List shipments (with filters)
- `GET /shipments/:shipmentId` - Get shipment details
- `PATCH /shipments/:shipmentId` - Update shipment (only if DRAFT)

**Workflow Transitions:**
- `POST /shipments/:shipmentId/readyForFinance` - Transition to READY_FOR_FINANCE
- `POST /shipments/:shipmentId/financeReview` - Transition to FINANCE_REVIEW
- `POST /shipments/:shipmentId/approve` - Approve shipment
- `POST /shipments/:shipmentId/close` - Close shipment

### Documents

- `GET /shipments/:shipmentId/documents` - List documents + required documents
- `POST /shipments/:shipmentId/documents/:documentType/generate` - Generate document
- `GET /shipments/:shipmentId/documents/:documentType/download?version=N` - Download document

### Ledger Lines

- `POST /shipments/:shipmentId/ledger/importFromQuotation` - Import from quotation
- `GET /shipments/:shipmentId/ledgerLines?side=DEBIT&status=APPROVED` - List ledger lines
- `POST /shipments/:shipmentId/ledgerLines` - Create manual line
- `PATCH /shipments/:shipmentId/ledgerLines/:lineId` - Update line (only if DRAFT)
- `POST /shipments/:shipmentId/ledgerLines/:lineId/delete` - Delete line (only if DRAFT)
- `POST /shipments/:shipmentId/ledgerLines/:lineId/submit` - Submit for approval
- `POST /shipments/:shipmentId/ledgerLines/:lineId/approve` - Approve line
- `POST /shipments/:shipmentId/ledgerLines/:lineId/reject` - Reject line
- `GET /shipments/:shipmentId/profit` - Calculate profit from approved lines

## Workflow States

### Shipment Status Flow
```
DRAFT → READY_FOR_FINANCE → FINANCE_REVIEW → APPROVED → CLOSED
```

### Ledger Line Status Flow
```
DRAFT → SUBMITTED → APPROVED / REJECTED
```

### Document Status
```
GENERATED → LOCKED
         → FAILED
```

## Business Rules

1. **Shipment Updates**: Only allowed when status is DRAFT
2. **Document Generation**: Only allowed when shipment is DRAFT and document is not locked
3. **READY_FOR_FINANCE Transition**:
   - Validates all required fields from incoterm requirement
   - Validates all required documents exist and are GENERATED or LOCKED
   - Locks shipment and required documents
4. **Ledger Import**: Creates snapshot of quotation items as ledger lines with source tracking
5. **Profit Calculation**: Uses only APPROVED ledger lines

## Authorization

Permissions required:
- `shipment:create` - Create shipments
- `shipment:list` - List shipments
- `shipment:read` - View shipments, documents, ledger lines, and profit
- `shipment:update` - Update shipments, generate documents, and manage ledger
- `shipment:finance` - Finance review and ledger approvals
- `shipment:approve` - Approve and close shipments

## Storage

PDFs are stored using the `StorageService` abstraction:
- Default: Local filesystem (`/tmp/ship-sync-documents`)
- Can be swapped for S3 or other storage by implementing the interface
- Storage key format: `shipments/{shipmentId}/documents/{documentType}-v{version}.pdf`

## Testing

Run integration tests:
```bash
npm run test:e2e -- shipments.e2e-spec.ts
```

Test coverage includes:
1. Shipment CRUD operations
2. Incoterm requirements lookup
3. Document generation and versioning
4. READY_FOR_FINANCE transition validation
5. Ledger import from quotations
6. Profit calculation from approved lines

## Migration

Run migrations to create collections:
```bash
npm run mm:up
```

Migrations:
- `20260216120000-create-shipments-collection.js`
- `20260216120001-create-shipment-documents-collection.js`
- `20260216120002-create-shipment-ledger-lines-collection.js`
- `20260216120003-create-incoterm-requirements-collection.js`

## Usage Example

```typescript
// Create shipment
const shipment = await shipmentService.create(createDto, userId);

// Generate HBL document
const document = await documentService.generateDocument(
  shipment._id,
  DocumentType.HBL,
  userId,
);

// Import ledger from quotation
const ledgerLines = await ledgerService.importFromQuotation(
  shipment._id,
  { quotationId, itemIds: ["item-1", "item-2"] },
  userId,
);

// Submit and approve ledger line
await ledgerService.submit(lineId, userId);
await ledgerService.approve(lineId, userId);

// Calculate profit
const profit = await ledgerService.calculateProfit(shipment._id);
// profit = { debitTotal, creditTotal, profit, debits, credits }

// Transition to READY_FOR_FINANCE
await shipmentService.readyForFinance(shipment._id, userId);
```
