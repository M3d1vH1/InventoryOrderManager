import { eq, and, sql } from 'drizzle-orm';
import { IStorage } from './storage';
import { 
  shippingItineraries, 
  itineraryOrders, 
  ShippingItinerary, 
  InsertShippingItinerary, 
  ItineraryOrder 
} from '../shared/schema.itineraries';
import { customers, orders } from '../shared/schema';

/**
 * Storage methods for shipping itineraries
 */
export const ShippingItineraryMethods = {
  // Get all shipping itineraries
  async getAllShippingItineraries(this: IStorage): Promise<ShippingItinerary[]> {
    try {
      const result = await this.db.query.shippingItineraries.findMany({
        orderBy: (itinerary) => [itinerary.departureDate]
      });
      return result;
    } catch (error) {
      console.error('Error getting shipping itineraries:', error);
      return [];
    }
  },

  // Get a single shipping itinerary by ID
  async getShippingItinerary(this: IStorage, id: number): Promise<ShippingItinerary | undefined> {
    try {
      const result = await this.db.query.shippingItineraries.findFirst({
        where: eq(shippingItineraries.id, id)
      });
      return result || undefined;
    } catch (error) {
      console.error(`Error getting shipping itinerary #${id}:`, error);
      return undefined;
    }
  },

  // Create a new shipping itinerary
  async createShippingItinerary(this: IStorage, data: InsertShippingItinerary): Promise<ShippingItinerary> {
    try {
      const [result] = await this.db.insert(shippingItineraries)
        .values({
          ...data,
          totalBoxes: 0 // Initialize with zero boxes
        })
        .returning();
      
      return result;
    } catch (error) {
      console.error('Error creating shipping itinerary:', error);
      throw error;
    }
  },

  // Update shipping itinerary status
  async updateShippingItineraryStatus(this: IStorage, id: number, status: string): Promise<ShippingItinerary | undefined> {
    try {
      const [result] = await this.db.update(shippingItineraries)
        .set({ status })
        .where(eq(shippingItineraries.id, id))
        .returning();
      
      return result;
    } catch (error) {
      console.error(`Error updating shipping itinerary status for #${id}:`, error);
      return undefined;
    }
  },

  // Get all orders for a given itinerary with box count information
  async getOrdersForItinerary(this: IStorage, itineraryId: number): Promise<any[]> {
    try {
      // First get the order IDs and box counts
      const itineraryOrdersResult = await this.db.select({
        orderId: itineraryOrders.orderId,
        boxCount: itineraryOrders.boxCount,
        addedAt: itineraryOrders.addedAt,
        addedById: itineraryOrders.addedById
      })
      .from(itineraryOrders)
      .where(eq(itineraryOrders.itineraryId, itineraryId));
      
      if (itineraryOrdersResult.length === 0) {
        return [];
      }
      
      // Get the order details for each order ID
      const orderDetails = await Promise.all(
        itineraryOrdersResult.map(async (io) => {
          const order = await this.getOrder(io.orderId);
          return order ? { 
            ...order, 
            boxCount: io.boxCount,
            addedAt: io.addedAt,
            addedById: io.addedById
          } : null;
        })
      );
      
      // Filter out any null values (in case an order was deleted)
      return orderDetails.filter(Boolean);
    } catch (error) {
      console.error(`Error getting orders for itinerary #${itineraryId}:`, error);
      return [];
    }
  },

  // Add an order to an itinerary with box count
  async addOrderToItinerary(this: IStorage, data: { 
    itineraryId: number,
    orderId: number,
    boxCount: number,
    addedById: number
  }): Promise<void> {
    try {
      // Start a transaction to ensure consistency
      await this.db.transaction(async (tx) => {
        // Check if the order is already in the itinerary
        const existing = await tx.select({ id: itineraryOrders.id })
          .from(itineraryOrders)
          .where(and(
            eq(itineraryOrders.itineraryId, data.itineraryId),
            eq(itineraryOrders.orderId, data.orderId)
          ));
        
        if (existing.length === 0) {
          // Only add if not already in the itinerary
          await tx.insert(itineraryOrders).values({
            itineraryId: data.itineraryId,
            orderId: data.orderId,
            boxCount: data.boxCount,
            addedById: data.addedById
          });
          
          // Update the total box count in the itinerary
          await tx.execute(sql`
            UPDATE shipping_itineraries 
            SET total_boxes = total_boxes + ${data.boxCount}
            WHERE id = ${data.itineraryId}
          `);
        }
      });
    } catch (error) {
      console.error(`Error adding order #${data.orderId} to itinerary #${data.itineraryId}:`, error);
      throw error;
    }
  },

  // Remove an order from an itinerary
  async removeOrderFromItinerary(this: IStorage, itineraryId: number, orderId: number): Promise<void> {
    try {
      // Start a transaction to ensure consistency
      await this.db.transaction(async (tx) => {
        // Get the box count before removing the order
        const [orderToRemove] = await tx.select({ boxCount: itineraryOrders.boxCount })
          .from(itineraryOrders)
          .where(and(
            eq(itineraryOrders.itineraryId, itineraryId),
            eq(itineraryOrders.orderId, orderId)
          ));
        
        if (orderToRemove) {
          // Remove the order from the itinerary
          await tx.delete(itineraryOrders)
            .where(and(
              eq(itineraryOrders.itineraryId, itineraryId),
              eq(itineraryOrders.orderId, orderId)
            ));
          
          // Update the total box count in the itinerary
          await tx.execute(sql`
            UPDATE shipping_itineraries 
            SET total_boxes = total_boxes - ${orderToRemove.boxCount}
            WHERE id = ${itineraryId}
          `);
        }
      });
    } catch (error) {
      console.error(`Error removing order #${orderId} from itinerary #${itineraryId}:`, error);
      throw error;
    }
  },

  // Get upcoming itineraries
  async getUpcomingItineraries(this: IStorage, limit = 10): Promise<ShippingItinerary[]> {
    try {
      const result = await this.db.select()
        .from(shippingItineraries)
        .where(eq(shippingItineraries.status, 'active'))
        .orderBy(shippingItineraries.departureDate)
        .limit(limit);
      
      return result;
    } catch (error) {
      console.error('Error getting upcoming itineraries:', error);
      return [];
    }
  },

  // Get shipping itineraries for the calendar
  async getItinerariesForCalendar(this: IStorage, startDate: Date, endDate: Date): Promise<ShippingItinerary[]> {
    try {
      const result = await this.db.select()
        .from(shippingItineraries)
        .where(sql`${shippingItineraries.departureDate} BETWEEN ${startDate} AND ${endDate}`)
        .orderBy(shippingItineraries.departureDate);
      
      return result;
    } catch (error) {
      console.error('Error getting itineraries for calendar:', error);
      return [];
    }
  },

  // Get customer by name - for shipping preferences
  async getCustomerByName(this: IStorage, name: string): Promise<any | undefined> {
    try {
      const result = await this.db.select()
        .from(customers)
        .where(eq(customers.name, name))
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error(`Error getting customer by name "${name}":`, error);
      return undefined;
    }
  }
};