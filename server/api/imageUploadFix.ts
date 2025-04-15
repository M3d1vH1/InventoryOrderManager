import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { storage } from '../storage';
import { isAuthenticated } from '../auth';

const router = express.Router();

// Function to determine the appropriate storage path
function getStoragePath(): string {
  // Check for environment variable first
  if (process.env.STORAGE_PATH) {
    return process.env.STORAGE_PATH;
  }
  
  // Check if .data directory exists (Replit-specific)
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

// Set up storage paths
const STORAGE_BASE_PATH = getStoragePath();
const UPLOADS_PATH = path.join(STORAGE_BASE_PATH, 'uploads');
const PRODUCTS_UPLOAD_PATH = path.join(UPLOADS_PATH, 'products');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_PATH)) {
  fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}
if (!fs.existsSync(PRODUCTS_UPLOAD_PATH)) {
  fs.mkdirSync(PRODUCTS_UPLOAD_PATH, { recursive: true });
}

// Function to ensure public folder has access to files
function ensurePublicAccess() {
  const publicUploadDir = path.join(process.cwd(), 'public', 'uploads');
  const publicProductsDir = path.join(publicUploadDir, 'products');
  
  // Create parent directories if they don't exist
  if (!fs.existsSync(publicUploadDir)) {
    fs.mkdirSync(publicUploadDir, { recursive: true });
  }
  
  // Remove existing symlink if it exists but is broken
  if (fs.existsSync(publicProductsDir)) {
    try {
      const stats = fs.lstatSync(publicProductsDir);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(publicProductsDir);
        console.log('Removed existing symlink');
      }
    } catch (err) {
      console.error('Error checking existing symlink:', err);
    }
  }
  
  // Create directory if it doesn't exist after potential symlink removal
  if (!fs.existsSync(publicProductsDir)) {
    try {
      // Try to create a symbolic link
      fs.symlinkSync(PRODUCTS_UPLOAD_PATH, publicProductsDir, 'dir');
      console.log(`Created symbolic link from ${PRODUCTS_UPLOAD_PATH} to ${publicProductsDir}`);
    } catch (err) {
      console.error(`Failed to create symbolic link from ${PRODUCTS_UPLOAD_PATH} to ${publicProductsDir}:`, err);
      // If symlink fails, create the directory
      if (!fs.existsSync(publicProductsDir)) {
        fs.mkdirSync(publicProductsDir, { recursive: true });
        console.log(`Created directory ${publicProductsDir}`);
      }
      
      // Copy over the files instead
      try {
        const files = fs.readdirSync(PRODUCTS_UPLOAD_PATH);
        files.forEach(file => {
          const srcPath = path.join(PRODUCTS_UPLOAD_PATH, file);
          const destPath = path.join(publicProductsDir, file);
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied ${file} to public directory`);
          }
        });
      } catch (copyErr) {
        console.error('Error copying files:', copyErr);
      }
    }
  }
  
  return publicProductsDir;
}

// Initialize multer storage
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PRODUCTS_UPLOAD_PATH);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}-${originalName}`);
  }
});

const upload = multer({ 
  storage: storage_config,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      // @ts-ignore - ignore TypeScript error about passing Error as the first argument
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Function to create a base64 placeholder SVG image
function createPlaceholderSVG(): string {
  return `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" fill="#f0f0f0"/>
    <path d="M75,60 L125,60 L125,140 L75,140 Z" fill="#e0e0e0"/>
    <path d="M65,85 L85,85 L85,115 L65,115 Z" fill="#d0d0d0"/>
    <path d="M115,85 L135,85 L135,115 L115,115 Z" fill="#d0d0d0"/>
    <text x="100" y="175" font-family="Arial" font-size="12" text-anchor="middle" fill="#888888">No Image Available</text>
  </svg>`;
}

// Create a placeholder image
function createPlaceholderImage(productId: number): string {
  const timestamp = Date.now();
  const filename = `${timestamp}-placeholder-${productId}.svg`;
  const filePath = path.join(PRODUCTS_UPLOAD_PATH, filename);
  
  fs.writeFileSync(filePath, createPlaceholderSVG());
  
  // Ensure it's also available in the public directory
  const publicProductsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
  if (fs.existsSync(publicProductsDir)) {
    const publicFilePath = path.join(publicProductsDir, filename);
    fs.writeFileSync(publicFilePath, createPlaceholderSVG());
  }
  
  return `/uploads/products/${filename}`;
}

// Setup routes
router.get('/fix-image-paths', async (req: Request, res: Response) => {
  try {
    // Ensure the public access is set up properly
    const publicDir = ensurePublicAccess();
    console.log(`Public directory is at ${publicDir}`);
    
    // Get all products
    const products = await storage.getAllProducts();
    console.log(`Found ${products.length} products`);
    
    let fixedCount = 0;
    let noImageCount = 0;
    
    // Create a placeholder image in public/uploads
    const placeholderPath = path.join(process.cwd(), 'public', 'placeholder-image.svg');
    fs.writeFileSync(placeholderPath, createPlaceholderSVG());
    
    // Process each product
    for (const product of products) {
      try {
        if (!product.imagePath) {
          // Product has no image path, assign a placeholder
          const newImagePath = createPlaceholderImage(product.id);
          await storage.updateProduct(product.id, { imagePath: newImagePath });
          noImageCount++;
          continue;
        }
        
        const imagePath = product.imagePath.startsWith('/') 
          ? product.imagePath.substring(1) 
          : product.imagePath;
        
        const fullPath = path.join(process.cwd(), imagePath);
        const dataPath = path.join(PRODUCTS_UPLOAD_PATH, path.basename(imagePath));
        
        // Check if the image file exists and is a valid image
        let isValidImage = false;
        try {
          const stats = fs.statSync(fullPath);
          // If the file is very small, it's probably not a valid image
          isValidImage = stats.size > 1000;
        } catch (err) {
          isValidImage = false;
        }
        
        if (!isValidImage) {
          // Create a new placeholder for this product
          const newImagePath = createPlaceholderImage(product.id);
          await storage.updateProduct(product.id, { imagePath: newImagePath });
          fixedCount++;
        }
      } catch (productErr) {
        console.error(`Error processing product ${product.id}:`, productErr);
      }
    }
    
    res.json({
      success: true,
      message: `Image paths fixed. ${fixedCount} images were fixed, ${noImageCount} placeholders were created.`,
      publicDir,
      productsDir: PRODUCTS_UPLOAD_PATH
    });
  } catch (err) {
    console.error('Error fixing image paths:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error occurred' 
    });
  }
});

// Product image upload route (for re-uploading images)
router.post('/upload-product-image/:productId', isAuthenticated, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const productId = parseInt(req.params.productId);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Ensure our directories are properly set up
    ensurePublicAccess();
    
    // Update the product with the new image path
    const imagePath = `/uploads/products/${req.file.filename}`;
    await storage.updateProduct(productId, { imagePath });
    
    res.json({
      success: true,
      imagePath,
      product: await storage.getProduct(productId)
    });
  } catch (err) {
    console.error('Error uploading product image:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error occurred' 
    });
  }
});

export default router;