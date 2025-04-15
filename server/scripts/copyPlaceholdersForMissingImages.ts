import fs from 'fs';
import path from 'path';
import { storage } from '../storage';

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

// Base path for persistent file storage
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
      console.log(`Created symbolic link from ${sourcePath} to ${publicDir}`);
    } catch (err) {
      console.error(`Failed to create symbolic link from ${sourcePath} to ${publicDir}:`, err);
      // If symlink fails, we'll handle individual files
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
    }
  }
}

// Main function to copy placeholder images for missing product images
async function copyPlaceholdersForMissingImages() {
  try {
    console.log('Starting creation of placeholder images for missing product images...');
    
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
    
    // Get the placeholder image path
    const placeholderPath = path.join(process.cwd(), 'public/placeholder-image.png');
    if (!fs.existsSync(placeholderPath)) {
      console.error('Placeholder image not found at', placeholderPath);
      return;
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
            continue;
          }
          
          // Copy the placeholder image to the target path
          fs.copyFileSync(placeholderPath, targetPath);
          console.log(`Created placeholder image for product ${product.id}: ${filename}`);
          placeholderCount++;
        } catch (err) {
          console.error(`Error creating placeholder for product ${product.id}:`, err);
          errorCount++;
        }
      }
    }
    
    console.log('Placeholder creation complete!');
    console.log(`Successfully created placeholders: ${placeholderCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error during placeholder creation:', error);
  }
}

// Execute the function
copyPlaceholdersForMissingImages().then(() => {
  console.log('Script completed!');
}).catch(err => {
  console.error('Script failed:', err);
});