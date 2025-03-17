import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from 'zod';
import { insertProductSchema, insertOrderSchema, insertOrderItemSchema, insertCustomerSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  const apiRouter = app.route('/api');
  
  // Product routes
  app.get('/api/products', async (req, res) => {
    try {
      const query = req.query.q as string || '';
      const category = req.query.category as string;
      const stockStatus = req.query.stockStatus as string;
      
      const products = await storage.searchProducts(query, category, stockStatus);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/products/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/products', async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/products/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      const updatedProduct = await storage.updateProduct(id, updateData);
      
      if (!updatedProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json(updatedProduct);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.delete('/api/products/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deleteProduct(id);
      
      if (!result) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/products/low-stock', async (req, res) => {
    try {
      const products = await storage.getLowStockProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Order routes
  app.get('/api/orders', async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/orders/recent', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string || '5');
      const orders = await storage.getRecentOrders(limit);
      
      // Get order items for each order
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
  
  app.get('/api/orders/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Get order items
      const items = await storage.getOrderItems(order.id);
      
      res.json({ ...order, items });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/orders', async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(orderData);
      
      // Add order items if provided
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          const orderItem = {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity
          };
          
          await storage.addOrderItem(orderItem);
        }
      }
      
      res.status(201).json(order);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/orders/:id/status', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['pending', 'picked', 'shipped', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      
      const updatedOrder = await storage.updateOrderStatus(id, status);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      res.json(updatedOrder);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Customer routes
  app.get('/api/customers', async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Dashboard stats
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
