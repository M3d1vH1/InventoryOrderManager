import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated, hasPermission } from '../auth';
import { insertProductSchema } from '@shared/schema';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { UploadedFile } from 'express-fileupload';

const router = Router();

// Get all products
router.get('/', async (req, res) => {
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

// Get low stock products
router.get('/low-stock', async (req, res) => {
  try {
    const products = await storage.getLowStockProducts();
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get slow moving products
router.get('/slow-moving', async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 60;
    const products = await storage.getSlowMovingProducts(days);
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
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

// Create new product
router.post('/', async (req, res) => {
  try {
    let imagePath = null;
    
    // Handle file upload if present
    if (req.files && req.files.image) {
      const imageFile = req.files.image as UploadedFile;
      
      // Generate unique filename
      const filename = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
      const filePath = path.join(process.cwd(), 'public/uploads/products', filename);
      
      // Move file to uploads directory
      await imageFile.mv(filePath);
      
      // Set image path for storage (URL path)
      imagePath = `/uploads/products/${filename}`;
    }
    
    // Get body data and handle tags properly
    let reqBody = { ...req.body };
    
    // Handle tags properly if they're coming from form data
    if (reqBody.tags) {
      if (typeof reqBody.tags === 'string' && 
         (reqBody.tags.startsWith('[') || reqBody.tags === '[]')) {
        try {
          reqBody.tags = JSON.parse(reqBody.tags);
        } catch (e) {
          console.error('Error parsing tags JSON:', e);
          reqBody.tags = [];
        }
      } 
      if (!Array.isArray(reqBody.tags)) {
        reqBody.tags = [];
      }
    }
    
    // Parse and validate product data with default categoryId
    const productData = insertProductSchema.parse({
      ...reqBody,
      imagePath: imagePath || reqBody.imagePath,
      categoryId: 1 // Set default categoryId for all products
    });
    
    const product = await storage.createProduct(productData);
    
    // If tags array is present, update the tag associations
    if (productData.tags && Array.isArray(productData.tags)) {
      try {
        const tagIds = await Promise.all(productData.tags.map(async (tagName: string) => {
          let tag = await storage.getTagByName(tagName);
          if (!tag) {
            tag = await storage.createTag({ name: tagName });
          }
          return tag.id;
        }));
        
        await storage.updateProductTags(product.id, tagIds);
      } catch (tagError) {
        console.error(`Error creating tags for product ${product.id}:`, tagError);
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

// Update product
router.patch('/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let updateData = {
      ...req.body,
      categoryId: 1 // Ensure categoryId is always set to 1
    };
    
    // Handle tags properly if they're coming from form data
    if (updateData.tags) {
      if (typeof updateData.tags === 'string' && 
         (updateData.tags.startsWith('[') || updateData.tags === '[]')) {
        try {
          updateData.tags = JSON.parse(updateData.tags);
        } catch (e) {
          console.error('Error parsing tags JSON:', e);
          updateData.tags = [];
        }
      } 
      if (!Array.isArray(updateData.tags)) {
        updateData.tags = [];
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

// Delete product
router.delete('/:id', isAuthenticated, hasPermission('manage_products'), async (req, res) => {
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

// Upload product image
router.post('/:id/image', isAuthenticated, async (req, res) => {
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
    const filePath = path.join(process.cwd(), 'public/uploads/products', filename);
    
    // Move file to uploads directory
    await imageFile.mv(filePath);
    
    // Delete old image if it exists
    if (product.imagePath) {
      const oldFilename = path.basename(product.imagePath);
      const oldImagePath = path.join(process.cwd(), 'public/uploads/products', oldFilename);
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
    const userId = (req.user as any)?.id;
    
    const updatedProduct = await storage.updateProduct(id, { imagePath }, userId);
    
    res.json(updatedProduct);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router; 