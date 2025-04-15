import { Request, Response } from 'express';
import { storage } from '../storage';
import fs from 'fs';
import path from 'path';

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

export async function migrateImages(req: Request, res: Response) {
  try {
    console.log('Starting migration of existing product images...');
    
    // Ensure our storage directories exist
    if (!fs.existsSync(PRODUCTS_UPLOAD_PATH)) {
      fs.mkdirSync(PRODUCTS_UPLOAD_PATH, { recursive: true });
    }
    
    // Create symbolic link to ensure public access
    ensurePublicAccess(PRODUCTS_UPLOAD_PATH, 'uploads/products');
    
    // Get all products from the database
    const products = await storage.getAllProducts();
    console.log(`Found ${products.length} products in the database`);
    
    let migratedCount = 0;
    let errorCount = 0;
    let results: any[] = [];
    
    // Process each product with an image
    for (const product of products) {
      if (product.imagePath) {
        try {
          // Get the filename from the path
          const filename = path.basename(product.imagePath);
          
          // Define the source and target paths
          const oldPublicPath = path.join(process.cwd(), 'public', product.imagePath);
          const newStoragePath = path.join(PRODUCTS_UPLOAD_PATH, filename);
          
          // Check if the image exists in the new location
          if (fs.existsSync(newStoragePath)) {
            console.log(`Image ${filename} already exists in the new storage location`);
            results.push({
              productId: product.id,
              imagePath: product.imagePath,
              status: 'already_migrated'
            });
            migratedCount++;
            continue;
          }
          
          // Check if the image exists in the public directory
          if (fs.existsSync(oldPublicPath)) {
            // Copy the file to the new storage location
            fs.copyFileSync(oldPublicPath, newStoragePath);
            console.log(`Migrated image ${filename} for product ${product.id}`);
            results.push({
              productId: product.id,
              imagePath: product.imagePath,
              status: 'migrated'
            });
            migratedCount++;
          } else {
            // If the file doesn't exist in public directory, check common storage paths
            const alternativePaths = [
              path.join(process.cwd(), '.data/uploads/products', filename),
              path.join(process.cwd(), 'storage/uploads/products', filename),
              // Add more potential paths if needed
            ];
            
            let found = false;
            for (const altPath of alternativePaths) {
              if (fs.existsSync(altPath)) {
                fs.copyFileSync(altPath, newStoragePath);
                console.log(`Migrated image ${filename} from alternative path for product ${product.id}`);
                results.push({
                  productId: product.id,
                  imagePath: product.imagePath,
                  status: 'migrated_from_alternative'
                });
                migratedCount++;
                found = true;
                break;
              }
            }
            
            if (!found) {
              // Use placeholder image as fallback for deployment environment
              const placeholderPath = path.join(process.cwd(), 'public/placeholder-image.png');
              if (fs.existsSync(placeholderPath)) {
                fs.copyFileSync(placeholderPath, newStoragePath);
                console.log(`Using placeholder image for product ${product.id} since original not found`);
                results.push({
                  productId: product.id,
                  imagePath: product.imagePath,
                  status: 'using_placeholder'
                });
                migratedCount++;
              } else {
                console.error(`Image file not found for product ${product.id}: ${product.imagePath}`);
                results.push({
                  productId: product.id,
                  imagePath: product.imagePath,
                  status: 'error_not_found'
                });
                errorCount++;
              }
            }
          }
        } catch (err) {
          console.error(`Error migrating image for product ${product.id}:`, err);
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
    
    console.log('Migration complete!');
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    res.json({
      success: true,
      migrated: migratedCount,
      errors: errorCount,
      results
    });
  } catch (error) {
    console.error('Error during image migration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}