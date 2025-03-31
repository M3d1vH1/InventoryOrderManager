import { Router } from 'express';
import { storage } from '../storage.postgresql';
import { isAuthenticated } from '../auth';

const router = Router();

// Endpoint to get orders from the last week with estimated shipping dates
router.get('/dispatch-schedule', isAuthenticated, async (req, res) => {
  try {
    // Get days parameter (default to 7 for last week)
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    
    // Get all orders
    const orders = await storage.getAllOrders();
    
    // Calculate the date for N days ago
    const dateNDaysAgo = new Date();
    dateNDaysAgo.setDate(dateNDaysAgo.getDate() - days);
    
    // Filter orders created within the last N days
    const recentOrders = orders.filter(order => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= dateNDaysAgo;
    });
    
    // Extract all unique customer names for batch lookup
    const customerNames = Array.from(new Set(recentOrders.map(order => order.customerName)));
    
    // Get all customers whose names are in the list
    const customers = await Promise.all(
      customerNames.map(async (name) => {
        const matchedCustomers = await storage.searchCustomers(name);
        // Find the best match (exact match or first result)
        return matchedCustomers.find(c => c.name === name) || matchedCustomers[0];
      })
    );
    
    // Create a mapping of customer names to customer data
    const customerMap = customers.reduce<Record<string, any>>((map, customer) => {
      if (customer) {
        map[customer.name] = customer;
      }
      return map;
    }, {});
    
    // Collect customer information for the orders
    const dispatchSchedule = recentOrders.map((order) => {
      const customer = customerMap[order.customerName];
      
      // Determine shipping company based on available information
      let shippingCompany = "Not specified";
      if (customer) {
        if (customer.customShippingCompany) {
          shippingCompany = customer.customShippingCompany;
        } else if (customer.shippingCompany) {
          shippingCompany = customer.shippingCompany;
        } else if (customer.preferredShippingCompany) {
          shippingCompany = customer.preferredShippingCompany;
        }
      }
      
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        orderDate: order.orderDate,
        estimatedShippingDate: order.estimatedShippingDate,
        actualShippingDate: order.actualShippingDate,
        status: order.status,
        shippingCompany: shippingCompany
      };
    });
    
    return res.json(dispatchSchedule);
  } catch (error) {
    console.error('Error fetching dispatch schedule:', error);
    return res.status(500).json({ error: 'Failed to fetch dispatch schedule' });
  }
});

// Endpoint to get orders with shipping delays
router.get('/shipping-delays', isAuthenticated, async (req, res) => {
  try {
    // Get all orders
    const orders = await storage.getAllOrders();
    
    // Filter orders that have an estimated shipping date but haven't been shipped yet
    const now = new Date();
    const delayedOrders = orders.filter(order => {
      // Filter for orders that:
      // 1. Are not yet shipped (status is not 'shipped' or 'cancelled')
      // 2. Have an estimated shipping date that has already passed
      return (
        (order.status !== 'shipped' && order.status !== 'cancelled') &&
        order.estimatedShippingDate && 
        new Date(order.estimatedShippingDate) < now
      );
    });
    
    // Sort by delay duration (most delayed first)
    delayedOrders.sort((a, b) => {
      const dateA = new Date(a.estimatedShippingDate || 0);
      const dateB = new Date(b.estimatedShippingDate || 0);
      return dateA.getTime() - dateB.getTime(); // Oldest estimated date first (most delayed)
    });
    
    // Extract all unique customer names for batch lookup
    const customerNames = Array.from(new Set(delayedOrders.map(order => order.customerName)));
    
    // Get all customers whose names are in the list
    const customers = await Promise.all(
      customerNames.map(async (name) => {
        const matchedCustomers = await storage.searchCustomers(name);
        return matchedCustomers.find(c => c.name === name) || matchedCustomers[0];
      })
    );
    
    // Create a mapping of customer names to customer data
    const customerMap = customers.reduce<Record<string, any>>((map, customer) => {
      if (customer) {
        map[customer.name] = customer;
      }
      return map;
    }, {});
    
    // Prepare the response with delay information
    const delayReport = delayedOrders.map(order => {
      const customer = customerMap[order.customerName];
      // Calculate delay in days, ensuring null check for estimatedShippingDate
      const delayInDays = order.estimatedShippingDate 
        ? Math.floor((now.getTime() - new Date(order.estimatedShippingDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        orderDate: order.orderDate,
        estimatedShippingDate: order.estimatedShippingDate,
        status: order.status,
        delayInDays: delayInDays,
        contactInfo: customer ? {
          email: customer.email,
          phone: customer.phone,
          contactPerson: customer.contactPerson
        } : null
      };
    });
    
    return res.json(delayReport);
  } catch (error) {
    console.error('Error fetching shipping delays:', error);
    return res.status(500).json({ error: 'Failed to fetch shipping delays' });
  }
});

// Endpoint to get order fulfillment statistics 
router.get('/fulfillment-stats', isAuthenticated, async (req, res) => {
  try {
    // Get time period parameter (default to 30 days)
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    
    // Get all orders
    const orders = await storage.getAllOrders();
    
    // Calculate the date for N days ago
    const dateNDaysAgo = new Date();
    dateNDaysAgo.setDate(dateNDaysAgo.getDate() - days);
    
    // Filter orders created within the specified period
    const periodOrders = orders.filter(order => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= dateNDaysAgo;
    });
    
    // Calculate statistics
    const totalOrders = periodOrders.length;
    const shippedOrders = periodOrders.filter(order => order.status === 'shipped').length;
    const pendingOrders = periodOrders.filter(order => order.status === 'pending').length;
    const pickedOrders = periodOrders.filter(order => order.status === 'picked').length;
    const cancelledOrders = periodOrders.filter(order => order.status === 'cancelled').length;
    const partialFulfillment = periodOrders.filter(order => order.isPartialFulfillment).length;
    
    // Calculate average fulfillment time (order to shipping)
    let totalFulfillmentDays = 0;
    let ordersWithFulfillmentTime = 0;
    
    periodOrders.forEach(order => {
      if (order.status === 'shipped' && order.actualShippingDate) {
        const orderDate = new Date(order.orderDate);
        const shippingDate = new Date(order.actualShippingDate);
        const diffTime = Math.abs(shippingDate.getTime() - orderDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        totalFulfillmentDays += diffDays;
        ordersWithFulfillmentTime++;
      }
    });
    
    const avgFulfillmentTime = ordersWithFulfillmentTime > 0 
      ? (totalFulfillmentDays / ordersWithFulfillmentTime).toFixed(1) 
      : 'N/A';
    
    // Calculate on-time delivery percentage
    let onTimeDeliveries = 0;
    let ordersWithBothDates = 0;
    
    periodOrders.forEach(order => {
      if (order.status === 'shipped' && order.estimatedShippingDate && order.actualShippingDate) {
        ordersWithBothDates++;
        
        const estimatedDate = new Date(order.estimatedShippingDate);
        const actualDate = new Date(order.actualShippingDate);
        
        // Consider delivered on time if actual shipping date is on or before estimated date
        if (actualDate <= estimatedDate) {
          onTimeDeliveries++;
        }
      }
    });
    
    const onTimePercentage = ordersWithBothDates > 0 
      ? ((onTimeDeliveries / ordersWithBothDates) * 100).toFixed(1) 
      : 'N/A';
    
    // Prepare the response
    const fulfillmentStats = {
      period: `Last ${days} days`,
      totalOrders,
      shippedOrders,
      pendingOrders,
      pickedOrders,
      cancelledOrders,
      partialFulfillment,
      fulfillmentRate: totalOrders > 0 ? ((shippedOrders / totalOrders) * 100).toFixed(1) + '%' : '0%',
      avgFulfillmentTime: avgFulfillmentTime + (avgFulfillmentTime !== 'N/A' ? ' days' : ''),
      onTimeDeliveryRate: onTimePercentage + (onTimePercentage !== 'N/A' ? '%' : '')
    };
    
    return res.json(fulfillmentStats);
  } catch (error) {
    console.error('Error calculating fulfillment statistics:', error);
    return res.status(500).json({ error: 'Failed to calculate fulfillment statistics' });
  }
});

export default router;