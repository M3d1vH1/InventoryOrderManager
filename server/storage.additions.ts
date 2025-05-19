import { eq, and, sql } from 'drizzle-orm';
import { IStorage } from './storage';
import { ShippingItinerary, InsertShippingItinerary, ItineraryOrder } from '../shared/schema';

// Add these methods to your IStorage interface
export interface ShippingItineraryStorage {
  // Shipping Itinerary methods
  getAllShippingItineraries(): Promise<ShippingItinerary[]>;
  getShippingItinerary(id: number): Promise<ShippingItinerary | undefined>;
  createShippingItinerary(data: InsertShippingItinerary): Promise<ShippingItinerary>;
  updateShippingItineraryStatus(id: number, status: string): Promise<ShippingItinerary | undefined>;
  
  // Itinerary-Order relationship methods
  getOrdersForItinerary(itineraryId: number): Promise<any[]>;
  addOrderToItinerary(data: ItineraryOrder): Promise<void>;
  removeOrderFromItinerary(itineraryId: number, orderId: number): Promise<void>;
}

// Implementation for PostgreSQL storage
export const ShippingItineraryPostgreSQLMethods = {
  // Get all shipping itineraries
  async getAllShippingItineraries(this: IStorage): Promise<ShippingItinerary[]> {
    try {
      const { shippingItineraries } = await import('../shared/schema');
      return this.db.select().from(shippingItineraries).orderBy(shippingItineraries.departureDate);
    } catch (error) {
      console.error('Error getting shipping itineraries:', error);
      return [];
    }
  },

  // Get a single shipping itinerary by ID
  async getShippingItinerary(this: IStorage, id: number): Promise<ShippingItinerary | undefined> {
    try {
      const { shippingItineraries } = await import('../shared/schema');
      const result = await this.db
        .select()
        .from(shippingItineraries)
        .where(eq(shippingItineraries.id, id));
      return result[0];
    } catch (error) {
      console.error(`Error getting shipping itinerary #${id}:`, error);
      return undefined;
    }
  },

  // Create a new shipping itinerary
  async createShippingItinerary(this: IStorage, data: InsertShippingItinerary): Promise<ShippingItinerary> {
    try {
      const { shippingItineraries } = await import('../shared/schema');
      const result = await this.db
        .insert(shippingItineraries)
        .values(data)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating shipping itinerary:', error);
      throw error;
    }
  },

  // Update shipping itinerary status
  async updateShippingItineraryStatus(this: IStorage, id: number, status: string): Promise<ShippingItinerary | undefined> {
    try {
      const { shippingItineraries } = await import('../shared/schema');
      const result = await this.db
        .update(shippingItineraries)
        .set({ status })
        .where(eq(shippingItineraries.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error(`Error updating shipping itinerary status for #${id}:`, error);
      return undefined;
    }
  },

  // Get all orders for a given itinerary
  async getOrdersForItinerary(this: IStorage, itineraryId: number): Promise<any[]> {
    try {
      const { itineraryOrders, orders } = await import('../shared/schema');
      
      // Join the itinerary_orders and orders tables to get order details
      const result = await this.db
        .select({
          order: orders,
          addedAt: itineraryOrders.addedAt,
          addedById: itineraryOrders.addedById
        })
        .from(itineraryOrders)
        .innerJoin(orders, eq(itineraryOrders.orderId, orders.id))
        .where(eq(itineraryOrders.itineraryId, itineraryId))
        .orderBy(itineraryOrders.addedAt);
      
      return result.map(r => ({ 
        ...r.order, 
        addedAt: r.addedAt, 
        addedById: r.addedById 
      }));
    } catch (error) {
      console.error(`Error getting orders for itinerary #${itineraryId}:`, error);
      return [];
    }
  },

  // Add an order to an itinerary
  async addOrderToItinerary(this: IStorage, data: ItineraryOrder): Promise<void> {
    try {
      const { itineraryOrders } = await import('../shared/schema');
      
      // Check if the order is already in the itinerary
      const existing = await this.db
        .select()
        .from(itineraryOrders)
        .where(and(
          eq(itineraryOrders.itineraryId, data.itineraryId),
          eq(itineraryOrders.orderId, data.orderId)
        ));
      
      if (existing.length === 0) {
        // Only add if not already in the itinerary
        await this.db
          .insert(itineraryOrders)
          .values(data);
      }
    } catch (error) {
      console.error(`Error adding order #${data.orderId} to itinerary #${data.itineraryId}:`, error);
      throw error;
    }
  },

  // Remove an order from an itinerary
  async removeOrderFromItinerary(this: IStorage, itineraryId: number, orderId: number): Promise<void> {
    try {
      const { itineraryOrders } = await import('../shared/schema');
      await this.db
        .delete(itineraryOrders)
        .where(and(
          eq(itineraryOrders.itineraryId, itineraryId),
          eq(itineraryOrders.orderId, orderId)
        ));
    } catch (error) {
      console.error(`Error removing order #${orderId} from itinerary #${itineraryId}:`, error);
      throw error;
    }
  }
};