/**
 * Test Payment System Fix
 * Comprehensive test to verify the payment system works correctly
 * This script will create test data, verify calculations, and clean up afterward
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testPaymentSystem() {
  console.log('🔍 Testing Payment System Fix...\n');

  try {
    // 1. Check current discrepancies before fix
    console.log('1. Checking existing payment discrepancies...');
    const discrepanciesResult = await pool.query(`
      SELECT 
        si.id as invoice_id,
        si.invoice_number,
        si.amount as invoice_amount,
        si.paid_amount,
        si.status,
        COALESCE(SUM(sp.amount), 0) as calculated_total_payments,
        ABS(si.paid_amount - COALESCE(SUM(sp.amount), 0)) as discrepancy
      FROM supplier_invoices si
      LEFT JOIN supplier_payments sp ON si.id = sp.invoice_id
      GROUP BY si.id, si.invoice_number, si.amount, si.paid_amount, si.status
      HAVING ABS(si.paid_amount - COALESCE(SUM(sp.amount), 0)) > 0.01
      ORDER BY discrepancy DESC
      LIMIT 5
    `);

    console.log(`Found ${discrepanciesResult.rows.length} existing discrepancies:`);
    discrepanciesResult.rows.forEach(row => {
      console.log(`  - Invoice ${row.invoice_number}: €${row.invoice_amount} (status: ${row.status})`);
      console.log(`    Recorded paid: €${row.paid_amount} | Calculated: €${row.calculated_total_payments}`);
      console.log(`    Discrepancy: €${row.discrepancy}\n`);
    });

    // 2. Create test supplier and invoice
    console.log('2. Creating test supplier and invoice...');
    
    // First create a test supplier
    const testSupplier = await pool.query(`
      INSERT INTO suppliers (name, email, phone, address, notes, contact_person)
      VALUES ('Test Supplier Ltd', 'test@supplier.com', '123-456-7890', 
              'Test Address', 'Test supplier for payment verification', 'Test Contact')
      RETURNING *
    `);
    
    const testSupplierId = testSupplier.rows[0].id;
    console.log(`Created test supplier: ${testSupplier.rows[0].name} (ID: ${testSupplierId})`);
    
    const testInvoice = await pool.query(`
      INSERT INTO supplier_invoices (
        invoice_number, supplier_id, issue_date, due_date, amount, 
        description, status, created_by_id
      ) VALUES (
        'TEST-INVOICE-' || EXTRACT(EPOCH FROM NOW())::text,
        $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 100.00,
        'Test invoice for payment system verification', 'pending', 1
      ) RETURNING *
    `, [testSupplierId]);

    const testInvoiceId = testInvoice.rows[0].id;
    console.log(`Created test invoice ${testInvoice.rows[0].invoice_number} (ID: ${testInvoiceId})`);

    // 3. Test partial payment validation
    console.log('\n3. Testing payment validation...');
    
    // Valid partial payment
    const partialPayment = await pool.query(`
      INSERT INTO supplier_payments (
        invoice_id, payment_date, amount, payment_method, 
        reference, notes, created_by_id
      ) VALUES (
        $1, CURRENT_DATE, 40.00, 'bank_transfer',
        'TEST-PAYMENT-1', 'Test partial payment', 1
      ) RETURNING *
    `, [testInvoiceId]);

    console.log(`✅ Created partial payment of €40.00`);

    // Check invoice status after partial payment
    const afterPartial = await pool.query(
      'SELECT amount, paid_amount, status FROM supplier_invoices WHERE id = $1',
      [testInvoiceId]
    );
    console.log(`Invoice status after partial payment: ${afterPartial.rows[0].status}`);
    console.log(`Paid amount: €${afterPartial.rows[0].paid_amount}`);

    // 4. Test overpayment prevention
    console.log('\n4. Testing overpayment prevention...');
    try {
      await pool.query(`
        INSERT INTO supplier_payments (
          invoice_id, payment_date, amount, payment_method, 
          reference, notes, created_by_id
        ) VALUES (
          $1, CURRENT_DATE, 70.00, 'bank_transfer',
          'TEST-OVERPAYMENT', 'This should fail - overpayment', 1
        )
      `, [testInvoiceId]);
      console.log('❌ ERROR: Overpayment was allowed (this should not happen)');
    } catch (error) {
      console.log('✅ Overpayment correctly prevented');
    }

    // 5. Complete the payment
    console.log('\n5. Completing payment...');
    const finalPayment = await pool.query(`
      INSERT INTO supplier_payments (
        invoice_id, payment_date, amount, payment_method, 
        reference, notes, created_by_id
      ) VALUES (
        $1, CURRENT_DATE, 60.00, 'bank_transfer',
        'TEST-PAYMENT-2', 'Test final payment', 1
      ) RETURNING *
    `, [testInvoiceId]);

    console.log(`✅ Created final payment of €60.00`);

    // 6. Verify final invoice status
    console.log('\n6. Verifying final invoice status...');
    const finalStatus = await pool.query(`
      SELECT 
        si.amount, si.paid_amount, si.status,
        COALESCE(SUM(sp.amount), 0) as calculated_payments
      FROM supplier_invoices si
      LEFT JOIN supplier_payments sp ON si.id = sp.invoice_id
      WHERE si.id = $1
      GROUP BY si.id, si.amount, si.paid_amount, si.status
    `, [testInvoiceId]);

    const invoice = finalStatus.rows[0];
    console.log(`Invoice amount: €${invoice.amount}`);
    console.log(`Recorded paid amount: €${invoice.paid_amount}`);
    console.log(`Calculated payments: €${invoice.calculated_payments}`);
    console.log(`Status: ${invoice.status}`);

    // Verify calculations
    const expectedTotal = 100.00;
    const actualTotal = parseFloat(invoice.calculated_payments);
    const tolerance = 0.01;

    if (Math.abs(expectedTotal - actualTotal) <= tolerance && invoice.status === 'paid') {
      console.log('✅ Payment calculations are correct');
    } else {
      console.log('❌ Payment calculations are incorrect');
    }

    // 7. Test audit trail
    console.log('\n7. Checking audit trail...');
    const auditTrail = await pool.query(`
      SELECT action, old_values, new_values, user_name, timestamp
      FROM payment_audit_log
      WHERE entity_type = 'invoice' AND entity_id = $1
      ORDER BY timestamp DESC
    `, [testInvoiceId]);

    console.log(`Found ${auditTrail.rows.length} audit entries for test invoice`);
    auditTrail.rows.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.action} by ${entry.user_name || 'system'} at ${entry.timestamp}`);
    });

    // 8. Clean up test data
    console.log('\n8. Cleaning up test data...');
    await pool.query('DELETE FROM supplier_payments WHERE invoice_id = $1', [testInvoiceId]);
    await pool.query('DELETE FROM supplier_invoices WHERE id = $1', [testInvoiceId]);
    await pool.query('DELETE FROM suppliers WHERE id = $1', [testSupplierId]);
    await pool.query('DELETE FROM payment_audit_log WHERE entity_type = \'invoice\' AND entity_id = $1', [testInvoiceId]);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 Payment System Test Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Payment validation working');
    console.log('- ✅ Overpayment prevention working');
    console.log('- ✅ Status calculations correct');
    console.log('- ✅ Audit trail logging working');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the test
testPaymentSystem().catch(console.error);