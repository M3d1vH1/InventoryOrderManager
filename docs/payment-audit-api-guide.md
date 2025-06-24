# Payment Audit Trail API Guide

## Overview
The payment system now includes comprehensive audit logging that tracks all payment and invoice operations with user attribution, timestamps, and detailed change history.

## API Endpoints

### 1. Get Audit Trail for Specific Entity
```
GET /api/supplier-payments/audit/{entityType}/{entityId}
```

**Parameters:**
- `entityType`: `invoice` or `payment`
- `entityId`: ID of the invoice or payment

**Example:**
```bash
# Get audit trail for invoice ID 123
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-app.com/api/supplier-payments/audit/invoice/123"

# Get audit trail for payment ID 456
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-app.com/api/supplier-payments/audit/payment/456"
```

**Response:**
```json
[
  {
    "id": 1,
    "entity_type": "invoice",
    "entity_id": 123,
    "action": "status_changed",
    "old_values": {
      "status": "pending",
      "paid_amount": "0.00"
    },
    "new_values": {
      "status": "partially_paid",
      "paid_amount": "50.00"
    },
    "user_id": 1,
    "user_name": "John Doe",
    "user_full_name": "John Doe",
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "reason": "Payment added",
    "timestamp": "2025-06-24T07:19:24.123Z"
  }
]
```

### 2. Get Recent Activity
```
GET /api/supplier-payments/audit/recent?limit=50
```

**Parameters:**
- `limit` (optional): Number of entries to return (default: 50)

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-app.com/api/supplier-payments/audit/recent?limit=100"
```

### 3. Get Payment Discrepancies
```
GET /api/supplier-payments/discrepancies
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-app.com/api/supplier-payments/discrepancies"
```

**Response:**
```json
[
  {
    "invoice_id": 123,
    "invoice_number": "INV-001",
    "invoice_amount": "100.00",
    "paid_amount": "90.00",
    "status": "partially_paid",
    "calculated_total_payments": "95.00",
    "payment_count": 2,
    "discrepancy": "5.00"
  }
]
```

### 4. Repair Data Inconsistencies
```
POST /api/supplier-payments/repair-data
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  "https://your-app.com/api/supplier-payments/repair-data"
```

**Response:**
```json
{
  "message": "Repaired 3 invoice(s)",
  "repaired": 3,
  "errors": []
}
```

## Automatic Audit Logging

The system automatically logs the following actions:

### Payment Operations
- **payment_created**: When a new payment is added
- **payment_updated**: When payment details are modified
- **payment_deleted**: When a payment is removed

### Invoice Operations
- **invoice_created**: When a new invoice is created
- **invoice_updated**: When invoice details are modified
- **status_changed**: When invoice status changes (pending → paid, etc.)

## What Gets Tracked

### User Information
- User ID and username
- Full name (when available)
- IP address
- User agent (browser/device info)

### Change Details
- **old_values**: Previous state before change
- **new_values**: New state after change
- **reason**: Why the change was made
- **timestamp**: Exact time of change

### Validation and Security
- Payment amount validation prevents overpayments
- Database triggers enforce limits at the database level
- All changes are logged before and after validation

## Frontend Integration Example

```javascript
// Get audit trail for an invoice
async function getInvoiceAuditTrail(invoiceId) {
  const response = await fetch(`/api/supplier-payments/audit/invoice/${invoiceId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

// Get recent payment activity
async function getRecentActivity(limit = 50) {
  const response = await fetch(`/api/supplier-payments/audit/recent?limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

// Check for payment discrepancies
async function checkDiscrepancies() {
  const response = await fetch('/api/supplier-payments/discrepancies', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}
```

## Use Cases

### 1. Financial Auditing
Track who made payments and when for compliance and accounting purposes.

### 2. Troubleshooting Payment Issues
See the complete history of changes to understand how an invoice reached its current state.

### 3. Data Quality Monitoring
Identify and fix discrepancies between recorded payments and calculated totals.

### 4. User Activity Monitoring
Track which users are making changes to critical financial data.

### 5. Compliance Reporting
Generate reports showing all financial transactions with full attribution.

## Security Features

### Database-Level Protection
- Triggers prevent overpayments even if validation is bypassed
- All operations are logged regardless of how they're performed

### Audit Trail Integrity
- Audit logs cannot be modified by normal users
- Timestamps are automatically generated by the database
- User information is captured from the session context

### Access Control
- Audit endpoints require authentication
- Only authorized users can view audit trails
- Sensitive operations are logged with user attribution

## Error Handling

The audit system is designed to be non-blocking:
- Audit failures don't prevent business operations
- Errors are logged but don't break payment processing
- Graceful degradation ensures system reliability