import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated, hasPermission } from '../auth';
import { insertOrderSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await storage.getAllOrders();
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await storage.getOrderItems(order.id);
        return { ...order, items };
      })
    );
    res.json(ordersWithItems);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get recent orders
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || '5');
    const orders = await storage.getRecentOrders(limit);
    
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await storage.getOrderItems(order.id);
        return { ...order, items };
      })
    );
    
    res.json(ordersWithItems);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get partially shipped orders
router.get('/partially-shipped', async (req, res) => {
  try {
    const orders = await storage.getPartiallyShippedOrders();
    res.json(orders);
  } catch (error: any) {
    console.error("Error fetching partially shipped orders:", error);
    res.status(500).json({ message: error.message });
  }
});

// Complete shipment for partially shipped orders
router.post('/complete-shipment', async (req, res) => {
  try {
    const { orderIds } = req.body;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'Order IDs are required' });
    }
    
    await Promise.all(orderIds.map(orderId => 
      storage.completeOrderShipment(orderId)
    ));
    
    res.json({ success: true, message: 'Orders marked as shipped successfully' });
  } catch (error: any) {
    console.error("Error completing order shipments:", error);
    res.status(500).json({ message: error.message });
  }
});

// Search orders
router.get('/search', async (req, res) => {
  try {
    const query = (req.query.query || req.query.q) as string;
    
    if (!query) {
      const recentOrders = await storage.getRecentOrders(10);
      return res.json(recentOrders);
    }
    
    const allOrders = await storage.getAllOrders();
    const filteredOrders = allOrders.filter(order => 
      order.orderNumber.toLowerCase().includes(query.toLowerCase())
    );
    
    res.json(filteredOrders);
  } catch (error: any) {
    console.error("Error searching orders:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get order by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const order = await storage.getOrder(id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const items = await storage.getOrderItems(id);
    res.json({ ...order, items });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create new order
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const orderData = insertOrderSchema.parse(req.body);
    const order = await storage.createOrder(orderData);
    res.status(201).json(order);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update order
router.patch('/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData = insertOrderSchema.partial().parse(req.body);
    
    const updatedOrder = await storage.updateOrder(id, updateData);
    
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json(updatedOrder);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete order
router.delete('/:id', isAuthenticated, hasPermission('manage_orders'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }
    
    const order = await storage.getOrder(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const result = await storage.deleteOrder(id);
    
    if (!result) {
      return res.status(404).json({ message: 'Order not found or could not be deleted' });
    }
    
    res.json({ success: true, message: `Order ${order.orderNumber} has been deleted` });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    res.status(500).json({ message: error.message || 'An error occurred while deleting the order' });
  }
});

export default router; 