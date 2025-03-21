import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { products } from '../../shared/schema';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/wms';
const client = postgres(connectionString);
const db = drizzle(client);

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

// Make sure public uploads directory exists
const PUBLIC_UPLOADS_PATH = path.join(process.cwd(), 'public/uploads/products');
if (!fs.existsSync(PUBLIC_UPLOADS_PATH)) {
  fs.mkdirSync(PUBLIC_UPLOADS_PATH, { recursive: true });
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

async function migrateExistingImages() {
  try {
    console.log('Starting migration of existing product images...');
    
    // Ensure our storage directories exist
    if (!fs.existsSync(PRODUCTS_UPLOAD_PATH)) {
      fs.mkdirSync(PRODUCTS_UPLOAD_PATH, { recursive: true });
    }
    
    // Create symbolic link to ensure public access
    ensurePublicAccess(PRODUCTS_UPLOAD_PATH, 'uploads/products');
    
    // Get all products from the database
    const productsList = await db.select().from(products);
    console.log(`Found ${productsList.length} products in the database`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    // Process each product with an image
    for (const product of productsList) {
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
            migratedCount++;
            continue;
          }
          
          // Check if the image exists in the public directory
          if (fs.existsSync(oldPublicPath)) {
            // Copy the file to the new storage location
            fs.copyFileSync(oldPublicPath, newStoragePath);
            console.log(`Migrated image ${filename} for product ${product.id}`);
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
                migratedCount++;
                found = true;
                break;
              }
            }
            
            if (!found) {
              console.error(`Image file not found for product ${product.id}: ${product.imagePath}`);
              errorCount++;
            }
          }
        } catch (err) {
          console.error(`Error migrating image for product ${product.id}:`, err);
          errorCount++;
        }
      }
    }
    
    console.log('Migration complete!');
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error during image migration:', error);
  }
}

// Execute the migration function
migrateExistingImages()
  .then(() => {
    console.log('Migration script completed');
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
  })
  .finally(() => {
    // Close the database connection
    client.end().then(() => {
      console.log('Database connection closed');
    });
  });