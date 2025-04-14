import { storage } from "../storage";

/**
 * Utility function to fetch an order with all its items
 */
export async function getOrderWithItems(orderId: number) {
  try {
    // Get the order
    const order = await storage.getOrder(orderId);
    if (!order) {
      return null;
    }
    
    // Get the order items
    const items = await storage.getOrderItems(orderId);
    
    // We also need to get the product details for each item
    const enhancedItems = await Promise.all(items.map(async item => {
      // Fetch product details
      const product = await storage.getProduct(item.productId);
      
      return {
        ...item,
        // Add product details to each item
        name: product?.name || 'Unknown Product',
        sku: product?.sku || '',
        piecesPerBox: product?.unitsPerBox || 0,
        barcode: product?.barcode || ''
      };
    }));
    
    // Add the items to the order object
    return {
      ...order,
      items: enhancedItems
    };
  } catch (error) {
    console.error(`Error fetching order with items (ID: ${orderId}):`, error);
    return null;
  }
}