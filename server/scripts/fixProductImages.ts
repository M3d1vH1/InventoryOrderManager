import { storage } from '../storage';
import fs from 'fs';
import path from 'path';
import { initStorage } from '../storage.postgresql';

// This script will find all products with image paths and verify if the images exist
// If an image doesn't exist, the imagePath will be set to null

async function fixProductImages() {
  console.log('Starting product image verification and cleanup...');
  
  // Initialize the storage
  await initStorage();
  
  // Get all products
  const products = await storage.getAllProducts();
  const productsWithImages = products.filter(p => p.imagePath);
  
  console.log(`Found ${productsWithImages.length} products with image paths to check`);
  
  let fixedCount = 0;
  
  // Check each product's image
  for (const product of productsWithImages) {
    if (!product.imagePath) continue;
    
    const imagePath = product.imagePath.startsWith('/') 
      ? product.imagePath.substring(1) 
      : product.imagePath;
      
    const fullPath = path.join(process.cwd(), 'public', imagePath);
    
    // Check if the image file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`Image file not found for product ${product.id} (${product.name}): ${fullPath}`);
      
      // Update the product to remove the image path
      await storage.updateProduct(product.id, { imagePath: '' });
      fixedCount++;
    }
  }
  
  console.log(`Completed cleanup. Updated ${fixedCount} products with missing images.`);
}

// Run the function
fixProductImages()
  .then(() => console.log('Image verification completed successfully'))
  .catch(err => console.error('Error during image verification:', err))
  .finally(() => process.exit(0));