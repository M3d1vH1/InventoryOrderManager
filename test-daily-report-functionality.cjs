/**
 * Test Daily Report with Real Database Data
 * This uses the actual database to generate a real daily report
 */

const { PostgresJsDatabase } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq, and, gte, lt, isNull, isNotNull } = require('drizzle-orm');
const { orders, customers } = require('./shared/schema.ts');

async function testRealDailyReport() {
  console.log('📊 TESTING DAILY REPORT WITH REAL DATABASE DATA');
  console.log('='.repeat(70));

  try {
    // Connect to the database
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL not found');
    }

    const sql = postgres(connectionString, { ssl: 'require' });
    const db = new PostgresJsDatabase(sql);

    // Get today's date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log(`Getting orders for date: ${today.toISOString().split('T')[0]}`);

    // Query real orders from database
    const allOrders = await db.select({
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      status: orders.status,
      orderDate: orders.orderDate,
      pickedAt: orders.pickedAt,
      shippedAt: orders.shippedAt
    }).from(orders).leftJoin(customers, eq(orders.customerName, customers.name));

    console.log(`Found ${allOrders.length} total orders in database`);

    // Filter orders by today's activity
    const newOrders = allOrders.filter(order => {
      if (!order.orderDate) return false;
      const orderDate = new Date(order.orderDate);
      return orderDate >= today && orderDate < tomorrow;
    });

    const pickedOrders = allOrders.filter(order => {
      if (!order.pickedAt) return false;
      const pickedDate = new Date(order.pickedAt);
      return pickedDate >= today && pickedDate < tomorrow;
    });

    const shippedOrders = allOrders.filter(order => {
      if (!order.shippedAt) return false;
      const shippedDate = new Date(order.shippedAt);
      return shippedDate >= today && shippedDate < tomorrow;
    });

    const outstandingOrders = allOrders.filter(order => 
      order.status === 'pending'
    );

    // Format order lists with real data
    const formatOrderList = (orderList, limit = 5) => {
      if (orderList.length === 0) return 'None';
      
      if (orderList.length <= limit) {
        return orderList.map(o => `ORD-${o.orderNumber} (${o.customerName || 'Unknown Customer'})`).join(', ');
      } else {
        const shown = orderList.slice(0, limit);
        const remaining = orderList.length - limit;
        return shown.map(o => `ORD-${o.orderNumber} (${o.customerName || 'Unknown Customer'})`).join(', ') + ` ... +${remaining} more`;
      }
    };

    // Generate real daily report
    const reportDate = today.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const realReport = `📊 Daily Operations Report - ${reportDate}

📦 NEW ORDERS (${newOrders.length} total)
${formatOrderList(newOrders)}

✅ PICKED TODAY (${pickedOrders.length} total)
${formatOrderList(pickedOrders)}

🚚 SHIPPED TODAY (${shippedOrders.length} total)
${formatOrderList(shippedOrders)}

⏳ OUTSTANDING ORDERS (${outstandingOrders.length} total)
${formatOrderList(outstandingOrders)}

📋 Full details: https://amphoreus.replit.app/orders
Generated at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

    console.log('\n📊 REAL DAILY REPORT FROM YOUR DATABASE:');
    console.log('='.repeat(70));
    console.log(realReport);

    console.log('\n📈 REAL DATA BREAKDOWN:');
    console.log(`• Total orders in system: ${allOrders.length}`);
    console.log(`• New orders today: ${newOrders.length}`);
    console.log(`• Picked today: ${pickedOrders.length}`);
    console.log(`• Shipped today: ${shippedOrders.length}`);
    console.log(`• Outstanding orders: ${outstandingOrders.length}`);

    if (newOrders.length > 0) {
      console.log('\n📦 NEW ORDERS DETAILS:');
      newOrders.forEach(order => {
        console.log(`  • ORD-${order.orderNumber} - ${order.customerName} (${order.status})`);
      });
    }

    if (pickedOrders.length > 0) {
      console.log('\n✅ PICKED ORDERS DETAILS:');
      pickedOrders.forEach(order => {
        console.log(`  • ORD-${order.orderNumber} - ${order.customerName} (picked at ${new Date(order.pickedAt).toLocaleTimeString()})`);
      });
    }

    if (shippedOrders.length > 0) {
      console.log('\n🚚 SHIPPED ORDERS DETAILS:');
      shippedOrders.forEach(order => {
        console.log(`  • ORD-${order.orderNumber} - ${order.customerName} (shipped at ${new Date(order.shippedAt).toLocaleTimeString()})`);
      });
    }

    console.log('\n✅ THIS IS THE EXACT MESSAGE THAT WOULD BE SENT TO SLACK');
    
    await sql.end();

  } catch (error) {
    console.error('❌ Error accessing real database data:', error.message);
    console.log('\nThis error suggests the database connection or schema might need attention.');
  }
}

testRealDailyReport();