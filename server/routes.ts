import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from 'zod';
import { insertProductSchema, insertOrderSchema, insertOrderItemSchema, insertCustomerSchema, insertUserSchema, insertCategorySchema, type Product } from "@shared/schema";
import { isAuthenticated, hasRole } from "./auth";
import { hashPassword } from "./auth";
import { UploadedFile } from "express-fileupload";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from 'ws';

// Define WebSocket server and connected clients
let wss: WebSocketServer;
const clients = new Set<WebSocket>();

// Helper function to broadcast messages to all connected clients
function broadcastMessage(message: any) {
  const messageString = JSON.stringify(message);
  clients.forEach(client => {
    // Check if the connection is open (readyState === 1)
    if (client.readyState === 1) {
      client.send(messageString);
    }
  });
}

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
  
  app.get('/api/products/low-stock', async (req, res) => {
    try {
      const products = await storage.getLowStockProducts();
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
      let imagePath = null;
      
      // Handle file upload if present
      if (req.files && req.files.image) {
        const imageFile = req.files.image as UploadedFile;
        const uploadDir = path.join(process.cwd(), 'public/uploads/products');
        
        // Ensure upload directory exists
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Generate unique filename
        const filename = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
        const filePath = path.join(uploadDir, filename);
        
        // Move file to uploads directory
        await imageFile.mv(filePath);
        
        // Set image path for storage
        imagePath = `/uploads/products/${filename}`;
      }
      
      // Parse and validate product data
      const productData = insertProductSchema.parse({
        ...req.body,
        imagePath: imagePath || req.body.imagePath
      });
      
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
      let updateData = req.body;
      
      // Handle file upload if present
      if (req.files && req.files.image) {
        const imageFile = req.files.image as UploadedFile;
        const uploadDir = path.join(process.cwd(), 'public/uploads/products');
        
        // Ensure upload directory exists
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Generate unique filename
        const filename = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
        const filePath = path.join(uploadDir, filename);
        
        // Move file to uploads directory
        await imageFile.mv(filePath);
        
        // Set image path for update
        updateData = {
          ...updateData,
          imagePath: `/uploads/products/${filename}`
        };
        
        // If there's an existing image file, we could delete it here
        // Get the current product to find the old image path
        const existingProduct = await storage.getProduct(id);
        if (existingProduct && existingProduct.imagePath) {
          const oldImagePath = path.join(process.cwd(), 'public', existingProduct.imagePath);
          if (fs.existsSync(oldImagePath)) {
            // Optional: Delete the old image file
            // fs.unlinkSync(oldImagePath);
          }
        }
      }
      
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
      
      // First get the product to check if it has an image
      const product = await storage.getProduct(id);
      if (product && product.imagePath) {
        // Delete the image file if it exists
        const imagePath = path.join(process.cwd(), 'public', product.imagePath);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      const result = await storage.deleteProduct(id);
      
      if (!result) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Dedicated product image upload endpoint
  app.post('/api/products/:id/image', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if product exists
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      if (!req.files || !req.files.image) {
        return res.status(400).json({ message: 'No image file uploaded' });
      }
      
      const imageFile = req.files.image as UploadedFile;
      const uploadDir = path.join(process.cwd(), 'public/uploads/products');
      
      // Ensure upload directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Generate unique filename
      const filename = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
      const filePath = path.join(uploadDir, filename);
      
      // Move file to uploads directory
      await imageFile.mv(filePath);
      
      // Delete old image if it exists
      if (product.imagePath) {
        const oldImagePath = path.join(process.cwd(), 'public', product.imagePath);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Update product with new image path
      const imagePath = `/uploads/products/${filename}`;
      const updatedProduct = await storage.updateProduct(id, { imagePath });
      
      res.json(updatedProduct);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  

  
  // Order routes
  app.get('/api/orders', async (req, res) => {
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
      const { items, ...orderData } = req.body;
      const validatedOrder = insertOrderSchema.parse(orderData);
      
      const order = await storage.createOrder({
        ...validatedOrder,
        orderDate: validatedOrder.orderDate || new Date(),
      });
      
      // Add order items if provided
      if (items && Array.isArray(items)) {
        for (const item of items) {
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
  
  app.patch('/api/orders/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const orderData = insertOrderSchema.partial().parse(req.body);
      const updatedOrder = await storage.updateOrder(id, orderData);
      
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

  app.patch('/api/orders/:id/status', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['pending', 'picked', 'shipped', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      
      // Get original order to know the previous status
      const originalOrder = await storage.getOrder(id);
      if (!originalOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      const previousStatus = originalOrder.status;
      
      const updatedOrder = await storage.updateOrderStatus(id, status);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Send notification via WebSocket
      broadcastMessage({
        type: 'orderStatusChange',
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        newStatus: status,
        previousStatus: previousStatus
      });
      
      res.json(updatedOrder);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Document upload for orders
  app.post('/api/orders/:id/documents', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if order exists
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      if (!req.files || !req.files.document) {
        return res.status(400).json({ message: 'No document file uploaded' });
      }
      
      const documentFile = req.files.document as UploadedFile;
      const documentType = req.body.documentType; 
      const notes = req.body.notes;
      
      if (!documentType) {
        return res.status(400).json({ message: 'Document type is required' });
      }
      
      const uploadDir = path.join(process.cwd(), 'public/uploads/documents');
      
      // Ensure upload directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Generate unique filename
      const filename = `${Date.now()}-${documentFile.name.replace(/\s+/g, '-')}`;
      const filePath = path.join(uploadDir, filename);
      
      // Move file to uploads directory
      await documentFile.mv(filePath);
      
      // Document path for storage
      const documentPath = `/uploads/documents/${filename}`;
      
      // Update order status with document info
      const updatedOrder = await storage.updateOrderStatus(id, 'shipped', {
        documentPath,
        documentType,
        notes
      });
      
      res.json({ success: true, documentPath });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get shipping document for an order
  app.get('/api/orders/:id/documents', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get shipping document for this order
      const document = await storage.getShippingDocument(id);
      
      if (!document) {
        return res.status(404).json({ message: 'No shipping document found for this order' });
      }
      
      res.json(document);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Customer routes
  app.get('/api/customers', async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (query) {
        const searchResults = await storage.searchCustomers(query);
        return res.json(searchResults);
      }
      
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/customers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id);
      
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Add endpoint to get previous products for a customer
  app.get('/api/customers/:customerName/previous-products', async (req, res) => {
    try {
      const { customerName } = req.params;
      if (!customerName) {
        return res.status(400).json({ message: "Customer name is required" });
      }
      
      // Get all orders for this customer
      const allOrders = await storage.getAllOrders();
      
      // Filter orders by customer name
      const customerOrders = allOrders.filter(order => 
        order.customerName.toLowerCase() === decodeURIComponent(customerName).toLowerCase());
      
      if (customerOrders.length === 0) {
        return res.json([]);
      }
      
      // Get all order items for each order
      const productPromises = customerOrders.map(async order => {
        const orderItems = await storage.getOrderItems(order.id);
        return orderItems;
      });
      
      const orderItemsArrays = await Promise.all(productPromises);
      const allOrderItems = orderItemsArrays.flat();
      
      // Count product frequency and get details
      const productCounts: Record<number, number> = {};
      const productDetails: Record<number, any> = {};
      
      // Process all items to count frequency
      for (const item of allOrderItems) {
        if (productCounts[item.productId]) {
          productCounts[item.productId] += 1;
        } else {
          productCounts[item.productId] = 1;
          // Get product details if we haven't fetched it yet
          if (!productDetails[item.productId]) {
            const product = await storage.getProduct(item.productId);
            if (product) {
              productDetails[item.productId] = product;
            }
          }
        }
      }
      
      // Format the result - products sorted by frequency
      const frequentProducts = Object.keys(productCounts)
        .map(key => parseInt(key))
        .filter(productId => productDetails[productId]) // Ensure we have product details
        .map(productId => ({
          ...productDetails[productId],
          orderCount: productCounts[productId]
        }))
        .sort((a, b) => b.orderCount - a.orderCount); // Sort by most ordered first
      
      res.json(frequentProducts);
    } catch (error: any) {
      console.error("Error fetching previous products:", error);
      res.status(500).json({ message: `Error fetching previous products: ${error.message}` });
    }
  });
  
  app.post('/api/customers', async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      
      res.status(201).json(customer);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/customers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customerData = insertCustomerSchema.partial().parse(req.body);
      
      const updatedCustomer = await storage.updateCustomer(id, customerData);
      
      if (!updatedCustomer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      
      res.json(updatedCustomer);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.delete('/api/customers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if customer exists first
      const customer = await storage.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      
      // Check if customer has associated orders
      // Note: In a real implementation, we'd need to check for associated orders
      // and prevent deletion if they exist
      
      const result = await storage.deleteCustomer(id);
      
      if (!result) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      
      res.status(204).send();
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
  
  // Endpoint handled below
  
  // Advanced Analytics Routes
  app.get('/api/analytics/inventory-trend', async (req, res) => {
    try {
      const weeks = req.query.weeks ? parseInt(req.query.weeks as string) : 6;
      const data = await storage.getInventoryTrendData(weeks);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/analytics/orders-trend', async (req, res) => {
    try {
      const months = req.query.months ? parseInt(req.query.months as string) : 6;
      const data = await storage.getOrdersTrendData(months);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/analytics/product-categories', async (req, res) => {
    try {
      const data = await storage.getProductCategoryData();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/analytics/top-selling-products', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const data = await storage.getTopSellingProducts(limit);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/analytics/inventory-value', async (req, res) => {
    try {
      const data = await storage.getInventoryValueReport();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/analytics/picking-efficiency', async (req, res) => {
    try {
      const data = await storage.getPickingEfficiencyReport();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Test notification endpoint
  app.post('/api/test-notification', async (req, res) => {
    try {
      const { type } = req.body;
      if (!type || !['success', 'warning', 'error'].includes(type)) {
        return res.status(400).json({ message: 'Invalid notification type' });
      }
      
      // Generate a random ID for the test notification
      const id = Math.random().toString(36).substring(2, 15);
      
      // Create a test notification
      const testNotification = {
        id,
        title: `Test ${type.charAt(0).toUpperCase() + type.slice(1)} Notification`,
        message: `This is a test ${type} notification with sound alert.`,
        type,
        timestamp: new Date(),
        read: false
      };
      
      // Broadcast the notification to all connected clients
      broadcastMessage({
        type: 'notification',
        notification: testNotification
      });
      
      res.json({ success: true, message: 'Test notification sent' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  const httpServer = createServer(app);
  
  // Set up WebSocket server
  // User management routes
  // Get all users (admin only)
  app.get('/api/users', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Don't send password hashes in response
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get user by ID (admin only)
  app.get('/api/users/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Don't send password hash in response
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create new user (admin only)
  app.post('/api/users', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      // Parse and validate user data
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(userData.password);
      
      // Create the user with hashed password
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Don't return password hash in response
      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update user (admin only)
  app.patch('/api/users/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userData = insertUserSchema.partial().parse(req.body);
      
      // If password is being updated, hash it
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }
      
      // If username is being updated, check that it doesn't conflict
      if (userData.username) {
        const existingUser = await storage.getUserByUsername(userData.username);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({ message: 'Username already exists' });
        }
      }
      
      const updatedUser = await storage.updateUser(id, userData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Don't return password hash in response
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete user (admin only)
  app.delete('/api/users/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Don't allow deleting the current user
      if (req.user && (req.user as any).id === id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }
      
      const result = await storage.deleteUser(id);
      
      if (!result) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Category management routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/categories/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(id);
      
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      res.json(category);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/categories', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      
      // Check if category name already exists
      const existingCategory = await storage.getCategoryByName(categoryData.name);
      if (existingCategory) {
        return res.status(400).json({ message: 'Category name already exists' });
      }
      
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/categories/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertCategorySchema.partial().parse(req.body);
      
      // If name is being updated, check that it doesn't conflict
      if (categoryData.name) {
        const existingCategory = await storage.getCategoryByName(categoryData.name);
        if (existingCategory && existingCategory.id !== id) {
          return res.status(400).json({ message: 'Category name already exists' });
        }
      }
      
      const updatedCategory = await storage.updateCategory(id, categoryData);
      
      if (!updatedCategory) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      res.json(updatedCategory);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.delete('/api/categories/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const result = await storage.deleteCategory(id);
      
      if (!result) {
        return res.status(400).json({ 
          message: 'Cannot delete this category because it is in use by one or more products' 
        });
      }
      
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket) => {
    // Add client to the set
    clients.add(ws);
    console.log('[websocket] Client connected. Total clients:', clients.size);
    
    // Handle disconnection
    ws.on('close', () => {
      clients.delete(ws);
      console.log('[websocket] Client disconnected. Total clients:', clients.size);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to notification server'
    }));
  });
  
  return httpServer;
}
