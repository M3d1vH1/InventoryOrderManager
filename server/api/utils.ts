import { storage } from "../storage";
import { IOrder } from "../types";

/**
 * Utility function to fetch an order with all its items
 */
export async function getOrderWithItems(orderId: number): Promise<IOrder | null> {
  try {
    // Get the order
    const order = await storage.getOrder(orderId);
    if (!order) {
      return null;
    }
    
    // Get the order items
    const items = await storage.getOrderItems(orderId);
    
    // Add the items to the order object
    return {
      ...order,
      items: items.map(item => ({
        ...item,
        // Add product details to each item
        name: item.productName,
        sku: item.sku || ''
      }))
    };
  } catch (error) {
    console.error(`Error fetching order with items (ID: ${orderId}):`, error);
    return null;
  }
}