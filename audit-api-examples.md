# Audit API Usage Examples

## Quick Start

The payment audit system automatically tracks all payment and invoice operations. Here's how to access the audit data:

### 1. Authentication Required

All audit endpoints require authentication. Make sure you're logged in to the system.

### 2. Basic API Calls

```javascript
// Get recent audit activity (last 10 entries)
fetch('/api/supplier-payments/audit/recent?limit=10', {
  credentials: 'include'
})
.then(response => response.json())
.then(data => console.log('Recent activity:', data));

// Get audit trail for specific invoice
fetch('/api/supplier-payments/audit/invoice/123', {
  credentials: 'include'  
})
.then(response => response.json())
.then(data => console.log('Invoice audit trail:', data));

// Check for payment discrepancies
fetch('/api/supplier-payments/discrepancies', {
  credentials: 'include'
})
.then(response => response.json())
.then(data => console.log('Discrepancies:', data));
```

### 3. What Gets Tracked

Every time you:
- ✅ Create a payment → `payment_created` entry
- ✅ Update payment details → `payment_updated` entry  
- ✅ Delete a payment → `payment_deleted` entry
- ✅ Invoice status changes → `status_changed` entry

### 4. Audit Entry Structure

```json
{
  "id": 1,
  "entity_type": "payment",
  "entity_id": 123,
  "action": "created",
  "old_values": null,
  "new_values": {
    "invoice_id": 456,
    "amount": 100.00,
    "payment_method": "bank_transfer"
  },
  "user_id": 1,
  "user_name": "admin",
  "user_full_name": "Administrator",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "reason": "New payment created",
  "timestamp": "2025-06-24T07:19:24.123Z"
}
```

### 5. Practical Use Cases

#### Financial Audit Trail
```javascript
// Get complete history for an invoice
async function getInvoiceHistory(invoiceId) {
  const response = await fetch(`/api/supplier-payments/audit/invoice/${invoiceId}`, {
    credentials: 'include'
  });
  const auditTrail = await response.json();
  
  // Show who did what and when
  auditTrail.forEach(entry => {
    console.log(`${entry.user_name} ${entry.action} on ${entry.timestamp}`);
    if (entry.reason) console.log(`Reason: ${entry.reason}`);
  });
}
```

#### Data Quality Monitoring
```javascript
// Check for payment discrepancies
async function checkDataIntegrity() {
  const response = await fetch('/api/supplier-payments/discrepancies', {
    credentials: 'include'
  });
  const issues = await response.json();
  
  if (issues.length > 0) {
    console.warn(`Found ${issues.length} payment discrepancies!`);
    issues.forEach(issue => {
      console.log(`Invoice ${issue.invoice_number}: €${issue.discrepancy} difference`);
    });
  } else {
    console.log('All payment data is consistent ✅');
  }
}
```

#### Automatic Data Repair
```javascript
// Fix payment discrepancies automatically
async function repairPaymentData() {
  const response = await fetch('/api/supplier-payments/repair-data', {
    method: 'POST',
    credentials: 'include'
  });
  const result = await response.json();
  
  console.log(`Repaired ${result.repaired} invoice(s)`);
  if (result.errors.length > 0) {
    console.error('Errors during repair:', result.errors);
  }
}
```

### 6. React Integration

```jsx
import { useState, useEffect } from 'react';

function PaymentAuditTrail({ paymentId }) {
  const [auditData, setAuditData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAudit() {
      try {
        const response = await fetch(`/api/supplier-payments/audit/payment/${paymentId}`, {
          credentials: 'include'
        });
        const data = await response.json();
        setAuditData(data);
      } catch (error) {
        console.error('Failed to fetch audit data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAudit();
  }, [paymentId]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="audit-trail">
      <h3>Payment History</h3>
      {auditData.map(entry => (
        <div key={entry.id} className="audit-entry">
          <div>{entry.action} by {entry.user_name}</div>
          <div className="timestamp">{new Date(entry.timestamp).toLocaleString()}</div>
          <div className="reason">{entry.reason}</div>
        </div>
      ))}
    </div>
  );
}
```

### 7. Security Features

- 🔐 **Authentication Required**: All endpoints check user login
- 🕒 **Immutable Logs**: Audit entries cannot be modified
- 👤 **User Attribution**: Every change tracked to specific user
- 🌐 **IP Logging**: IP addresses logged for security
- 🛡️ **Database Protection**: Triggers prevent data corruption

### 8. Error Handling

```javascript
async function safeAuditCall(url) {
  try {
    const response = await fetch(url, { credentials: 'include' });
    
    if (!response.ok) {
      if (response.status === 401) {
        console.error('Not authenticated - please log in');
        // Redirect to login page
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Audit API error:', error.message);
    return null;
  }
}
```

## Next Steps

1. **Log in** to the system to access audit endpoints
2. **Test the APIs** using the browser's developer console
3. **Integrate** audit trails into your financial workflows
4. **Monitor** for discrepancies regularly
5. **Use** the repair endpoint to fix data issues

The audit system runs automatically - no setup required. Every payment operation is tracked with full user attribution and change history.