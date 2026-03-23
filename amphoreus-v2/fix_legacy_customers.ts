import pg from 'pg';
import fs from 'fs';

const newPool = new pg.Pool({ connectionString: 'postgresql://amphoreus:changeme@localhost:5433/amphoreus' });

async function fix() {
    console.log('Starting missing customer fix...');

    const ordersRaw = fs.readFileSync('/tmp/orders_strict.txt', 'utf8').split('\n');
    const customersRaw = fs.readFileSync('/tmp/customers_strict.txt', 'utf8').split('\n');
    let orderMap = new Map();

    for (const line of ordersRaw) {
        const parts = line.split('\t');
        if (parts.length < 3) continue;
        const orderNum = parts[1];
        const custName = parts[2];
        orderMap.set(orderNum, custName);
    }

    const { rows: currentCustomers } = await newPool.query('SELECT id, name FROM customers');

    for (const [orderNum, originalName] of orderMap.entries()) {
        const { rows: currentOrder } = await newPool.query('SELECT * FROM orders WHERE order_number = $1', [orderNum]);
        if (!currentOrder.length) continue;

        const currentCustId = currentOrder[0].customer_id;

        // Find if it was assigned to Legacy Customer
        const { rows: custObj } = await newPool.query('SELECT name FROM customers WHERE id = $1', [currentCustId]);
        if (custObj.length && custObj[0].name === 'Legacy Customer') {
            console.log(`Fixing order ${orderNum} initially linked to Legacy Customer (original name: "${originalName}").`);

            // Try to fuzzy match first (case insensitive, trim)
            let matchedCustId = null;
            let targetName = originalName.trim().toLowerCase();
            for (const c of currentCustomers) {
                if (c.name.trim().toLowerCase() === targetName) {
                    matchedCustId = c.id;
                    break;
                }
            }

            if (matchedCustId) {
                console.log(` > Matched with existing customer ID ${matchedCustId}. Updating...`);
                await newPool.query('UPDATE orders SET customer_id = $1 WHERE order_number = $2', [matchedCustId, orderNum]);
            } else {
                console.log(` > No match found. Creating new customer "${originalName.trim()}".`);
                const { rows: newCust } = await newPool.query('INSERT INTO customers (name, country) VALUES ($1, $2) RETURNING id', [originalName.trim(), 'GR']);
                matchedCustId = newCust[0].id;

                // add to currentCustomers so we don't recreate it next time
                currentCustomers.push({ id: matchedCustId, name: originalName.trim() });

                await newPool.query('UPDATE orders SET customer_id = $1 WHERE order_number = $2', [matchedCustId, orderNum]);
            }
        }
    }

    console.log('Fix complete.');
    await newPool.end();
}

fix().catch(err => {
    console.error('Fix failed:', err);
    process.exit(1);
});
