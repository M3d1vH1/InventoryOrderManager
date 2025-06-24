/**
 * Demonstration: How to Use the Audit API
 * Shows practical examples of using the payment audit system
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

// Example: Using the audit API from frontend JavaScript
class PaymentAuditClient {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    // In real usage, you'd get this from your auth system
    this.authHeaders = {
      'Content-Type': 'application/json',
      // Session cookie would be handled automatically by the browser
    };
  }

  // Get audit trail for a specific invoice
  async getInvoiceAuditTrail(invoiceId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/supplier-payments/audit/invoice/${invoiceId}`,
        { headers: this.authHeaders, withCredentials: true }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching invoice audit trail:', error.message);
      return [];
    }
  }

  // Get audit trail for a specific payment
  async getPaymentAuditTrail(paymentId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/supplier-payments/audit/payment/${paymentId}`,
        { headers: this.authHeaders, withCredentials: true }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching payment audit trail:', error.message);
      return [];
    }
  }

  // Get recent audit activity
  async getRecentActivity(limit = 50) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/supplier-payments/audit/recent?limit=${limit}`,
        { headers: this.authHeaders, withCredentials: true }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching recent activity:', error.message);
      return [];
    }
  }

  // Check for payment discrepancies
  async getPaymentDiscrepancies() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/supplier-payments/discrepancies`,
        { headers: this.authHeaders, withCredentials: true }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching discrepancies:', error.message);
      return [];
    }
  }

  // Repair data inconsistencies
  async repairDataInconsistencies() {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/supplier-payments/repair-data`,
        {},
        { headers: this.authHeaders, withCredentials: true }
      );
      return response.data;
    } catch (error) {
      console.error('Error repairing data:', error.message);
      return { repaired: 0, errors: [error.message] };
    }
  }

  // Format audit entry for display
  formatAuditEntry(entry) {
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const user = entry.user_name || entry.user_full_name || 'System';
    
    return {
      id: entry.id,
      summary: `${entry.action} ${entry.entity_type} ${entry.entity_id}`,
      user: user,
      timestamp: timestamp,
      changes: this.formatChanges(entry.old_values, entry.new_values),
      reason: entry.reason,
      ipAddress: entry.ip_address
    };
  }

  // Format changes for display
  formatChanges(oldValues, newValues) {
    if (!oldValues && !newValues) return 'No changes recorded';
    
    const changes = [];
    
    if (oldValues && newValues) {
      Object.keys(newValues).forEach(key => {
        if (oldValues[key] !== newValues[key]) {
          changes.push(`${key}: ${oldValues[key]} → ${newValues[key]}`);
        }
      });
    } else if (newValues) {
      changes.push(`Created: ${JSON.stringify(newValues)}`);
    }
    
    return changes.join(', ') || 'No changes detected';
  }
}

// Demo usage scenarios
async function demonstrateAuditAPI() {
  console.log('🔍 Payment Audit API Demonstration\n');
  
  const auditClient = new PaymentAuditClient();

  // Scenario 1: Check recent activity
  console.log('📋 Recent Activity:');
  try {
    const recentActivity = await auditClient.getRecentActivity(10);
    if (recentActivity.length > 0) {
      recentActivity.forEach((entry, index) => {
        const formatted = auditClient.formatAuditEntry(entry);
        console.log(`${index + 1}. ${formatted.summary}`);
        console.log(`   By: ${formatted.user} at ${formatted.timestamp}`);
        console.log(`   Changes: ${formatted.changes}`);
        console.log('');
      });
    } else {
      console.log('No recent audit activity found');
    }
  } catch (error) {
    console.log('Could not fetch recent activity (authentication required)');
  }

  // Scenario 2: Check for discrepancies
  console.log('\n💰 Payment Discrepancies:');
  try {
    const discrepancies = await auditClient.getPaymentDiscrepancies();
    if (discrepancies.length > 0) {
      discrepancies.forEach((disc, index) => {
        console.log(`${index + 1}. Invoice ${disc.invoice_number}:`);
        console.log(`   Amount: €${disc.invoice_amount} | Paid: €${disc.paid_amount}`);
        console.log(`   Calculated: €${disc.calculated_total_payments} | Discrepancy: €${disc.discrepancy}`);
        console.log(`   Status: ${disc.status} | Payments: ${disc.payment_count}`);
        console.log('');
      });
    } else {
      console.log('No payment discrepancies found - data integrity is good!');
    }
  } catch (error) {
    console.log('Could not check discrepancies (authentication required)');
  }

  // Scenario 3: Usage examples for specific entities
  console.log('\n📄 Usage Examples:');
  console.log('// Get audit trail for invoice ID 123');
  console.log('const invoiceAudit = await auditClient.getInvoiceAuditTrail(123);');
  console.log('');
  console.log('// Get audit trail for payment ID 456');
  console.log('const paymentAudit = await auditClient.getPaymentAuditTrail(456);');
  console.log('');
  console.log('// Check for data issues and repair them');
  console.log('const result = await auditClient.repairDataInconsistencies();');
  console.log('console.log(`Repaired ${result.repaired} issues`);');

  return auditClient;
}

// Frontend React component example
const auditComponentExample = `
// React component for displaying audit trail
import React, { useState, useEffect } from 'react';

function InvoiceAuditTrail({ invoiceId }) {
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAuditTrail() {
      try {
        const response = await fetch(\`/api/supplier-payments/audit/invoice/\${invoiceId}\`, {
          credentials: 'include' // Include session cookies
        });
        const data = await response.json();
        setAuditTrail(data);
      } catch (error) {
        console.error('Failed to fetch audit trail:', error);
      } finally {
        setLoading(false);
      }
    }

    if (invoiceId) {
      fetchAuditTrail();
    }
  }, [invoiceId]);

  if (loading) return <div>Loading audit trail...</div>;

  return (
    <div className="audit-trail">
      <h3>Audit Trail for Invoice {invoiceId}</h3>
      {auditTrail.length === 0 ? (
        <p>No audit entries found</p>
      ) : (
        <ul>
          {auditTrail.map(entry => (
            <li key={entry.id} className="audit-entry">
              <div className="audit-header">
                <strong>{entry.action}</strong> by {entry.user_name}
                <span className="timestamp">{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
              {entry.reason && <div className="reason">Reason: {entry.reason}</div>}
              {entry.old_values && (
                <div className="changes">
                  <strong>Before:</strong> {JSON.stringify(entry.old_values)}
                </div>
              )}
              {entry.new_values && (
                <div className="changes">
                  <strong>After:</strong> {JSON.stringify(entry.new_values)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
`;

console.log('\n📝 React Component Example:');
console.log(auditComponentExample);

// Run the demonstration
demonstrateAuditAPI().then(auditClient => {
  console.log('\n✅ Audit API demonstration complete!');
  console.log('\n🔐 Authentication Notes:');
  console.log('- All audit endpoints require user authentication');
  console.log('- Use session cookies or proper authorization headers');
  console.log('- Frontend requests should include credentials: "include"');
  console.log('- API calls will return 401 Unauthorized without proper auth');
}).catch(error => {
  console.error('Demonstration failed:', error.message);
});

export { PaymentAuditClient };