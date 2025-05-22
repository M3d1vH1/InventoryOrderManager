import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from 'zod';
import { insertProductSchema, insertOrderSchema, insertOrderItemSchema, insertCustomerSchema, insertUserSchema, insertCategorySchema, insertTagSchema, type Product, orderItems } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated, hasRole } from "./auth";
import { hashPassword } from "./auth";
import { UploadedFile } from "express-fileupload";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from 'ws';
import { exec } from "child_process";
import { promisify } from "util";
import PDFDocument from 'pdfkit';
import { getEmailSettings, updateEmailSettings, testEmailConnection, getEmailTemplate, updateEmailTemplate } from "./api/emailSettings";
import { getGeoblockingSettings, updateGeoblockingSettings } from "./api/geoblocking";
import { getGeoblockingStatus, toggleGeoblocking, addToAllowlist, removeFromAllowlist } from "./api/geoblocking-routes";
import { getLabelTemplate, updateLabelTemplate, getAllLabelTemplates, previewLabelTemplate } from "./api/labelTemplates";
import { getCompanySettings, updateCompanySettings, getNotificationSettings, updateNotificationSettings, testSlackWebhook, testSlackNotification, testSlackTemplate } from "./api/settings";
import { getOrderErrors, getOrderQuality, createOrderError, updateOrderError, resolveOrderError, adjustInventoryForError, getErrorStats } from "./api/orderErrors";
import { getInventoryChanges, getInventoryChange, addInventoryChange, getRecentInventoryChanges, getInventoryChangesByType } from "./api/inventoryChanges";
import orderPdfRouter from "./api/orderPdf";
import imageUploadFixRouter from "./api/imageUploadFix";
import { generateOrderPDF } from "./services/puppeteerPdfService";
import { testPrinter } from "./api/testPrinter";
import {
  getInventoryPredictions,
  getInventoryPrediction,
  createInventoryPrediction,
  updateInventoryPrediction,
  deleteInventoryPrediction,
  getProductsRequiringReorder,
  generatePredictions,
  getInventoryHistory,
  createInventoryHistory,
  getSeasonalPatterns,
  createSeasonalPattern,
  deleteSeasonalPattern,
  importSeasonalPatterns
} from "./api/inventoryPrediction";
import callLogsRouter from "./api/callLogs";
import prospectiveCustomersRouter from "./api/prospectiveCustomers";
import reportsRouter from "./api/reports";
import productionRouter from "./api/production";
import supplierPaymentsRouter from "./api/supplierPayments";
import customersRouter from "./api/customers";
import { createSlackService } from "./services/notifications/slackService";
import { printShippingLabel, printBatchShippingLabels, previewShippingLabel, servePreviewImage } from "./api/labelPrinting";
import { generateDirectLabel } from "./api/directLabel";
import { getCustomerInfoForLabel } from "./api/shipping";
import { getProductByBarcode, logBarcodeScan, getBarcodeScanHistory, updateInventoryByBarcode } from "./api/barcode";

// Function to determine the appropriate storage path based on environment
function getStoragePath(): string {
  // Check for environment variable first (most flexible for self-hosting)
  if (process.env.STORAGE_PATH) {
    return process.env.STORAGE_PATH;
  }
  
  // Check if .data directory exists (Replit-specific persistent storage)
  const replitDataPath = path.join(process.cwd(), '.data');
  if (fs.existsSync(replitDataPath)) {
    return replitDataPath;
  }
  
  // Default to a 'storage' directory in the project root
  const defaultStoragePath = path.join(process.cwd(), 'storage');
  if (!fs.existsSync(defaultStoragePath)) {
    fs.mkdirSync(defaultStoragePath, { recursive: true });
  }
  
  return defaultStoragePath;
}

// Base path for persistent file storage (works on Replit and self-hosted)
const STORAGE_BASE_PATH = getStoragePath();
const UPLOADS_PATH = path.join(STORAGE_BASE_PATH, 'uploads');
const PRODUCTS_UPLOAD_PATH = path.join(UPLOADS_PATH, 'products');

// Ensure upload directories exist
if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}
if (!fs.existsSync(PRODUCTS_UPLOAD_PATH)) {
  fs.mkdirSync(PRODUCTS_UPLOAD_PATH, { recursive: true });
}

// Function to ensure public folder has access to files in the storage
function ensurePublicAccess(sourcePath: string, publicPath: string): void {
  const publicDir = path.join(process.cwd(), 'public', publicPath);
  
  // Create parent directories if they don't exist
  if (!fs.existsSync(path.dirname(publicDir))) {
    fs.mkdirSync(path.dirname(publicDir), { recursive: true });
  }
  
  // Try to create a symbolic link if it doesn't exist
  if (!fs.existsSync(publicDir)) {
    try {
      fs.symlinkSync(sourcePath, publicDir, 'dir');
    } catch (err) {
      console.error(`Failed to create symbolic link from ${sourcePath} to ${publicDir}:`, err);
      // If symlink fails (common on Windows), we'll use a file copy approach instead
      // This won't automatically sync new files but ensures basic functionality
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      // We don't copy files here - individual file operations handle this when needed
    }
  }
}

// Setup required symbolic links (or fallback directories)
ensurePublicAccess(PRODUCTS_UPLOAD_PATH, 'uploads/products');
import { getSlowMovingProducts, updateProductStock } from "./api/inventory";
import { sendOrderShippedEmail } from "./services/emailService";
import { migrateImages } from "./api/migrateImages";

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
  // Add simple health check endpoint that will work even if other parts fail
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      memoryUsage: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
    });
  });
  
  // Add simple test page that doesn't require database or authentication
  app.get('/test-deployment', (req: Request, res: Response) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Deployment Test</title>
          <meta charset="utf-8">
          <style>
            body { font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .success { color: green; }
            .data { background: #f0f0f0; padding: 10px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Deployment Test Page</h1>
          <p class="success">✅ Basic server functionality is working!</p>
          <p>If you can see this page but other parts of the application aren't working, the issue is likely with:</p>
          <ul>
            <li>Database connection settings</li>
            <li>Authentication system</li>
            <li>Resource limitations on deployment</li>
          </ul>
          <div class="data">
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
            <p><strong>Server Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Memory Usage:</strong> ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB</p>
          </div>
          <p>Try accessing the <a href="/api/health">/api/health</a> endpoint for JSON data.</p>
        </body>
      </html>
    `);
  });

  // Geoblocking control routes
  app.get('/geoblocking-status', getGeoblockingStatus);
  app.get('/toggle-geoblocking', toggleGeoblocking);
  app.post('/add-to-allowlist', addToAllowlist);
  app.get('/remove-from-allowlist', removeFromAllowlist);

  // Printer test endpoint for CAB EOS1
  app.get('/api/test-printer', (req, res) => {
    testPrinter(req, res);
  });
  // Development-only auto-login endpoint to help with testing
  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/dev-login', async (req, res) => {
      try {
        // Get the default admin user
        const adminUser = await storage.getUserByUsername('admin');
        
        if (!adminUser) {
          return res.status(404).json({ error: 'Admin user not found' });
        }
        
        // Log the user in by setting up the session
        req.login(adminUser, (err) => {
          if (err) {
            console.error('Session login error:', err);
            return res.status(500).json({ error: 'Login failed' });
          }
          
          // Return success with user info (exclude password)
          const { password, ...userInfo } = adminUser;
          return res.json({ 
            success: true, 
            message: 'Development auto-login successful', 
            user: userInfo 
          });
        });
      } catch (error) {
        console.error('Dev login error:', error);
        res.status(500).json({ error: 'Auto-login failed' });
      }
    });
  }
  // Set APP_URL with a fallback
  if (!process.env.APP_URL) {
    process.env.APP_URL = 'https://warehouse-management-system.replit.app';
    console.log('Setting default APP_URL:', process.env.APP_URL);
  } else {
    console.log('Using APP_URL from environment:', process.env.APP_URL);
  }
  // Initialize Slack notification service
  const slackService = createSlackService(storage);
  
  // API routes
  const apiRouter = app.route('/api');
  
  // Product routes
  app.get('/api/products', async (req, res) => {
    try {
      const query = req.query.q as string || '';
      const tag = req.query.tag as string;
      const stockStatus = req.query.stockStatus as string;
      
      const products = await storage.searchProducts(query, tag, stockStatus);
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
  
  app.get('/api/products/slow-moving', async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 60;
      const products = await storage.getSlowMovingProducts(days);
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
        
        // Generate unique filename
        const filename = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
        const filePath = path.join(PRODUCTS_UPLOAD_PATH, filename);
        
        // Move file to uploads directory
        await imageFile.mv(filePath);
        
        // Set image path for storage (URL path)
        imagePath = `/uploads/products/${filename}`;
        
        // Ensure public access (in case symlink was removed)
        ensurePublicAccess(PRODUCTS_UPLOAD_PATH, 'uploads/products');
        
        // If symlink failed, copy the file directly as fallback
        const publicFilePath = path.join(process.cwd(), 'public/uploads/products', filename);
        if (!fs.existsSync(path.dirname(publicFilePath))) {
          fs.mkdirSync(path.dirname(publicFilePath), { recursive: true });
        }
        
        // Only copy if symlink doesn't exist and the file isn't already in public
        if (!fs.existsSync(publicFilePath)) {
          try {
            fs.copyFileSync(filePath, publicFilePath);
          } catch (err) {
            console.error('Failed to copy file to public directory:', err);
          }
        }
      }
      
      // Get body data and handle tags properly
      let reqBody = { ...req.body };
      
      // Handle tags properly if they're coming from form data
      if (reqBody.tags) {
        // If tags is a string that looks like JSON array, parse it
        if (typeof reqBody.tags === 'string' && 
           (reqBody.tags.startsWith('[') || reqBody.tags === '[]')) {
          try {
            reqBody.tags = JSON.parse(reqBody.tags);
          } catch (e) {
            console.error('Error parsing tags JSON:', e);
            reqBody.tags = []; // Default to empty array if parsing fails
          }
        } 
        // Ensure tags is always an array
        if (!Array.isArray(reqBody.tags)) {
          reqBody.tags = [];
        }
      }
      
      // Handle tags[] array format - our new implementation sends individual tags this way
      if (req.body['tags[]'] && (!reqBody.tags || reqBody.tags.length === 0)) {
        console.log('Found tags[] format in create product:', req.body['tags[]']);
        // If it's a single value, convert to array
        if (!Array.isArray(req.body['tags[]'])) {
          reqBody.tags = [req.body['tags[]']];
        } else {
          reqBody.tags = req.body['tags[]'];
        }
      }
      
      // Use tagsJson as a fallback if available
      if (req.body.tagsJson && (!reqBody.tags || reqBody.tags.length === 0)) {
        try {
          reqBody.tags = JSON.parse(req.body.tagsJson);
          console.log('Using tagsJson fallback in create product:', reqBody.tags);
        } catch (e) {
          console.error('Error parsing tagsJson:', e);
        }
      }
      
      console.log('Creating product with data:', JSON.stringify(reqBody));
      
      // Parse and validate product data with default categoryId
      const productData = insertProductSchema.parse({
        ...reqBody,
        imagePath: imagePath || reqBody.imagePath,
        categoryId: 1 // Set default categoryId for all products
      });
      
      const product = await storage.createProduct(productData);
      
      // If tags array is present, update the tag associations
      if (productData.tags && Array.isArray(productData.tags)) {
        console.log(`Creating tag associations for new product ${product.id}:`, productData.tags);
        try {
          // Create tags that don't exist yet and collect their IDs
          const tagIds = await Promise.all(productData.tags.map(async (tagName: string) => {
            let tag = await storage.getTagByName(tagName);
            if (!tag) {
              // Tag doesn't exist, create it
              tag = await storage.createTag({ name: tagName });
            }
            return tag.id;
          }));
          
          // Add the tags to the product
          await storage.updateProductTags(product.id, tagIds);
          console.log(`Successfully created tags for product ${product.id}`);
        } catch (tagError) {
          console.error(`Error creating tags for product ${product.id}:`, tagError);
          // Continue even if tag update fails, as the product was already created
        }
      }
      
      res.status(201).json(product);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      let updateData = {
        ...req.body,
        categoryId: 1 // Ensure categoryId is always set to 1
      };
      
      // Handle tags properly if they're coming from form data
      if (updateData.tags) {
        // If tags is a string that looks like JSON array, parse it
        if (typeof updateData.tags === 'string' && 
           (updateData.tags.startsWith('[') || updateData.tags === '[]')) {
          try {
            updateData.tags = JSON.parse(updateData.tags);
          } catch (e) {
            console.error('Error parsing tags JSON:', e);
            updateData.tags = []; // Default to empty array if parsing fails
          }
        } 
        // Ensure tags is always an array
        if (!Array.isArray(updateData.tags)) {
          updateData.tags = [];
        }
      }
      
      // Handle tags[] array format - our new implementation sends individual tags this way
      if (req.body['tags[]'] && !updateData.tags?.length) {
        console.log('Found tags[] format:', req.body['tags[]']);
        // If it's a single value, convert to array
        if (!Array.isArray(req.body['tags[]'])) {
          updateData.tags = [req.body['tags[]']];
        } else {
          updateData.tags = req.body['tags[]'];
        }
      }
      
      // Use tagsJson as a fallback if available
      if (req.body.tagsJson && (!updateData.tags || updateData.tags.length === 0)) {
        try {
          updateData.tags = JSON.parse(req.body.tagsJson);
          console.log('Using tagsJson fallback:', updateData.tags);
        } catch (e) {
          console.error('Error parsing tagsJson:', e);
        }
      }
      
      console.log('Updating product with data:', JSON.stringify(updateData));
      
      // Handle file upload if present
      if (req.files && req.files.image) {
        const imageFile = req.files.image as UploadedFile;
        
        // Generate unique filename
        const filename = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
        const filePath = path.join(PRODUCTS_UPLOAD_PATH, filename);
        
        // Move file to uploads directory
        await imageFile.mv(filePath);
        
        // Set image path for update
        updateData = {
          ...updateData,
          imagePath: `/uploads/products/${filename}`
        };
        
        // Ensure public access (in case symlink was removed)
        ensurePublicAccess(PRODUCTS_UPLOAD_PATH, 'uploads/products');
        
        // If symlink failed, copy the file directly as fallback
        const publicFilePath = path.join(process.cwd(), 'public/uploads/products', filename);
        if (!fs.existsSync(path.dirname(publicFilePath))) {
          fs.mkdirSync(path.dirname(publicFilePath), { recursive: true });
        }
        
        // Only copy if symlink doesn't exist and the file isn't already in public
        if (!fs.existsSync(publicFilePath)) {
          try {
            fs.copyFileSync(filePath, publicFilePath);
          } catch (err) {
            console.error('Failed to copy file to public directory:', err);
          }
        }
        
        // Delete the old image file if it exists
        const existingProduct = await storage.getProduct(id);
        if (existingProduct && existingProduct.imagePath) {
          const oldFilename = path.basename(existingProduct.imagePath);
          const oldImagePath = path.join(PRODUCTS_UPLOAD_PATH, oldFilename);
          if (fs.existsSync(oldImagePath)) {
            try {
              fs.unlinkSync(oldImagePath);
            } catch (err) {
              console.error('Failed to delete old image file:', err);
            }
          }
        }
      }
      
      // Get userId from authenticated session
      const userId = (req.user as any)?.id;
      
      // Pass userId to track inventory changes
      const updatedProduct = await storage.updateProduct(id, updateData, userId);
      
      if (!updatedProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      // If tags array is present, update the tag associations
      if (updateData.tags && Array.isArray(updateData.tags)) {
        console.log(`Updating tags for product ${id}:`, updateData.tags);
        try {
          // Create tags that don't exist yet and collect their IDs
          const tagIds = await Promise.all(updateData.tags.map(async (tagName: string) => {
            let tag = await storage.getTagByName(tagName);
            if (!tag) {
              // Tag doesn't exist, create it
              tag = await storage.createTag({ name: tagName });
            }
            return tag.id;
          }));
          
          // Update the product's tag associations
          await storage.updateProductTags(id, tagIds);
          console.log(`Successfully updated tags for product ${id}`);
        } catch (tagError) {
          console.error(`Error updating tags for product ${id}:`, tagError);
          // Continue even if tag update fails, as the product was already updated
        }
      }
      
      res.json(updatedProduct);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.delete('/api/products/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
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
  app.post('/api/products/:id/image', isAuthenticated, async (req, res) => {
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
      
      // Generate unique filename
      const filename = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
      const filePath = path.join(PRODUCTS_UPLOAD_PATH, filename);
      
      // Move file to uploads directory
      await imageFile.mv(filePath);
      
      // Ensure public access (in case symlink was removed)
      ensurePublicAccess(PRODUCTS_UPLOAD_PATH, 'uploads/products');
      
      // If symlink failed, copy the file directly as fallback
      const publicFilePath = path.join(process.cwd(), 'public/uploads/products', filename);
      if (!fs.existsSync(path.dirname(publicFilePath))) {
        fs.mkdirSync(path.dirname(publicFilePath), { recursive: true });
      }
      
      // Only copy if symlink doesn't exist and the file isn't already in public
      if (!fs.existsSync(publicFilePath)) {
        try {
          fs.copyFileSync(filePath, publicFilePath);
        } catch (err) {
          console.error('Failed to copy file to public directory:', err);
        }
      }
      
      // Delete old image if it exists
      if (product.imagePath) {
        const oldFilename = path.basename(product.imagePath);
        const oldImagePath = path.join(PRODUCTS_UPLOAD_PATH, oldFilename);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (err) {
            console.error('Failed to delete old image file:', err);
          }
        }
      }
      
      // Update product with new image path
      const imagePath = `/uploads/products/${filename}`;
      // Get userId from authenticated session
      const userId = (req.user as any)?.id;
      
      // Pass userId to track inventory changes (although image updates don't affect inventory)
      const updatedProduct = await storage.updateProduct(id, { imagePath }, userId);
      
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
  
  // Get partially shipped orders
  app.get('/api/orders/partially-shipped', async (req, res) => {
    try {
      const orders = await storage.getPartiallyShippedOrders();
      res.json(orders);
    } catch (error: any) {
      console.error("Error fetching partially shipped orders:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Complete shipment for partially shipped orders
  app.post('/api/orders/complete-shipment', async (req, res) => {
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
  
  // Search orders by query string or get recent orders if no query
  app.get('/api/orders/search', async (req, res) => {
    try {
      // Support both 'query' and 'q' parameter names
      const query = (req.query.query || req.query.q) as string;
      
      // If no query is provided, return recent orders instead
      if (!query) {
        // Get the 10 most recent orders
        const recentOrders = await storage.getRecentOrders(10);
        return res.json(recentOrders);
      }
      
      // For now, just get all orders and filter them
      const allOrders = await storage.getAllOrders();
      
      // Filter orders by order number
      const filteredOrders = allOrders.filter(order => 
        order.orderNumber.toLowerCase().includes(query.toLowerCase())
      );
      
      res.json(filteredOrders);
    } catch (error: any) {
      console.error("Error searching orders:", error);
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
    // Log environment variables for debugging Slack notifications
    console.log('Environment variables for Slack notification:', {
      APP_URL: process.env.APP_URL || 'Not set',
    });
    console.log('Order request payload:', {
      ...req.body,
      items: req.body.items ? `${req.body.items.length} items` : 'No items',
    });
    
    try {
      const { items, ...orderData } = req.body;
      console.log('Validating order data:', {
        customerName: orderData.customerName,
        estimatedShippingDate: orderData.estimatedShippingDate,
        createdById: orderData.createdById,
        notes: orderData.notes ? 'present' : 'not present',
        hasItems: items && Array.isArray(items),
        itemsCount: items && Array.isArray(items) ? items.length : 0,
      });
      
      const validatedOrder = insertOrderSchema.parse(orderData);
      console.log('Order validated successfully');
      
      // Check if this customer has unshipped items before creating a new order
      const customerName = validatedOrder.customerName;
      const unshippedItems = await storage.getUnshippedItems(customerName);
      console.log(`Found ${unshippedItems.length} unshipped items for customer ${customerName}`);
      
      // Create the order
      console.log('About to create order in database');
      const order = await storage.createOrder({
        ...validatedOrder,
        orderDate: validatedOrder.orderDate || new Date(),
      });
      console.log('Order created successfully:', {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      });
      
      // Send Slack notification about new order
      try {
        // Add totalItems property to order object for Slack notification
        const itemCount = items && Array.isArray(items) ? items.length : 0;
        (order as any).totalItems = itemCount;
        (order as any).items = items && Array.isArray(items) ? `${items.length} items` : 'Unknown items';
        
        // Log order details to diagnose if we have the right data for Slack
        console.log('Order notification data:', {
          id: order.id,
          orderNumber: order.orderNumber,
          customer: order.customerName,
          customerName: order.customerName,
          orderDate: order.orderDate ? new Date(order.orderDate).toLocaleString() : 'Unknown',
          status: order.status,
          items: items && Array.isArray(items) ? `${items.length} items` : 'Unknown items',
          totalItems: itemCount,
          appUrl: process.env.APP_URL || '',
        });
        
        // Get notification settings first to check if they're properly configured
        const settings = await storage.getNotificationSettings();
        console.log('Notification settings for order notification:', {
          slackEnabled: settings?.slackEnabled,
          slackNotifyNewOrders: settings?.slackNotifyNewOrders,
          hasWebhookUrl: !!settings?.slackWebhookUrl,
          hasOrderTemplate: !!settings?.slackOrderTemplate,
        });
        
        console.log('About to send slack notification for order');
        const notificationResult = await slackService.notifyNewOrder(order);
        console.log('Slack notification result:', notificationResult ? 'Success' : 'Failed');
      } catch (slackError) {
        console.error('Error sending Slack notification for new order:', slackError);
        // Don't fail the request if Slack notification fails
      }
      
      // Add order items if provided
      if (items && Array.isArray(items)) {
        for (const item of items) {
          // Validate item quantity to prevent negative values
          if (!item.quantity || item.quantity < 1) {
            console.log(`Invalid quantity detected for product ${item.productId}: ${item.quantity}, setting to 1`);
            item.quantity = 1;
          }
          
          const orderItem = {
            orderId: order.id,
            productId: item.productId,
            quantity: Math.max(1, item.quantity) // Ensure minimum quantity is 1
          };
          
          await storage.addOrderItem(orderItem);
        }
      }
      
      // If customer has unshipped items, send a notification via WebSocket
      if (unshippedItems.length > 0) {
        // Create a notification about unshipped items
        const notificationId = Math.random().toString(36).substring(2, 15);
        const notification = {
          id: notificationId,
          title: 'Customer Has Unfulfilled Items',
          message: `New order created for ${customerName} who has ${unshippedItems.length} unfulfilled item(s) from previous orders.`,
          type: 'warning',
          timestamp: new Date(),
          read: false,
          orderId: order.id,
          orderNumber: order.orderNumber
        };
        
        // Send notification via WebSocket
        broadcastMessage({
          type: 'notification',
          notification
        });
        
        // Add info about unshipped items to the response
        return res.status(201).json({
          order,
          warning: {
            hasUnshippedItems: true,
            unshippedItemsCount: unshippedItems.length,
            message: `Customer has ${unshippedItems.length} unfulfilled item(s) from previous orders.`
          }
        });
      }
      
      res.status(201).json({
        order,
        warning: null
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/orders/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Extract items array from request data
      const { items, ...orderDataRaw } = req.body;
      
      // Validate order data
      const orderData = insertOrderSchema.partial().parse(orderDataRaw);
      const userId = (req.user as any)?.id || 1; // Default to admin user if somehow not authenticated
      
      // 1. Pass the validated orderData and userId separately to update the order itself
      const updatedOrder = await storage.updateOrder(id, orderData, userId);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // 2. Handle updating order items if they were provided
      if (items && Array.isArray(items)) {
        console.log(`Updating ${items.length} items for order #${id}`);
        
        // First retrieve current order items
        const existingItems = await storage.getOrderItems(id);
        
        // Delete existing order items - we'll recreate them
        await storage.deleteOrderItemsByOrderId(id);
        
        // Add new items
        for (const item of items) {
          // Validate item quantity to prevent negative values
          if (!item.quantity || item.quantity < 1) {
            console.log(`Invalid quantity detected for product ${item.productId}: ${item.quantity}, setting to 1`);
            item.quantity = 1;
          }
          
          await storage.addOrderItem({
            orderId: id,
            productId: item.productId,
            quantity: Math.max(1, item.quantity) // Ensure minimum quantity is 1
          });
        }
        
        // Add changelog entry for items update
        await storage.addOrderChangelog({
          orderId: id,
          userId: userId,
          action: 'update',
          changes: { items: items },
          previousValues: { items: existingItems },
          notes: "Order items updated"
        });
        
        console.log(`Successfully updated ${items.length} items for order #${id}`);
      }
      
      res.json(updatedOrder);
    } catch (error: any) {
      console.error("Error updating order:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete an order and all its related data
  app.delete('/api/orders/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid order ID' });
      }
      
      // Get order details for notification before deletion
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      const result = await storage.deleteOrder(id);
      
      if (!result) {
        return res.status(404).json({ message: 'Order not found or could not be deleted' });
      }
      
      // Broadcast the deletion
      broadcastMessage({
        type: 'orderDeleted',
        orderId: id,
        orderNumber: order.orderNumber
      });
      
      res.json({ success: true, message: `Order ${order.orderNumber} has been deleted` });
    } catch (error: any) {
      console.error('Error deleting order:', error);
      res.status(500).json({ message: error.message || 'An error occurred while deleting the order' });
    }
  });

  // Route for authorizing unshipped items - now allows front_office users too
  app.post('/api/unshipped-items/authorize', isAuthenticated, hasRole(['admin', 'manager', 'front_office']), async (req, res) => {
    try {
      const { itemIds } = req.body;
      const userId = (req.user as any)?.id;
      const userRole = (req.user as any)?.role;
      
      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ message: 'Item IDs are required' });
      }
      
      // Authorize the items
      await storage.authorizeUnshippedItems(itemIds, userId);
      
      // Get the unshipped items details to add to changelog
      const items = await Promise.all(
        itemIds.map(async (id) => {
          try {
            // For each unshipped item, find its original order
            const unshippedItem = await storage.getUnshippedItem(id);
            if (unshippedItem) {
              // Add to the order's changelog
              await storage.addOrderChangelog({
                orderId: unshippedItem.orderId,
                userId: userId,
                action: 'unshipped_authorization',
                changes: {
                  itemId: id,
                  productId: unshippedItem.productId,
                  quantity: unshippedItem.quantity,
                  authorizedById: userId,
                  authorizedByRole: userRole
                },
                notes: `Authorized unshipped item for future fulfillment by ${userRole}`
              });
              
              return unshippedItem;
            }
            return null;
          } catch (err) {
            console.error(`Error processing unshipped item ${id}:`, err);
            return null;
          }
        })
      );
      
      // Filter out any null items
      const validItems = items.filter(item => item !== null);
      
      // Send notification via WebSocket
      broadcastMessage({
        type: 'unshippedItemsAuthorized',
        itemCount: itemIds.length,
        authorizedById: userId,
        authorizedByRole: userRole
      });
      
      res.json({ success: true, authorizedItems: itemIds.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all unshipped items
  app.get('/api/unshipped-items', isAuthenticated, async (req, res) => {
    try {
      const customerId = req.query.customerId as string;
      const items = await storage.getUnshippedItems(customerId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get unshipped items pending authorization
  app.get('/api/unshipped-items/pending-authorization', isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getUnshippedItemsForAuthorization();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/orders/:id/status', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, itemQuantities, approvePartialFulfillment } = req.body;
      const userId = (req.user as any)?.id;
      const userRole = (req.user as any)?.role;
      
      if (!['pending', 'picked', 'shipped', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      
      // Get original order to know the previous status
      const originalOrder = await storage.getOrder(id);
      if (!originalOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      const previousStatus = originalOrder.status;
      
      // If changing to shipped, check for unshipped items first before doing anything else
      if (status === 'shipped') {
        // Get unshipped items for this order
        const unshippedItems = await storage.getUnshippedItemsByOrder(id);
        
        // If there are unshipped items, this is a partial fulfillment
        if (unshippedItems.length > 0) {
          console.log(`Order ${id} being shipped with ${unshippedItems.length} unshipped items`);
          
          // Check if user has authorization to ship partial orders
          const hasApprovalPermission = userRole === 'admin' || userRole === 'manager';
          
          // Convert approvePartialFulfillment to boolean to handle both string and boolean values
          const isApproved = approvePartialFulfillment === true || approvePartialFulfillment === 'true';
          
          // If this order has not been explicitly approved for partial fulfillment,
          // require approval EVEN for admin/manager - they must explicitly approve
          if (!isApproved) {
            console.log(`Order ${id} requires explicit approval for partial fulfillment. User role: ${userRole}`);
            console.log('Sending approval required response with:', {
              orderId: id,
              unshippedItems: unshippedItems.length,
              isApproved,
              hasApprovalPermission,
              userRole
            });
            
            return res.status(403).json({
              message: "Partial order fulfillment requires explicit approval",
              requiresApproval: true,
              isPartialFulfillment: true,
              unshippedItems: unshippedItems.length,
              orderId: id,
              canApprove: hasApprovalPermission
            });
          }
          
          // Log that we're proceeding with partial fulfillment
          console.log(`Order ${id} partial fulfillment approved by ${userRole}`);
        }
      }
      
      // Handle partial shipments if we have item quantities data and we're marking as picked
      if (status === 'picked' && itemQuantities && Array.isArray(itemQuantities)) {
        const orderItems = await storage.getOrderItems(id);
        
        // Process each item in the order
        for (const quantityData of itemQuantities) {
          const { orderItemId, productId, requestedQuantity, actualQuantity } = quantityData;
          
          // Get the product so we can update its inventory
          const product = await storage.getProduct(productId);
          if (!product) {
            console.error(`Product ID ${productId} not found when processing picked items`);
            continue;
          }
          
          // Reduce the inventory for the actual quantity being picked
          if (actualQuantity > 0) {
            // Calculate the new stock level
            const newStockLevel = Math.max(0, product.currentStock - actualQuantity);
            
            // Update the product stock with user attribution for tracking
            console.log(`Reducing inventory for product ${productId} from ${product.currentStock} to ${newStockLevel} (picked ${actualQuantity})`);
            await storage.updateProduct(productId, { 
              currentStock: newStockLevel,
              lastStockUpdate: new Date()
            }, userId);
          }
          
          // If actual quantity is less than requested, create unshipped items for the difference
          if (actualQuantity < requestedQuantity) {
            const orderItem = orderItems.find(item => item.id === orderItemId);
            
            if (orderItem) {
              // Calculate the quantity difference
              const quantityDifference = requestedQuantity - actualQuantity;
              
              // Check if an unshipped item already exists for this order and product
              const existingUnshippedItems = await storage.getUnshippedItemsByOrder(id);
              const duplicate = existingUnshippedItems.find(item => 
                item.productId === productId && 
                item.quantity === quantityDifference &&
                !item.shipped
              );
              
              if (!duplicate) {
                // Create an unshipped item record only if there isn't already one
                await storage.addUnshippedItem({
                  orderId: id,
                  productId,
                  quantity: quantityDifference,
                  customerName: originalOrder.customerName,
                  customerId: originalOrder.customerName,  // Using customerName as customerId for now
                  originalOrderNumber: originalOrder.orderNumber,
                  notes: `Partially fulfilled order. ${actualQuantity} out of ${requestedQuantity} shipped.`
                });
                
                console.log(`Created unshipped item for order ${id}, product ${productId}, quantity ${quantityDifference}`);
              } else {
                console.log(`Unshipped item already exists for order ${id}, product ${productId}, quantity ${quantityDifference}`);
              }
            }
          }
        }
      }
      
      // If status is being changed to shipped, check for any unshipped items
      // Note: We already checked for unshipped items and approval earlier, so we'll just
      // send a notification if needed
      if (status === 'shipped') {
        console.log(`Order ${id} being shipped, checking for unshipped items`);
        
        // Get unshipped items for this order and order items
        const unshippedItems = await storage.getUnshippedItemsByOrder(id);
        const orderItems = await storage.getOrderItems(id);
        
        // If there are unshipped items, send notification
        if (unshippedItems.length > 0) {
          // Send notification to managers about unshipped items that need authorization
          const notificationId = Math.random().toString(36).substring(2, 15);
          broadcastMessage({
            type: 'notification',
            notification: {
              id: notificationId,
              title: `Partial Order Fulfillment: ${originalOrder.orderNumber}`,
              message: `Order ${originalOrder.orderNumber} has been shipped with ${unshippedItems.length} unshipped items that require manager authorization.`,
              type: 'warning',
              timestamp: new Date(),
              read: false,
              orderId: id,
              orderNumber: originalOrder.orderNumber,
              requiresAuthorization: true,
              unshippedItems: unshippedItems.length
            }
          });
        }
      }
      
      // If the order is being cancelled, restore inventory for any picked items
      if (status === 'cancelled' && previousStatus === 'picked') {
        console.log(`Order ${id} is being cancelled, restoring inventory for picked items`);
        
        // Get all order items
        const orderItems = await storage.getOrderItems(id);
        
        // Process each item in the order and restore inventory
        for (const item of orderItems) {
          // Get the product
          const product = await storage.getProduct(item.productId);
          if (!product) {
            console.error(`Product ID ${item.productId} not found when processing cancelled order items`);
            continue;
          }
          
          // Increase the inventory for the cancelled item quantity
          const newStockLevel = product.currentStock + item.quantity;
          
          // Update the product stock with user attribution for tracking
          console.log(`Restoring inventory for product ${item.productId} from ${product.currentStock} to ${newStockLevel} (cancelled ${item.quantity})`);
          await storage.updateProduct(item.productId, { 
            currentStock: newStockLevel,
            lastStockUpdate: new Date()
          }, userId);
          
          // Record inventory change
          await storage.addInventoryChange({
            productId: item.productId,
            userId: userId || 1, // Default to admin if userId not provided
            changeType: 'order_cancellation',
            previousQuantity: product.currentStock,
            newQuantity: newStockLevel,
            quantityChanged: item.quantity, // Add the quantity changed (restored)
            reference: `Order ${originalOrder.orderNumber} cancelled`,
            notes: `Inventory restored after order cancellation`
          });
        }
      }
      
      // Update the order status
      const updatedOrder = await storage.updateOrderStatus(id, status, undefined, userId);
      
      // If this was an approved partial fulfillment, log it
      if (req.body.approvePartialFulfillment === true && userId) {
        await storage.addOrderChangelog({
          orderId: id,
          userId: userId,
          action: 'partial_approval',
          changes: { status },
          previousValues: { status: originalOrder.status },
          notes: `Partial order fulfillment approved by manager/admin`
        });
      }
      
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
  
  // Document upload for orders with optional status change
  app.post('/api/orders/:id/documents', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      
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
      const updateStatus = req.body.updateStatus === 'true' || req.body.updateStatus === true;
      
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
      
      // If updateStatus is true, update the order status to shipped
      if (updateStatus) {
        // Check for unshipped items that would require approval
        const unshippedItems = await storage.getUnshippedItemsByOrder(id);
        const userRole = (req.user as any)?.role;
        
        // If there are unshipped items, this is a partial fulfillment that requires manager approval
        if (unshippedItems.length > 0) {
          console.log(`Order ${id} being shipped with ${unshippedItems.length} unshipped items via document upload`);
          
          // Check if user has authorization to ship partial orders
          const hasApprovalPermission = userRole === 'admin' || userRole === 'manager';
          const isApproved = req.body.approvePartialFulfillment === 'true' || req.body.approvePartialFulfillment === true;
          
          // If this order has not been explicitly approved for partial fulfillment,
          // require approval EVEN for admin/manager - they must explicitly approve
          if (!isApproved) {
            console.log(`Document upload: Order ${id} requires explicit approval for partial fulfillment. User role: ${userRole}`);
            console.log('Sending approval required response with:', {
              orderId: id,
              unshippedItems: unshippedItems.length,
              isApproved,
              hasApprovalPermission,
              userRole
            });
            
            return res.status(403).json({
              message: "Partial order fulfillment requires explicit approval",
              requiresApproval: true,
              isPartialFulfillment: true,
              unshippedItems: unshippedItems.length,
              orderId: id,
              canApprove: hasApprovalPermission
            });
          }
          
          // Send notification to managers about unshipped items that need authorization
          const notificationId = Math.random().toString(36).substring(2, 15);
          broadcastMessage({
            type: 'notification',
            notification: {
              id: notificationId,
              title: `Partial Order Fulfillment: ${order.orderNumber}`,
              message: `Order ${order.orderNumber} has been shipped with ${unshippedItems.length} unshipped items that require manager authorization.`,
              type: 'warning',
              timestamp: new Date(),
              read: false,
              orderId: id,
              orderNumber: order.orderNumber,
              requiresAuthorization: true,
              unshippedItems: unshippedItems.length
            }
          });
        }
        
        // Proceed with shipping since we've passed the approval check
        await storage.updateOrderStatus(id, 'shipped', {
          documentPath,
          documentType,
          notes
        }, userId);
        
        // Create changelog for the approval if it was needed
        if (req.body.approvePartialFulfillment === 'true' || req.body.approvePartialFulfillment === true) {
          await storage.addOrderChangelog({
            orderId: id,
            userId: userId,
            action: 'partial_approval',
            changes: { status: 'shipped' },
            previousValues: { status: order.status },
            notes: `Partial order fulfillment approved by ${userRole}`
          });
          console.log(`Order ${id} partial fulfillment approved by ${userRole}`);
        }
      } else {
        // Check if a document already exists for this order
        const existingDocument = await storage.getShippingDocument(id);
        
        if (existingDocument) {
          // Update the existing document
          await storage.updateShippingDocument(existingDocument.id, {
            documentPath,
            documentType,
            notes: notes || null
          });
          console.log(`Order ${id} existing document updated`);
        } else {
          // Create a new document
          await storage.addShippingDocument({
            orderId: id,
            documentPath,
            documentType,
            notes: notes || null
          });
          console.log(`Order ${id} new document attached`);
        }
        
        // Send notification via WebSocket for document attachment
        broadcastMessage({
          type: 'documentUploaded',
          orderId: order.id,
          orderNumber: order.orderNumber,
          documentType
        });
      }
      
      // Get the updated document to send in the response
      const document = await storage.getShippingDocument(id);
      
      res.json({ 
        success: true, 
        documentPath,
        orderStatus: updateStatus ? 'shipped' : order.status,
        document
      });
    } catch (error: any) {
      console.error("Error uploading document:", error);
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
  
  // Get order changelogs
  app.get('/api/orders/:id/changelogs', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if order exists
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Get changelogs for this order
      const changelogs = await storage.getOrderChangelogs(id);
      
      // For each changelog, fetch the user to get the name
      const changelogsWithUserNames = await Promise.all(
        changelogs.map(async (log) => {
          try {
            const user = await storage.getUser(log.userId);
            return {
              ...log,
              user: user ? {
                id: user.id,
                username: user.username,
                fullName: user.fullName
              } : undefined
            };
          } catch (err) {
            return {
              ...log,
              user: undefined
            };
          }
        })
      );
      
      res.json(changelogsWithUserNames);
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
  
  // Get orders by customer name
  app.get('/api/customers/:id/orders', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id);
      
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      
      const orders = await storage.getOrdersByCustomer(customer.name);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Add endpoint to get orders by customer name directly (for persistence of area information)
  app.get('/api/orders/customer/:customerName', async (req, res) => {
    try {
      const { customerName } = req.params;
      
      if (!customerName) {
        return res.status(400).json({ message: 'Customer name is required' });
      }
      
      const orders = await storage.getOrdersByCustomer(customerName);
      res.json(orders);
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
  
  // Endpoint to get products that were ordered but not shipped for a customer
  app.get('/api/customers/:customerName/unshipped-products', async (req, res) => {
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
      
      // Get all official unshipped items for this customer
      const unshippedItems = await storage.getUnshippedItems(decodeURIComponent(customerName));
      
      // If we have unshipped items, use those first
      let result: any[] = [];
      if (unshippedItems.length > 0) {
        const productDetailsPromises = unshippedItems.map(async item => {
          const product = await storage.getProduct(item.productId);
          const order = customerOrders.find(o => o.id === item.orderId);
          if (product) {
            return {
              ...product,
              quantity: item.quantity,
              orderNumber: item.originalOrderNumber || (order ? order.orderNumber : 'Unknown'),
              orderDate: order ? order.orderDate : new Date().toISOString(),
              status: 'unshipped',
              notes: item.notes,
              unshippedItemId: item.id,
              authorized: item.authorized
            };
          }
          return null;
        });
        
        result = (await Promise.all(productDetailsPromises))
          .filter((item): item is any => item !== null);
      }
      
      // Also include items from incomplete orders (pending/picked)
      const incompleteOrders = customerOrders.filter(order => 
        order.status !== 'shipped' && order.status !== 'cancelled');
      
      if (incompleteOrders.length > 0) {
        // Get all order items for each incomplete order
        const unshippedProductsPromises = incompleteOrders.map(async order => {
          const orderItems = await storage.getOrderItems(order.id);
          return orderItems.map(item => ({
            ...item,
            orderNumber: order.orderNumber,
            orderDate: order.orderDate,
            status: order.status
          }));
        });
        
        const unshippedItemsArrays = await Promise.all(unshippedProductsPromises);
        const allUnshippedItems = unshippedItemsArrays.flat();
        
        // Get product details for each unshipped item
        const pendingProductDetailsPromises = allUnshippedItems.map(async item => {
          const product = await storage.getProduct(item.productId);
          if (product) {
            return {
              ...product,
              quantity: item.quantity,
              orderNumber: item.orderNumber,
              orderDate: item.orderDate,
              status: item.status,
              source: 'pending_order'
            };
          }
          return null;
        });
        
        const pendingProducts = (await Promise.all(pendingProductDetailsPromises))
          .filter(item => item !== null);
          
        // Combine both result arrays
        result = [...result, ...pendingProducts];
      }
      
      console.log(`Found ${result.length} unshipped products for customer ${customerName}`);
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching unshipped products:", error);
      res.status(500).json({ message: `Error fetching unshipped products: ${error.message}` });
    }
  });
  
  // New endpoint to check if a customer has unshipped items
  app.get('/api/customers/:customerName/has-unshipped-items', async (req, res) => {
    try {
      const { customerName } = req.params;
      if (!customerName) {
        return res.status(400).json({ message: "Customer name is required" });
      }
      
      // Get all unshipped items for this customer (including from shipped orders)
      const unshippedItems = await storage.getUnshippedItems(decodeURIComponent(customerName));
      
      console.log(`Found ${unshippedItems.length} unshipped items for customer ${customerName}`);
      
      // Check authorized unshipped items
      const hasAuthorizedUnshippedItems = unshippedItems.some(item => item.authorized);
      const hasUnauthorizedUnshippedItems = unshippedItems.some(item => !item.authorized);
      
      // Also check for pending orders that aren't yet fully shipped
      const allOrders = await storage.getAllOrders();
      const customerOrders = allOrders.filter(order => 
        order.customerName.toLowerCase() === decodeURIComponent(customerName).toLowerCase() &&
        (order.status === 'pending' || order.status === 'picked'));
      
      // Return data about unshipped items and pending orders
      res.json({
        hasUnshippedItems: unshippedItems.length > 0,
        unshippedItemsCount: unshippedItems.length,
        hasAuthorizedUnshippedItems,
        hasUnauthorizedUnshippedItems,
        pendingOrders: customerOrders.length,
      });
    } catch (error: any) {
      console.error("Error checking for unshipped items:", error);
      res.status(500).json({ 
        message: `Error checking for unshipped items: ${error.message}` 
      });
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
  
  // Inventory management routes
  app.get('/api/inventory/slow-moving', isAuthenticated, async (req, res) => {
    await getSlowMovingProducts(req, res);
  });
  
  app.post('/api/inventory/update-stock', isAuthenticated, async (req, res) => {
    await updateProductStock(req, res);
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
  
  app.get('/api/analytics/product-tags', async (req, res) => {
    try {
      // Get all products
      const products = await storage.getAllProducts();
      
      // Create a map to count products by tag
      const tagCounts = new Map<string, number>();
      
      // Count products for each tag
      for (const product of products) {
        if (product.tags && Array.isArray(product.tags)) {
          for (const tag of product.tags) {
            if (tag) {
              tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
          }
        }
      }
      
      // Convert to array of objects
      const data = Array.from(tagCounts.entries()).map(([name, value]) => ({
        name,
        value
      }));
      
      // Sort by count descending
      data.sort((a, b) => b.value - a.value);
      
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
  
  // New analytics endpoints for the enhanced reporting area
  app.get('/api/analytics/call-logs-summary', async (req, res) => {
    try {
      const timeframe = req.query.timeframe ? parseInt(req.query.timeframe as string) : 90; // Default to 90 days
      
      // Get all call logs within the timeframe
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - timeframe);
      
      const callLogs = await storage.getAllCallLogs(dateFrom.toISOString());
      
      // Calculate summary statistics
      const totalCalls = callLogs.length;
      
      // Group by call type
      const callsByType = callLogs.reduce((acc: Record<string, number>, log) => {
        const type = log.callType || 'other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      
      // Group by status
      const callsByStatus = callLogs.reduce((acc: Record<string, number>, log) => {
        const status = log.callStatus || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      
      // Format for chart display
      const callTypeData = Object.entries(callsByType).map(([name, value]) => ({ name, value }));
      const callStatusData = Object.entries(callsByStatus).map(([name, value]) => ({ name, value }));
      
      // Group by date for trend analysis
      const callsByDate: Record<string, number> = {};
      callLogs.forEach(log => {
        const date = new Date(log.callDate).toISOString().split('T')[0];
        callsByDate[date] = (callsByDate[date] || 0) + 1;
      });
      
      // Convert to array and sort by date
      const trendData = Object.entries(callsByDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      res.json({
        totalCalls,
        callTypeData,
        callStatusData,
        trendData
      });
    } catch (error: any) {
      console.error('Error generating call logs summary:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/analytics/customer-engagement', async (req, res) => {
    try {
      // Get all customers and their call logs
      const customers = await storage.getAllCustomers();
      const callLogs = await storage.getAllCallLogs();
      
      // Calculate engagement metrics
      let totalInteractions = 0;
      const customerEngagement = customers.map(customer => {
        // Get calls for this customer
        const customerCalls = callLogs.filter(log => log.customerId === customer.id);
        const callCount = customerCalls.length;
        
        // Get most recent interaction
        const lastInteractionDate = customerCalls.length > 0 
          ? new Date(Math.max(...customerCalls.map(c => new Date(c.callDate).getTime())))
          : null;
        
        totalInteractions += callCount;
        
        return {
          id: customer.id,
          name: customer.name,
          callCount,
          lastInteractionDate,
          // Calculate days since last interaction
          daysSinceLastInteraction: lastInteractionDate 
            ? Math.floor((new Date().getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24))
            : null
        };
      });
      
      // Sort by engagement (call count)
      const sortedByEngagement = [...customerEngagement].sort((a, b) => b.callCount - a.callCount);
      
      // Get top engaged customers
      const topEngagedCustomers = sortedByEngagement.slice(0, 10);
      
      // Calculate engagement segments
      const activeCustomers = customerEngagement.filter(c => c.callCount > 0 && c.daysSinceLastInteraction !== null && c.daysSinceLastInteraction < 30).length;
      const atRiskCustomers = customerEngagement.filter(c => c.callCount > 0 && c.daysSinceLastInteraction !== null && c.daysSinceLastInteraction >= 30 && c.daysSinceLastInteraction < 90).length;
      const dormantCustomers = customerEngagement.filter(c => c.daysSinceLastInteraction === null || c.daysSinceLastInteraction >= 90).length;
      
      // Calculate average calls per customer
      const avgCallsPerCustomer = customers.length > 0 ? totalInteractions / customers.length : 0;
      
      res.json({
        totalCustomers: customers.length,
        totalInteractions,
        avgCallsPerCustomer,
        engagementSegments: [
          { name: 'Active (< 30 days)', value: activeCustomers },
          { name: 'At Risk (30-90 days)', value: atRiskCustomers },
          { name: 'Dormant (> 90 days)', value: dormantCustomers }
        ],
        topEngagedCustomers
      });
    } catch (error: any) {
      console.error('Error generating customer engagement analytics:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/analytics/order-quality-summary', async (req, res) => {
    try {
      const period = req.query.period ? parseInt(req.query.period as string) : 90;
      
      // Get error statistics
      const errorStats = await storage.getErrorStats(period);
      
      // Get additional insight for error trends
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);
      
      const orderErrors = await storage.getOrderErrors();
      const recentErrors = orderErrors.filter(err => 
        new Date(err.reportDate) >= startDate
      );
      
      // Calculate resolution metrics
      const resolvedErrors = recentErrors.filter(err => err.resolved);
      const unresolvedErrors = recentErrors.filter(err => !err.resolved);
      const avgResolutionTime = resolvedErrors.length > 0 
        ? resolvedErrors.reduce((acc, err) => {
            if (err.resolvedDate) {
              const reportDate = new Date(err.reportDate);
              const resolvedDate = new Date(err.resolvedDate);
              return acc + (resolvedDate.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24); // in days
            }
            return acc;
          }, 0) / resolvedErrors.length
        : 0;
      
      res.json({
        ...errorStats,
        totalErrorsInPeriod: recentErrors.length,
        resolvedErrorsCount: resolvedErrors.length,
        unresolvedErrorsCount: unresolvedErrors.length,
        resolutionRate: recentErrors.length > 0 ? (resolvedErrors.length / recentErrors.length) * 100 : 0,
        avgResolutionTimeInDays: avgResolutionTime,
        // Group errors by root cause for insights
        rootCauseAnalysis: resolvedErrors.reduce((acc: Record<string, number>, err) => {
          const rootCause = err.rootCause || 'Unknown';
          acc[rootCause] = (acc[rootCause] || 0) + 1;
          return acc;
        }, {})
      });
    } catch (error: any) {
      console.error('Error generating order quality summary:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/analytics/prospective-customer-pipeline', async (req, res) => {
    try {
      const prospects = await storage.getAllProspectiveCustomers();
      
      // Group by status
      const statusCounts: Record<string, number> = {};
      prospects.forEach(prospect => {
        const status = prospect.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      // Convert to chart-friendly format
      const pipelineData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
      
      // Calculate conversion rate
      const convertedCount = statusCounts['converted'] || 0;
      const conversionRate = prospects.length > 0 ? (convertedCount / prospects.length) * 100 : 0;
      
      // Calculate average time in pipeline for converted prospects
      // (This would require more data than we currently have, like status change timestamps)
      
      res.json({
        totalProspects: prospects.length,
        pipelineData,
        conversionRate
      });
    } catch (error: any) {
      console.error('Error generating prospective customer pipeline report:', error);
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
      // Debug log
      console.log("Creating user with data:", JSON.stringify(req.body));
      
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
        console.error("Validation error details:", JSON.stringify(error.errors));
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error("Error creating user:", error.message);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update user (admin only)
  app.patch('/api/users/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      console.log("Update user request body:", req.body);
      
      // Parse with partial schema to allow updating only some fields
      const userData = insertUserSchema.partial().parse(req.body);
      
      console.log("Validated user data:", userData);
      
      // Check if there's anything to update
      if (Object.keys(userData).length === 0) {
        return res.status(400).json({ message: 'No values to update' });
      }
      
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
      console.error("Error updating user:", error);
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
  // Modified category endpoints for backward compatibility with simplified system
  app.get('/api/categories', async (req, res) => {
    try {
      // Return a single default category for backward compatibility
      res.json([
        { 
          id: 1, 
          name: 'All Products',
          description: 'Default category for all products in the simplified system',
          createdAt: new Date()
        }
      ]);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/categories/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Only category ID 1 exists in the simplified system
      if (id !== 1) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      // Return the default category
      res.json({
        id: 1,
        name: 'All Products',
        description: 'Default category for all products in the simplified system',
        createdAt: new Date()
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // In the simplified system, categories can't be created, updated or deleted
  app.post('/api/categories', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      // No new categories can be created in the simplified system
      res.status(403).json({ 
        message: 'Category creation is disabled in the simplified system' 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch('/api/categories/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Only category ID 1 exists in the simplified system
      if (id !== 1) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      // Categories can't be modified in the simplified system
      res.status(403).json({ 
        message: 'Category modification is disabled in the simplified system' 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.delete('/api/categories/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Only category ID 1 exists in the simplified system
      if (id !== 1) {
        return res.status(404).json({ message: 'Category not found' });
      }
      
      // The default category can't be deleted
      res.status(403).json({ 
        message: 'The default category cannot be deleted in the simplified system' 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Tag management routes
  app.get('/api/tags', async (req, res) => {
    try {
      const tags = await storage.getAllTags();
      return res.status(200).json(tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/tags/:id', async (req, res) => {
    try {
      const tagId = parseInt(req.params.id, 10);
      const tag = await storage.getTag(tagId);
      
      if (tag) {
        return res.status(200).json(tag);
      } else {
        return res.status(404).json({ message: 'Tag not found' });
      }
    } catch (error) {
      console.error('Error fetching tag:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/tags', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const tagData = insertTagSchema.parse(req.body);
      const newTag = await storage.createTag(tagData);
      return res.status(201).json(newTag);
    } catch (error) {
      console.error('Error creating tag:', error);
      return res.status(400).json({ message: 'Invalid tag data', error: (error as any).message });
    }
  });

  app.patch('/api/tags/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const tagId = parseInt(req.params.id, 10);
      const tag = await storage.updateTag(tagId, req.body);
      
      if (tag) {
        return res.status(200).json(tag);
      } else {
        return res.status(404).json({ message: 'Tag not found' });
      }
    } catch (error) {
      console.error('Error updating tag:', error);
      return res.status(400).json({ message: 'Invalid tag data', error: (error as any).message });
    }
  });

  app.delete('/api/tags/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const tagId = parseInt(req.params.id, 10);
      const deleted = await storage.deleteTag(tagId);
      
      if (deleted) {
        return res.status(200).json({ message: 'Tag deleted successfully' });
      } else {
        return res.status(404).json({ message: 'Tag not found' });
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Product Tags API Endpoint
  app.get('/api/products/:id/tags', async (req, res) => {
    try {
      const productId = parseInt(req.params.id, 10);
      const tags = await storage.getProductTags(productId);
      return res.status(200).json(tags);
    } catch (error) {
      console.error('Error fetching product tags:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/products/:id/tags', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const productId = parseInt(req.params.id, 10);
      const { tagIds } = req.body;
      
      if (!tagIds || !Array.isArray(tagIds)) {
        return res.status(400).json({ message: 'tagIds array is required' });
      }
      
      await storage.updateProductTags(productId, tagIds);
      const tags = await storage.getProductTags(productId);
      return res.status(200).json(tags);
    } catch (error) {
      console.error('Error updating product tags:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create WebSocket server with ping timeout
  wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Adding client tracking - default WebSocketServer doesn't track clients for us
    clientTracking: true,
  });
  
  // Set up heartbeat detection
  function heartbeat(this: WebSocket) {
    // @ts-ignore - Adding a custom property to track client activity
    this.isAlive = true;
  }
  
  // Periodically check for inactive clients
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      // @ts-ignore - Check custom isAlive property
      if (ws.isAlive === false) {
        console.log('[websocket] Terminating inactive client');
        return ws.terminate();
      }
      
      // @ts-ignore - Mark as inactive until we get a pong response
      ws.isAlive = false;
      // Send a ping to check if client is still responsive
      ws.ping();
    });
  }, 30000); // Check every 30 seconds
  
  // Cleanup interval on server close
  wss.on('close', () => {
    clearInterval(interval);
  });
  
  wss.on('connection', (ws: WebSocket) => {
    // Add client to the set
    clients.add(ws);
    console.log('[websocket] Client connected. Total clients:', clients.size);
    
    // Initialize the connection as alive
    // @ts-ignore - Custom property to track client activity
    ws.isAlive = true;
    
    // Handle pong responses from client
    ws.on('pong', heartbeat);
    
    // Handle client messages (including ping)
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle ping messages from client
        if (data.type === 'ping') {
          // Send pong back to client
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('[websocket] Error parsing message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      clients.delete(ws);
      console.log('[websocket] Client disconnected. Total clients:', clients.size);
    });
    
    // Handle connection errors
    ws.on('error', (error) => {
      console.error('[websocket] Connection error:', error);
      // Try to gracefully clean up
      try {
        clients.delete(ws);
      } catch (e) {
        console.error('[websocket] Error during cleanup:', e);
      }
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to notification server',
      timestamp: Date.now()
    }));
  });
  
  // Promisify exec to use with async/await
  const execPromise = promisify(exec);
  
  // Endpoint for printing shipping labels with CAB EOS1 printer
  app.post('/api/print/shipping-label', isAuthenticated, async (req, res) => {
    try {
      const { labelContent, orderId, boxNumber, totalBoxes } = req.body;
      
      if (!labelContent) {
        return res.status(400).json({ message: 'Label content is required' });
      }
      
      if (!boxNumber || !totalBoxes) {
        return res.status(400).json({ message: 'Box number and total boxes are required' });
      }
      
      // Log the exact user-specified values to ensure they are preserved
      console.log(`[printer] Received exact box count from user input: ${totalBoxes}`);
      console.log(`[printer] Current box number to print: ${boxNumber}`);
      
      // Import direct printer service (dynamically to avoid circular dependencies)
      const { directPrinter } = await import('./services/directPrinting');
      
      console.log(`[printer] Preparing to print label for order ${orderId}, box ${boxNumber} of ${totalBoxes}`);
      
      try {
        // Send print command directly to the CAB EOS1 printer
        console.log(`[printer] Sending label to CAB EOS1 printer`);
        
        // Use our direct printing service for automatic printing
        const identifier = `order_${orderId}_box_${boxNumber}`;
        const printResult = await directPrinter.printContent(labelContent, identifier);
        
        // Log the print result
        if (printResult.success) {
          console.log(`[printer] ${printResult.message}`);
        } else {
          console.error(`[printer] Print failed: ${printResult.message}`);
        }
        
        // Send notification via WebSocket regardless of print success
        // This allows the UI to show feedback to the user
        broadcastMessage({
          type: 'labelPrinted',
          orderId,
          boxNumber,
          totalBoxes,
          success: printResult.success,
          message: printResult.message
        });
        
        // Add to order changelog
        const userId = (req.user as any)?.id || 1;
        await storage.addOrderChangelog({
          orderId,
          userId,
          action: 'label_printed',
          changes: {
            boxNumber,
            totalBoxes,
            success: printResult.success
          },
          notes: printResult.success 
            ? `Printed shipping label for box ${boxNumber} of ${totalBoxes}` 
            : `Attempted to print shipping label for box ${boxNumber} of ${totalBoxes}, but encountered an issue: ${printResult.message}`
        });
        
        res.json({ 
          success: true, 
          message: `Shipping label for order ${orderId}, box ${boxNumber} of ${totalBoxes} has been sent to printer`,
          printResult: printResult
        });
      } catch (printError: any) {
        console.error('[printer] Error sending to printer:', printError);
        res.status(500).json({ 
          message: 'Error sending label to printer', 
          details: printError.message 
        });
      }
    } catch (error: any) {
      console.error('[printer] Error processing label print request:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // New improved shipping label endpoint
  app.get('/api/orders/:id/new-shipping-label', async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id, 10);
      const boxNumber = parseInt(req.query.boxNumber as string, 10) || 1;
      const boxCount = parseInt(req.query.boxCount as string, 10) || 1;
      
      if (isNaN(orderId)) {
        return res.status(400).json({ message: 'Invalid order ID' });
      }
      
      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Get shipping company from the customer data
      let shippingCompany = "N/A";
      try {
        // Find customer based on order's customer name
        const customerData = await storage.getCustomerByName(order.customerName);
        if (customerData) {
          // Use the correct shipping company information based on preference
          console.log("Customer shipping data:", {
            preferredShippingCompany: customerData.preferredShippingCompany,
            billingCompany: customerData.billingCompany,
            shippingCompany: customerData.shippingCompany
          });
          
          if (customerData.preferredShippingCompany === 'other' && customerData.billingCompany) {
            shippingCompany = customerData.billingCompany;
          } else if (customerData.shippingCompany) {
            shippingCompany = customerData.shippingCompany;
          }
        }
        console.log(`Shipping company for ${order.customerName}: ${shippingCompany}`);
      } catch (error) {
        console.error("Error getting shipping company:", error);
      }
      
      // Generate HTML version of the label
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Shipping Label - Order ${order.orderNumber}</title>
  <style>
    @page {
      size: 9cm 6cm;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      width: 9cm;
      height: 6cm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      transform: translateY(-3mm) scale(0.95);
      transform-origin: top center;
    }
    .label-container {
      padding: 0.3cm;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .logo {
      text-align: center;
      margin-bottom: 0.1cm;
    }
    .logo img {
      height: 0.8cm;
      max-width: 80%;
    }
    .order-number {
      font-size: 10pt;
      font-weight: bold;
      margin-bottom: 0.1cm;
    }
    .customer {
      font-size: 9pt;
      margin-bottom: 0.1cm;
    }
    .shipping {
      font-size: 10pt;
      font-weight: bold;
      margin-bottom: 0.1cm;
      background-color: #f8f8f8;
      padding: 0.1cm;
      border-left: 3px solid #666;
    }
    .box-number {
      font-size: 11pt;
      font-weight: bold;
      text-align: center;
      margin: 0.1cm 0;
      border: 1px solid #ccc;
      background-color: #f0f0f0;
      padding: 0.1cm;
    }
  </style>
</head>
<body>
  <div class="label-container">
    <div class="logo">
      <img src="/shipping-logo.png" onerror="this.src='/simple-logo.svg'; this.onerror=function(){this.outerHTML='<div style=\\'font-weight:bold;font-size:12pt;\\'>OLIVE OIL COMPANY</div>'}">
    </div>
    <div class="order-number">Order: ${order.orderNumber}</div>
    <div class="customer">Customer: ${order.customerName}</div>
    <div class="shipping">Shipping: ${shippingCompany}</div>
    <div class="box-number">BOX ${boxNumber} OF ${boxCount}</div>
  </div>
</body>
</html>`;
      
      // Log this action
      const userId = (req.user as any)?.id || 1;
      await storage.addOrderChangelog({
        orderId,
        userId,
        action: 'label_printed',
        changes: {
          boxNumber,
          boxCount
        },
        notes: `Generated new shipping label for box ${boxNumber} of ${boxCount}`
      }).catch(err => {
        console.warn('Failed to log label generation:', err);
      });
      
      // Return only HTML version
      res.json({
        html,
        boxNumber,
        boxCount
      });
    } catch (error: any) {
      console.error('Error generating shipping label:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate shipping label for multi-label printing
  app.get('/api/orders/:id/generate-label', async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id, 10);
      const boxNumber = parseInt(req.query.boxNumber as string, 10) || 1;
      const boxCount = parseInt(req.query.boxCount as string, 10) || 1;
      
      if (isNaN(orderId)) {
        return res.status(400).json({ message: 'Invalid order ID' });
      }
      
      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Get shipping company from the customer data
      let shippingCompany = "N/A";
      try {
        // Find customer based on order's customer name
        const customerData = await storage.getCustomerByName(order.customerName);
        if (customerData) {
          // Use the correct shipping company information based on preference
          console.log("Customer shipping data:", {
            preferredShippingCompany: customerData.preferredShippingCompany,
            billingCompany: customerData.billingCompany,
            shippingCompany: customerData.shippingCompany
          });
          
          if (customerData.preferredShippingCompany === 'other' && customerData.billingCompany) {
            shippingCompany = customerData.billingCompany;
          } else if (customerData.shippingCompany) {
            shippingCompany = customerData.shippingCompany;
          }
        }
        console.log(`Shipping company for ${order.customerName}: ${shippingCompany}`);
      } catch (error) {
        console.error("Error getting shipping company:", error);
      }
      
      // Generate JScript label content - removed barcodes
      const jscript = `
m m
J
H 100,0,T
S l1;0,0,68,71,100

; Logo will be printed separately from the HTML template
T 25,25,0,3,pt9;Παραγγελία: ${order.orderNumber}
T 25,50,0,3,pt8;Πελάτης: ${order.customerName}
T 25,100,0,3,pt12;ΚΙΒΩΤΙΟ ${boxNumber} ΑΠΟ ${boxCount}
T 25,130,0,3,pt10;${shippingCompany}
A 1
`;
      
      // Generate HTML version of the label - simplified clean version with no barcodes
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Shipping Label - Order ${order.orderNumber}</title>
  <style>
    @page {
      size: 9cm 6cm;
      margin: 0;
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
    }
    .label-container {
      width: 9cm; 
      height: 6cm;
      padding: 0.3cm;
      box-sizing: border-box;
      position: relative;
      background-color: white;
    }
    .logo {
      display: block;
      max-width: 150px;
      max-height: 45px;
      margin-bottom: 10px;
      margin-left: auto;
      margin-right: auto;
    }
    .customer-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .customer-address, .customer-phone {
      font-size: 12px;
      margin-bottom: 4px;
    }
    .shipping-company {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 8px;
      border-left: 3px solid #666;
      padding-left: 4px;
      background-color: #f8f8f8;
    }
    .box-count {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      border: 1px solid #ccc;
      background-color: #f0f0f0;
      padding: 4px;
      margin-top: auto;
    }
    .order-number {
      font-size: 12px;
      margin-bottom: 5px;
    }
    .label-content {
      display: flex;
      flex-direction: column;
      height: calc(6cm - 0.6cm - 45px);
    }
    .customer-info {
      margin-bottom: 8px;
    }
    .spacer {
      flex-grow: 1;
    }
  </style>
</head>
<body>
  <div class="label-container">
    <img src="/shipping-logo.png" class="logo" alt="Company Logo" onerror="this.src='/simple-logo.svg'; this.onerror=null; this.style.display='none';" />
    
    <div class="label-content">
      <div class="customer-info">
        <div class="order-number">Αρ. Παραγγελίας: ${order.orderNumber}</div>
        <div class="customer-name">${order.customerName}</div>
        <div class="customer-address"></div>
        <div class="customer-phone">Τηλέφωνο: </div>
        <div class="shipping-company">Μεταφορική: ${shippingCompany}</div>
      </div>
      
      <div class="spacer"></div>
      
      <div class="box-count">Κιβώτιο: ${boxNumber} / ${boxCount}</div>
    </div>
  </div>
</body>
</html>
`;
      
      // Log this action
      const userId = (req.user as any)?.id || 1;
      await storage.addOrderChangelog({
        orderId,
        userId,
        action: 'label_printed',  // Using proper action type from schema
        changes: {
          boxNumber,
          boxCount
        },
        notes: `Generated shipping label for box ${boxNumber} of ${boxCount}`
      }).catch(err => {
        console.warn('Failed to log label generation:', err);
      });
      
      // Return only HTML version - we're deprecating the JScript approach
      res.json({
        html,
        boxNumber,
        boxCount
      });
    } catch (error: any) {
      console.error('Error generating shipping label:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Log label printing (for browser-based printing)
  app.post('/api/orders/log-label-print', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { orderId, boxCount, method } = req.body;
      
      if (!orderId || !boxCount) {
        return res.status(400).json({ 
          message: 'Missing required fields: orderId and boxCount are required' 
        });
      }
      
      // Add to order changelog
      const userId = (req.user as any)?.id || 1;
      await storage.addOrderChangelog({
        orderId,
        userId,
        action: 'label_printed',  // Using existing action type to avoid TypeScript errors
        changes: { 
          boxCount, 
          method: method || 'browser-print',
          browserPrint: true
        },
        notes: `${boxCount} shipping label(s) generated using browser-based printing`
      });
      
      return res.json({ 
        success: true, 
        message: `Successfully logged ${boxCount} label(s) printed for order ${orderId}` 
      });
    } catch (error: any) {
      console.error('Error logging label printing:', error);
      return res.status(500).json({ 
        message: error.message || 'Error logging label printing' 
      });
    }
  });
  
  // Email settings routes
  app.get('/api/email-settings', isAuthenticated, hasRole(['admin']), getEmailSettings);
  
  app.put('/api/email-settings', isAuthenticated, hasRole(['admin']), updateEmailSettings);
  
  app.post('/api/email-settings/test-connection', isAuthenticated, hasRole(['admin']), testEmailConnection);
  
  // Email template routes
  app.get('/api/email-settings/templates/:templateName', isAuthenticated, hasRole(['admin']), getEmailTemplate);
  
  app.put('/api/email-settings/templates/:templateName', isAuthenticated, hasRole(['admin']), updateEmailTemplate);
  
  // Label template routes
  app.get('/api/label-templates/:templateName', isAuthenticated, hasRole(['admin', 'warehouse']), getLabelTemplate);
  
  app.put('/api/label-templates/:templateName', isAuthenticated, hasRole(['admin']), updateLabelTemplate);
  
  app.post('/api/label-templates/:templateName/preview', previewLabelTemplate);
  
  // Company settings routes
  app.get('/api/company-settings', isAuthenticated, getCompanySettings);
  
  app.put('/api/company-settings', isAuthenticated, hasRole(['admin']), updateCompanySettings);
  
  // Notification settings routes
  app.get('/api/notification-settings', isAuthenticated, getNotificationSettings);
  
  app.put('/api/notification-settings', isAuthenticated, hasRole(['admin']), updateNotificationSettings);
  
  // Slack webhook test route
  app.post('/api/settings/test-slack', isAuthenticated, hasRole(['admin']), testSlackWebhook);
  
  // Barcode scanning endpoints
  app.get('/api/products/barcode/:barcode', isAuthenticated, getProductByBarcode);
  app.post('/api/barcode-logs', isAuthenticated, logBarcodeScan);
  app.get('/api/barcode-logs/history', isAuthenticated, getBarcodeScanHistory);
  app.post('/api/inventory/update-by-barcode', isAuthenticated, updateInventoryByBarcode);
  
  // DEBUG: Temporary endpoint to check notification settings without auth - REMOVE IN PRODUCTION
  app.get('/api/debug/notification-settings', async (req, res) => {
    try {
      const settings = await storage.getNotificationSettings();
      
      // Log notification settings for debugging
      console.log('DEBUG Retrieved notification settings:', {
        slackEnabled: settings?.slackEnabled,
        slackWebhookUrl: settings?.slackWebhookUrl ? `***${settings.slackWebhookUrl.substring(0, 10)}...` : 'Not set',
        slackNotifyNewOrders: settings?.slackNotifyNewOrders,
        slackNotifyCallLogs: settings?.slackNotifyCallLogs,
        slackNotifyLowStock: settings?.slackNotifyLowStock,
        hasOrderTemplate: !!settings?.slackOrderTemplate,
        APP_URL: process.env.APP_URL || 'Not set'
      });
      
      res.json({
        success: true,
        message: 'Check server logs for notification settings details',
        settings: {
          slackEnabled: settings?.slackEnabled ?? false,
          slackNotifyNewOrders: settings?.slackNotifyNewOrders ?? false,
          hasWebhookUrl: !!settings?.slackWebhookUrl,
          hasOrderTemplate: !!settings?.slackOrderTemplate,
          APP_URL: process.env.APP_URL || 'Not set'
        }
      });
    } catch (error: any) {
      console.error('Error getting notification settings for debug:', error);
      res.status(500).json({ message: 'Failed to get notification settings' });
    }
  });
  
  // DEBUG: Test Slack notification for order without auth - REMOVE IN PRODUCTION
  app.get('/api/debug/test-slack-order', async (req, res) => {
    try {
      // Create a test order
      const testOrder = {
        id: 9999,
        orderNumber: 'TEST-999',
        customerName: 'Test Customer (via Debug API)',
        orderDate: new Date(),
        status: 'pending' as const,
        notes: 'Test order created via debug API',
        area: 'Test Area', // Add area field
        hasShippingDocument: false,
        isPartialFulfillment: false,
        partialFulfillmentApproved: false,
        partialFulfillmentApprovedById: null,
        partialFulfillmentApprovedAt: null,
        percentage_shipped: '0',
        estimatedShippingDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        actualShippingDate: null,
        priority: 'medium' as const, // Add priority field
        createdById: 1,
        updatedById: null,
        lastUpdated: null
      };
      
      console.log('Testing Slack notification with order:', testOrder);
      console.log('APP_URL:', process.env.APP_URL);
      
      try {
        // Send notification
        const result = await slackService.notifyNewOrder(testOrder);
        
        if (result) {
          console.log('✅ Slack notification sent successfully');
        } else {
          console.error('❌ Slack notification failed');
        }
        
        // Return order and result
        res.json({
          success: result,
          message: result ? 'Slack notification sent successfully' : 'Failed to send notification',
          testOrder
        });
      } catch (error) {
        console.error('Error sending test Slack notification:', error);
        res.status(500).json({ 
          success: false,
          message: 'Error during Slack notification',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error: any) {
      console.error('Error in test-slack-order endpoint:', error);
      res.status(500).json({ message: 'Failed to test Slack notification' });
    }
  });
  
  // Test send a notification with custom template
  app.post('/api/settings/test-slack-notification', isAuthenticated, hasRole(['admin']), testSlackNotification);
  
  // Test send notifications with all templates
  app.post('/api/settings/test-slack-templates', isAuthenticated, hasRole(['admin']), testSlackTemplate);
  
  // Role permissions management routes
  app.get('/api/role-permissions', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const allPermissions = await storage.getAllRolePermissions();
      res.json(allPermissions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get('/api/role-permissions/:role', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const role = req.params.role;
      const rolePermissions = await storage.getRolePermissions(role);
      res.json(rolePermissions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post('/api/role-permissions', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const { role, permission, enabled } = req.body;
      
      if (!role || !permission || enabled === undefined) {
        return res.status(400).json({ message: "Role, permission, and enabled status are required" });
      }
      
      const result = await storage.updateRolePermission(role, permission, enabled);
      
      if (result) {
        res.json(result);
      } else {
        res.status(400).json({ message: "Failed to update permission" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Route to migrate product images to the persistent storage
  app.post('/api/migrate-images', isAuthenticated, hasRole(['admin']), migrateImages);
  
  // Temporary endpoint for fixing missing images without auth (for deployment)
  app.get('/api/fix-product-images', async (req, res) => {
    try {
      console.log('Running image fix script...');
      
      // Ensure our storage directories exist
      if (!fs.existsSync(PRODUCTS_UPLOAD_PATH)) {
        fs.mkdirSync(PRODUCTS_UPLOAD_PATH, { recursive: true });
      }
      
      // Create symbolic link to ensure public access
      ensurePublicAccess(PRODUCTS_UPLOAD_PATH, 'uploads/products');
      
      // Get all products from the database
      const products = await storage.getAllProducts();
      console.log(`Found ${products.length} products in the database`);
      
      let placeholderCount = 0;
      let errorCount = 0;
      let results: any[] = [];
      
      // Get the placeholder image path
      const placeholderPath = path.join(process.cwd(), 'public/placeholder-image.png');
      if (!fs.existsSync(placeholderPath)) {
        console.error('Placeholder image not found at', placeholderPath);
        return res.status(500).json({ error: 'Placeholder image not found' });
      }
      
      // Process each product with an image
      for (const product of products) {
        if (product.imagePath) {
          try {
            // Get the filename from the path
            const filename = path.basename(product.imagePath);
            
            // Define the target path
            const targetPath = path.join(PRODUCTS_UPLOAD_PATH, filename);
            
            // Check if the image already exists in the storage location
            if (fs.existsSync(targetPath)) {
              console.log(`Image ${filename} already exists in the storage location`);
              results.push({
                productId: product.id,
                imagePath: product.imagePath,
                status: 'already_exists'
              });
              continue;
            }
            
            // Copy the placeholder image to the target path
            fs.copyFileSync(placeholderPath, targetPath);
            console.log(`Created placeholder image for product ${product.id}: ${filename}`);
            results.push({
              productId: product.id,
              imagePath: product.imagePath,
              status: 'placeholder_created'
            });
            placeholderCount++;
          } catch (err) {
            console.error(`Error creating placeholder for product ${product.id}:`, err);
            results.push({
              productId: product.id,
              imagePath: product.imagePath,
              status: 'error',
              error: err instanceof Error ? err.message : String(err)
            });
            errorCount++;
          }
        }
      }
      
      console.log('Placeholder creation complete!');
      console.log(`Successfully created placeholders: ${placeholderCount}`);
      console.log(`Errors: ${errorCount}`);
      
      res.json({
        success: true,
        created: placeholderCount,
        errors: errorCount,
        results
      });
    } catch (error) {
      console.error('Error during placeholder creation:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Route to check a specific permission for the current user
  app.get('/api/check-permission/:permission', isAuthenticated, async (req, res) => {
    try {
      const permission = req.params.permission;
      const userRole = (req.user as any)?.role || '';
      
      if (!userRole) {
        return res.status(403).json({ hasPermission: false });
      }
      
      const hasPermission = await storage.checkPermission(userRole, permission);
      res.json({ hasPermission });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Email notification endpoint for shipped orders
  app.post('/api/orders/:id/send-email', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      if (order.status !== 'shipped') {
        return res.status(400).json({ message: 'Can only send email notifications for shipped orders' });
      }
      
      const items = await storage.getOrderItems(order.id);
      
      // Get associated products
      const itemsWithProducts = await Promise.all(
        items.map(async (item) => {
          const product = await storage.getProduct(item.productId);
          return {
            productId: item.productId,
            quantity: item.quantity,
            name: product?.name || 'Unknown Product',
            sku: product?.sku || 'N/A'
          };
        })
      );
      
      // Get customer information by customer name
      // Since orders table stores customerName, not customerId
      const customers = await storage.searchCustomers(order.customerName);
      const customer = customers.length > 0 ? customers[0] : null;
      
      if (!customer) {
        return res.status(400).json({ message: 'Customer information not found. Make sure customer exists in database.' });
      }
      
      // Check if the customer has an email address, if not, return a gentle message
      if (!customer.email) {
        return res.status(200).json({ 
          success: false, 
          message: 'Customer does not have an email address. Email notification skipped.' 
        });
      }
      
      // Send the email
      const emailSent = await sendOrderShippedEmail(order, customer, itemsWithProducts);
      
      if (emailSent) {
        // Create a changelog entry
        await storage.addOrderChangelog({
          orderId: order.id,
          userId: (req.user as any)?.id || 1,
          action: 'email_sent',
          changes: { emailSent: true },
          notes: 'Shipping notification email sent to customer'
        });
        
        // Notify connected clients
        broadcastMessage({
          type: 'emailSent',
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerEmail: customer.email
        });
        
        res.json({ success: true, message: `Email notification sent to ${customer.email}` });
      } else {
        res.status(500).json({ message: 'Failed to send email notification' });
      }
    } catch (error: any) {
      console.error('Error sending order notification email:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Order Error routes (supporting both old and new endpoint patterns)
  // Old endpoints
  app.get('/api/order-errors', isAuthenticated, getOrderErrors);
  app.get('/api/order-errors/:id', isAuthenticated, getOrderQuality);
  app.post('/api/order-errors', isAuthenticated, createOrderError);
  app.patch('/api/order-errors/:id', isAuthenticated, updateOrderError);
  app.post('/api/order-errors/:id/resolve', isAuthenticated, resolveOrderError);
  app.post('/api/order-errors/:id/adjust-inventory', isAuthenticated, hasRole(['admin']), adjustInventoryForError);
  app.get('/api/order-errors-stats', isAuthenticated, getErrorStats);
  
  // New endpoints (order-quality)
  app.get('/api/order-quality', isAuthenticated, getOrderErrors);
  app.get('/api/order-quality/:id', isAuthenticated, getOrderQuality);
  app.post('/api/order-quality', isAuthenticated, createOrderError);
  app.patch('/api/order-quality/:id', isAuthenticated, updateOrderError);
  app.post('/api/order-quality/:id/resolve', isAuthenticated, resolveOrderError);
  app.post('/api/order-quality/:id/adjust-inventory', isAuthenticated, hasRole(['admin']), adjustInventoryForError);
  app.get('/api/order-quality-stats', isAuthenticated, getErrorStats);
  
  // Inventory Change Tracking routes
  app.get('/api/inventory-changes', isAuthenticated, getInventoryChanges);
  app.get('/api/inventory-changes/:id', isAuthenticated, getInventoryChange);
  app.post('/api/inventory-changes', isAuthenticated, hasRole(['admin', 'warehouse']), addInventoryChange);
  app.get('/api/inventory-changes/recent', isAuthenticated, getRecentInventoryChanges);
  app.get('/api/inventory-changes/by-type/:type', isAuthenticated, getInventoryChangesByType);
  
  // Barcode scanning routes
  app.get('/api/products/barcode/:barcode', isAuthenticated, async (req, res) => {
    try {
      const { barcode } = req.params;
      
      if (!barcode) {
        return res.status(400).json({ error: 'Barcode parameter is required' });
      }
      
      // First try exact barcode match
      let product = await storage.getProductByBarcode(barcode);
      
      // If product not found by barcode, try SKU as fallback
      if (!product) {
        product = await storage.getProductBySku(barcode);
      }
      
      if (!product) {
        return res.status(404).json({ error: 'Product not found with this barcode' });
      }
      
      // Get product category name
      const category = product.categoryId ? await storage.getCategory(product.categoryId) : null;
      
      // Return enhanced product info
      return res.status(200).json({
        ...product,
        categoryName: category?.name || null
      });
    } catch (error) {
      console.error('Error getting product by barcode:', error);
      return res.status(500).json({ error: 'Failed to get product information' });
    }
  });
  
  app.post('/api/barcode-logs', isAuthenticated, async (req, res) => {
    try {
      const { barcode, mode, timestamp, userId } = req.body;
      
      if (!barcode || !mode || !timestamp) {
        return res.status(400).json({ error: 'Barcode, mode, and timestamp are required' });
      }
      
      // Log the scan
      await storage.createBarcodeScanLog({
        barcode,
        scanType: mode,
        userId: Number(userId || req.user?.id || '1'),
        notes: `Barcode scanned in ${mode} mode`
      });
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error logging barcode scan:', error);
      return res.status(500).json({ error: 'Failed to log barcode scan' });
    }
  });
  
  app.get('/api/barcode-logs', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
      const logs = await storage.getBarcodeScanLogs(50); // Get last 50 logs
      return res.status(200).json(logs);
    } catch (error) {
      console.error('Error getting barcode scan history:', error);
      return res.status(500).json({ error: 'Failed to get barcode scan history' });
    }
  });
  
  app.post('/api/inventory/scan-update', isAuthenticated, async (req, res) => {
    try {
      const { barcode, quantity, adjustmentType } = req.body;
      
      if (!barcode || quantity === undefined || !adjustmentType) {
        return res.status(400).json({ error: 'Barcode, quantity, and adjustmentType are required' });
      }
      
      // Find product by barcode
      let product = await storage.getProductByBarcode(barcode);
      
      // If product not found by barcode, try SKU as fallback
      if (!product) {
        product = await storage.getProductBySku(barcode);
      }
      
      if (!product) {
        return res.status(404).json({ error: 'Product not found with this barcode' });
      }
      
      // Current product stock and calculated new quantity
      const currentStock = product.currentStock;
      const newQuantity = adjustmentType === 'count' 
        ? parseInt(quantity.toString()) 
        : currentStock + parseInt(quantity.toString());
      
      // Try to update the product stock with retry mechanism
      const updatedProduct = await storage.updateProductStock(product.id, newQuantity);
      
      if (!updatedProduct) {
        console.error(`Failed to update stock for product ${product.id}`);
        return res.status(500).json({ error: 'Failed to update product stock' });
      }
      
      // Log the inventory change (as a separate operation that shouldn't block)
      try {
        await storage.createInventoryChange({
          productId: product.id,
          quantity: String(newQuantity - currentStock),
          changeType: adjustmentType === 'count' ? 'manual_adjustment' : 'stock_replenishment',
          changeDate: new Date(),
          changedById: req.user?.id || null,
          notes: 'Barcode scan inventory update'
        });
      } catch (inventoryLogError) {
        // Just log the error but continue - the stock was updated successfully
        console.error('Failed to log inventory change:', inventoryLogError);
      }
      
      return res.status(200).json({ 
        success: true,
        product: {
          id: product.id,
          name: product.name,
          previousStock: currentStock,
          newStock: newQuantity
        }
      });
    } catch (error) {
      console.error('Error updating inventory by barcode:', error);
      // More descriptive error message for troubleshooting
      return res.status(500).json({ 
        error: 'Failed to update inventory', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Call Logs routes
  app.use('/api/call-logs', isAuthenticated, callLogsRouter);
  app.use('/api/prospective-customers', isAuthenticated, prospectiveCustomersRouter);
  
  // Special test endpoint without authentication
  app.get('/api/reports/test-pdf', (req, res) => {
    try {
      // Create a simple test PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Add title and metadata
      doc.info.Title = 'Test PDF Document';
      doc.info.Author = 'Warehouse Management System';
      
      // Add some content
      doc.text('Test PDF Generation', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).text('If you can see this text, PDF generation is working correctly!');
      doc.moveDown(1);
      doc.text(`Generated on: ${new Date().toLocaleString()}`);
      
      // Finalize and send the PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=test.pdf');
      
      doc.pipe(res);
      doc.end();
    } catch (error) {
      console.error('Error generating test PDF:', error);
      return res.status(500).json({ error: 'Failed to generate test PDF' });
    }
  });
  
  // Reports routes with authentication
  app.use('/api/reports', isAuthenticated, reportsRouter);
  
  // Production module routes
  app.use('/api/production', isAuthenticated, productionRouter);
  app.use('/api/order-pdf', orderPdfRouter);
  
  // Supplier Payment Tracking routes
  app.use('/api/supplier-payments', isAuthenticated, supplierPaymentsRouter);
  
  // Customer data access routes
  app.use('/api/customers', customersRouter);
  
  // Image upload and fix routes
  app.use('/api/image-fix', imageUploadFixRouter);
  
  // Serve shipping logo with proper content type
  app.get('/shipping-logo.png', (req, res) => {
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(path.join(process.cwd(), 'public', 'shipping-logo.png'));
  });
  
  app.get('/simple-logo.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(path.join(process.cwd(), 'public', 'simple-logo.svg'));
  });
  
  // Orders PDF generation - alternative route format (public access)
  app.get('/api/orders/:id/pdf', async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: 'Invalid order ID' });
      }
      
      // Get preferred language from query params, defaulting to Greek
      const language = req.query.lang as string || 'el';
      
      // Generate the PDF using Puppeteer for better Unicode (Greek) character support
      const pdfStream = await generateOrderPDF(orderId, language);
      
      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=order-${orderId}.pdf`);
      
      // Send PDF data
      pdfStream.pipe(res);
    } catch (error: any) {
      console.error('Error generating order PDF:', error);
      res.status(500).json({
        message: 'Error generating PDF',
        error: error.message
      });
    }
  });
  
  // Direct PDF view route for testing
  app.get('/view-pdf-test', (req: Request, res: Response) => {
    // Serve the PDF file directly for viewing
    const pdfPath = path.join(process.cwd(), 'public', 'test-output.pdf');
    res.sendFile(pdfPath);
  });
  
  // HTML preview of order to test Greek character rendering
  app.get('/view-order-html/:id', async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: 'Invalid order ID' });
      }
      
      // Get preferred language from query params, defaulting to Greek
      const language = req.query.lang as string || 'el';
      
      // Get the order data
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Get the order items
      const items = await storage.getOrderItems(orderId);
      
      // Prepare translated texts
      const texts = language === 'el' ? {
        orderForm: 'Φόρμα Παραγγελίας',
        customer: 'Πελάτης',
        sku: 'Κωδικός SKU',
        product: 'Προϊόν',
        quantity: 'Ποσότητα',
        piecesPerBox: 'Τεμάχια/Κιβώτιο',
        page: 'Σελίδα',
        of: 'από',
        shippingCompany: 'Εταιρεία Μεταφοράς',
        frontOfficeVerified: 'Επαλήθευση από Γραφείο',
        warehouseVerified: 'Επαλήθευση από Αποθήκη',
        notes: 'Σημειώσεις',
        category: 'Κατηγορία',
        tag: 'Ετικέτα',
        uncategorized: 'Χωρίς Κατηγορία'
      } : {
        orderForm: 'Order Form',
        customer: 'Customer',
        sku: 'SKU',
        product: 'Product',
        quantity: 'Quantity',
        piecesPerBox: 'Pieces/Box',
        page: 'Page',
        of: 'of',
        shippingCompany: 'Shipping Company',
        frontOfficeVerified: 'Front Office Verified',
        warehouseVerified: 'Warehouse Verified',
        notes: 'Notes',
        category: 'Category',
        tag: 'Tag',
        uncategorized: 'Uncategorized'
      };
      
      // We also need to get the product details for each item, including tags
      const enhancedItems = await Promise.all(items.map(async item => {
        // Fetch product details
        const product = await storage.getProduct(item.productId);
        
        // Get product tags - using the array in product.tags or fetch from productTags table
        let productTags: string[] = [];
        if (product?.tags && Array.isArray(product.tags)) {
          productTags = product.tags;
        }
        
        return {
          ...item,
          // Add product details to each item
          name: product?.name || 'Unknown Product',
          sku: product?.sku || '',
          piecesPerBox: product?.unitsPerBox || 0,
          barcode: product?.barcode || '',
          tags: productTags,
          // If no tags, mark as "Uncategorized"
          tagGroup: productTags.length > 0 ? productTags[0] : 'Uncategorized'
        };
      }));
      
      // Group items by their first tag (or "Uncategorized" if no tags)
      const groupedItems: {[key: string]: Array<any>} = {};
      
      // First sort the items into groups by tag
      enhancedItems.forEach(item => {
        const tagGroup = item.tagGroup || 'Uncategorized';
        
        if (!groupedItems[tagGroup]) {
          groupedItems[tagGroup] = [];
        }
        
        groupedItems[tagGroup].push(item);
      });
      
      // Create an ordered list of tag groups (with "Uncategorized" last)
      let tagGroups = Object.keys(groupedItems);
      
      // Sort tag groups alphabetically, but put "Uncategorized" at the end
      tagGroups = tagGroups.sort((a, b) => {
        if (a === 'Uncategorized') return 1;  // a is Uncategorized, put at end
        if (b === 'Uncategorized') return -1; // b is Uncategorized, put at end
        return a.localeCompare(b);            // normal alphabetical sort
      });
      
      // Get shipping info if available
      let shippingInfo = '';
      
      // First try to get shipping company info from the customer record
      const customer = await storage.getCustomerByName(order.customerName);
      
      // Check for billingCompany (originally customShippingCompany, renamed for UI)
      if (customer && customer.billingCompany) {
        shippingInfo = customer.billingCompany;
      } 
      // Check for regular shippingCompany - this is what most customers have
      else if (customer && customer.shippingCompany) {
        shippingInfo = customer.shippingCompany;
      }
      // Try preferred shipping company if available
      else if (customer && customer.preferredShippingCompany) {
        shippingInfo = customer.preferredShippingCompany;
      }
      // Fall back to order data if available (supporting legacy data)
      else if ((order as any).shippingCompany) {
        shippingInfo = (order as any).shippingCompany;
      }
      // Last fallback to area information
      else if (order.area) {
        shippingInfo = order.area;
      }
      
      // HTML template with CSS for display
      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Order #${order.orderNumber}</title>
        <style>
          @page {
            size: A4;
            margin: 1cm;
          }
          body {
            font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 12px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .subtitle {
            font-size: 14px;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background-color: #f2f2f2;
            padding: 8px;
            text-align: left;
            border: 1px solid #ddd;
            font-weight: bold;
          }
          td {
            padding: 8px;
            border: 1px solid #ddd;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .tag-header {
            background-color: #e6e6e6;
            padding: 8px;
            font-weight: bold;
            border: 1px solid #ddd;
          }
          .checkbox {
            width: 15px;
            height: 15px;
            border: 1px solid #000;
            display: inline-block;
            margin-right: 5px;
          }
          .verification {
            margin-top: 30px;
          }
          .verification-item {
            margin-bottom: 10px;
          }
          .notes-box {
            border: 1px solid #ddd;
            padding: 10px;
            margin-top: 20px;
            min-height: 60px;
          }
          .notes-title {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 10px;
            position: fixed;
            bottom: 1cm;
            left: 0;
            right: 0;
          }
          .notes-container {
            float: right;
            width: 45%;
          }
          .verification-container {
            float: left;
            width: 45%;
          }
          .clearfix::after {
            content: "";
            clear: both;
            display: table;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${texts.orderForm}: #${order.orderNumber}</div>
          <div class="subtitle">${texts.customer}: ${order.customerName}</div>
        </div>
        
        <!-- Iterate through each tag group -->
        ${tagGroups.map((tagGroup: string) => {
          // Get display name for the tag
          let displayTagName;
          if (tagGroup === 'Uncategorized') {
            displayTagName = texts.uncategorized;
          } else {
            // For other tag groups, add the category/tag label and capitalize first letter of tag
            const tagLabel = texts.tag + ': ';
            displayTagName = tagLabel + tagGroup.charAt(0).toUpperCase() + tagGroup.slice(1);
          }
          
          // Sort items alphabetically by name
          const itemsInGroup = [...groupedItems[tagGroup]].sort((a: any, b: any) => 
            a.name.localeCompare(b.name)
          );
          
          return `
            <div class="tag-header">${displayTagName}</div>
            <table>
              <thead>
                <tr>
                  <th width="5%"></th>
                  <th width="15%">${texts.sku}</th>
                  <th width="50%">${texts.product}</th>
                  <th width="15%">${texts.piecesPerBox}</th>
                  <th width="15%">${texts.quantity}</th>
                </tr>
              </thead>
              <tbody>
                ${itemsInGroup.map((item: any) => `
                  <tr>
                    <td><div class="checkbox"></div></td>
                    <td>${item.sku || ''}</td>
                    <td>${item.name || ''}</td>
                    <td>${item.piecesPerBox || ''}</td>
                    <td>${item.quantity}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        }).join('')}
        
        <!-- Bottom section with verification and notes -->
        <div class="clearfix">
          <div class="verification-container">
            <div class="verification">
              <div class="verification-item">
                <div class="checkbox"></div> ${texts.frontOfficeVerified}
              </div>
              <div class="verification-item">
                <div class="checkbox"></div> ${texts.warehouseVerified}
              </div>
            </div>
            
            ${shippingInfo ? `
              <div style="margin-top: 20px;">
                <strong>${texts.shippingCompany}:</strong> ${shippingInfo}
              </div>
            ` : ''}
          </div>
          
          ${order.notes && order.notes.trim() ? `
            <div class="notes-container">
              <div class="notes-title">${texts.notes}</div>
              <div class="notes-box">
                ${order.notes}
              </div>
            </div>
          ` : ''}
        </div>
        
        <div class="footer">
          ${texts.page} 1 ${texts.of} 1
        </div>
      </body>
      </html>
      `;
      
      res.send(htmlContent);
    } catch (error: any) {
      console.error('Error generating order HTML preview:', error);
      res.status(500).json({
        message: 'Error generating HTML preview',
        error: error.message
      });
    }
  });
  
  // Test endpoint for order PDF without authentication
  app.get('/test-order-pdf/:id', async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: 'Invalid order ID' });
      }
      
      // Get preferred language from query params, defaulting to Greek
      const language = req.query.lang as string || 'el';
      
      // Generate the PDF using Puppeteer for better Unicode (Greek) character support
      const pdfStream = await generateOrderPDF(orderId, language);
      
      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=order-${orderId}.pdf`);
      
      // Send PDF data
      pdfStream.pipe(res);
    } catch (error: any) {
      console.error('Error generating order PDF:', error);
      res.status(500).json({
        message: 'Error generating PDF',
        error: error.message
      });
    }
  });
  
  // Inventory Prediction Routes
  app.get('/api/inventory-predictions', isAuthenticated, getInventoryPredictions);
  app.get('/api/inventory-predictions/reorder-required', isAuthenticated, getProductsRequiringReorder);
  app.post('/api/inventory-predictions/generate', isAuthenticated, hasRole(['admin']), generatePredictions);
  app.get('/api/inventory-predictions/:id', isAuthenticated, getInventoryPrediction);
  app.post('/api/inventory-predictions', isAuthenticated, createInventoryPrediction);
  app.patch('/api/inventory-predictions/:id', isAuthenticated, updateInventoryPrediction);
  app.delete('/api/inventory-predictions/:id', isAuthenticated, deleteInventoryPrediction);
  
  // Inventory History Routes
  app.get('/api/inventory-history', isAuthenticated, getInventoryHistory);
  app.post('/api/inventory-history', isAuthenticated, createInventoryHistory);
  
  // Seasonal Patterns Routes
  app.get('/api/seasonal-patterns', isAuthenticated, getSeasonalPatterns);
  app.post('/api/seasonal-patterns', isAuthenticated, createSeasonalPattern);
  app.delete('/api/seasonal-patterns/:id', isAuthenticated, deleteSeasonalPattern);
  app.post('/api/seasonal-patterns/import', isAuthenticated, hasRole(['admin']), importSeasonalPatterns);
  
  // Label Printing Routes
  app.post('/api/print-label', isAuthenticated, printShippingLabel);
  app.post('/api/print-batch-labels', isAuthenticated, printBatchShippingLabels);
  app.post('/api/preview-label', isAuthenticated, previewShippingLabel);
  app.get('/api/preview-label/:filename', servePreviewImage); // Accessible without auth to allow image display in iframe
  
  // Customer information for shipping labels
  app.get('/api/shipping/customer/:customerName', isAuthenticated, getCustomerInfoForLabel);
  
  // Add CAB EOS 1 Printer Test endpoint
  app.get('/api/printer/test', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { directPrinter } = await import('./services/directPrinting');
      
      // Create a test label in JScript language (CAB printer language)
      const testLabel = `
m m
J
S l1;0,0,8,15,100
T 20,80,0,3,pt10;CAB EOS 1 Test Label
T 20,120,0,3,pt8;Warehouse Management System
T 20,160,0,3,pt6;Print Test: ${new Date().toLocaleString()}
B 20,200,0,EAN13,60,0,1,2;9780201379624
T 20,300,0,3,pt8;If you can see this, printing works!
A 1
`;
      
      console.log('[printer] Sending test label to printer...');
      
      const result = await directPrinter.printContent(testLabel, 'test');
      
      if (result.success) {
        console.log('✅ Test label sent to printer successfully');
      } else {
        console.error('❌ Printer test failed:', result.message);
      }
      
      // Return result
      res.json({
        success: result.success,
        message: result.message
      });
    } catch (err: any) {
      console.error('Error in printer test endpoint:', err);
      res.status(500).json({
        success: false,
        message: `Error: ${err.message}`,
        error: err.message
      });
    }
  });
  
  return httpServer;
}
