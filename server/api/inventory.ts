import { Request, Response } from 'express';
import { storage } from '../storage.postgresql';
import { isAuthenticated, hasRole } from '../auth';

/**
 * Get all slow-moving products
 * Products that haven't been restocked for a significant amount of time (default: 60 days)
 */
export async function getSlowMovingProducts(req: Request, res: Response) {
  try {
    // Default to 60 days if not specified
    const dayThreshold = req.query.days ? parseInt(req.query.days as string) : 60;
    
    // Get slow-moving products from storage
    const slowMovingProducts = await storage.getSlowMovingProducts(dayThreshold);
    
    // Return empty array if no products
    if (!slowMovingProducts || slowMovingProducts.length === 0) {
      return res.json({ products: [] });
    }
    
    // Format the data for frontend
    const formattedProducts = slowMovingProducts.map(product => {
      // Calculate days since last update if available
      const lastStockUpdate = product.lastStockUpdate;
      let daysWithoutMovement = 0;
      
      if (lastStockUpdate) {
        const today = new Date();
        const timeDiff = today.getTime() - new Date(lastStockUpdate).getTime();
        daysWithoutMovement = Math.floor(timeDiff / (1000 * 3600 * 24));
      } else {
        // If no last update date, use 90 days as default
        daysWithoutMovement = 90;
      }
      
      // Get category name from the query result
      const categoryName = 'category' in product ? 
        (product as any).category : // Access the category from the SQL query result
        'Unknown'; // Fallback
      
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: categoryName,
        currentStock: product.currentStock, 
        lastStockUpdate: product.lastStockUpdate ? product.lastStockUpdate.toISOString() : null,
        daysWithoutMovement
      };
    });
    
    return res.json({ products: formattedProducts });
  } catch (error) {
    console.error('[API] Error fetching slow-moving products:', error);
    return res.status(500).json({ message: 'Error fetching slow-moving products', error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Update product stock
 */
export async function updateProductStock(req: Request, res: Response) {
  try {
    const { productId, newStock } = req.body;
    
    if (!productId || newStock === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Get the product
    const product = await storage.getProduct(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get userId from the authenticated user
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    // Update the stock and last stock update date with userId for inventory change tracking
    const updatedProduct = await storage.updateProduct(productId, {
      currentStock: newStock,
      lastStockUpdate: new Date()
    }, userId);
    
    if (!updatedProduct) {
      return res.status(500).json({ message: 'Failed to update product stock' });
    }
    
    return res.json({ 
      success: true, 
      product: updatedProduct
    });
  } catch (error) {
    console.error('[API] Error updating product stock:', error);
    return res.status(500).json({ message: 'Error updating product stock', error: error instanceof Error ? error.message : String(error) });
  }
}