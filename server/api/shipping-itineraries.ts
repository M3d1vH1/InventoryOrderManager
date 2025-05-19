import { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertShippingItinerarySchema, insertItineraryOrderSchema } from '@shared/schema';
import { isAuthenticated } from '../auth';

// Schema for creating a new itinerary
const createItinerarySchema = z.object({
  itineraryNumber: z.string(),
  departureDate: z.string().or(z.date()),
  driverName: z.string().optional().nullable(),
  vehicleInfo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  orderIds: z.array(z.number()).optional(),
});

// Get all shipping itineraries
export async function getAllItineraries(req: Request, res: Response) {
  try {
    const itineraries = await storage.getAllShippingItineraries();
    
    return res.json(itineraries);
  } catch (error) {
    console.error('Error getting shipping itineraries:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve shipping itineraries' 
    });
  }
}

// Get a specific shipping itinerary by ID
export async function getItineraryById(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid itinerary ID' });
    }
    
    const itinerary = await storage.getShippingItinerary(id);
    
    if (!itinerary) {
      return res.status(404).json({ error: 'Shipping itinerary not found' });
    }
    
    // Get all orders associated with this itinerary
    const orders = await storage.getOrdersForItinerary(id);
    
    return res.json({ 
      ...itinerary,
      orders 
    });
  } catch (error) {
    console.error(`Error getting shipping itinerary #${req.params.id}:`, error);
    return res.status(500).json({ 
      error: 'Failed to retrieve shipping itinerary' 
    });
  }
}

// Create a new shipping itinerary
export async function createShippingItinerary(req: Request, res: Response) {
  try {
    // Validate the request body
    const parsedBody = createItinerarySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ 
        error: 'Invalid data', 
        details: parsedBody.error.errors 
      });
    }

    // Make sure the user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get user ID - since we're using TypeScript with Express session, 
    // we need to ensure we have a valid user ID
    const userId = (req.user as any)?.id || 1;
    
    // Extract data from the parsed body
    const data = parsedBody.data;
    
    // Format departure date if it's a string
    const departureDate = typeof data.departureDate === 'string'
      ? new Date(data.departureDate)
      : data.departureDate;
    
    // Create the shipping itinerary
    const newItinerary = await storage.createShippingItinerary({
      itineraryNumber: data.itineraryNumber,
      departureDate,
      driverName: data.driverName || null,
      vehicleInfo: data.vehicleInfo || null,
      notes: data.notes || null,
      createdById: userId,
      status: 'active'
    });
    
    // If order IDs are provided, associate them with the itinerary
    const orderIds = data.orderIds || [];
    if (orderIds.length > 0) {
      await Promise.all(orderIds.map(orderId => 
        storage.addOrderToItinerary({
          itineraryId: newItinerary.id,
          orderId,
          boxCount: 1, // Default box count is 1
          addedById: userId
        })
      ));
      
      // Get the updated itinerary with orders
      const updatedItinerary = await storage.getShippingItinerary(newItinerary.id);
      const orders = await storage.getOrdersForItinerary(newItinerary.id);
      
      return res.status(201).json({ 
        ...updatedItinerary,
        orders 
      });
    }
    
    return res.status(201).json(newItinerary);
  } catch (error) {
    console.error('Error creating shipping itinerary:', error);
    return res.status(500).json({ 
      error: 'Failed to create shipping itinerary' 
    });
  }
}

// Add an order to an itinerary
export async function addOrderToItinerary(req: Request, res: Response) {
  try {
    const itineraryId = parseInt(req.params.id);
    const { orderId, boxCount = 1 } = req.body;
    
    if (isNaN(itineraryId) || !orderId) {
      return res.status(400).json({ error: 'Invalid itinerary ID or order ID' });
    }
    
    // Make sure the user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if the itinerary exists
    const itinerary = await storage.getShippingItinerary(itineraryId);
    if (!itinerary) {
      return res.status(404).json({ error: 'Shipping itinerary not found' });
    }
    
    // Check if the order exists
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Get user ID from session
    const userId = (req.user as any)?.id || 1;

    // Add the order to the itinerary
    await storage.addOrderToItinerary({
      itineraryId,
      orderId,
      boxCount: boxCount || 1, // Ensure we have a valid box count
      addedById: userId
    });
    
    // Get all orders for this itinerary to return in the response
    const orders = await storage.getOrdersForItinerary(itineraryId);
    
    return res.json({ 
      success: true, 
      orders 
    });
  } catch (error) {
    console.error(`Error adding order to itinerary #${req.params.id}:`, error);
    return res.status(500).json({ 
      error: 'Failed to add order to itinerary' 
    });
  }
}

// Remove an order from an itinerary
export async function removeOrderFromItinerary(req: Request, res: Response) {
  try {
    const itineraryId = parseInt(req.params.id);
    const orderId = parseInt(req.params.orderId);
    
    if (isNaN(itineraryId) || isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid itinerary ID or order ID' });
    }
    
    // Make sure the user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if the itinerary exists
    const itinerary = await storage.getShippingItinerary(itineraryId);
    if (!itinerary) {
      return res.status(404).json({ error: 'Shipping itinerary not found' });
    }
    
    // Remove the order from the itinerary
    await storage.removeOrderFromItinerary(itineraryId, orderId);
    
    // Get all orders for this itinerary to return in the response
    const orders = await storage.getOrdersForItinerary(itineraryId);
    
    return res.json({ 
      success: true, 
      orders 
    });
  } catch (error) {
    console.error(`Error removing order from itinerary #${req.params.id}:`, error);
    return res.status(500).json({ 
      error: 'Failed to remove order from itinerary' 
    });
  }
}

// Update itinerary status (mark as completed, etc.)
export async function updateItineraryStatus(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid itinerary ID' });
    }
    
    if (!['active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be active, completed, or cancelled' });
    }
    
    // Check if the itinerary exists
    const itinerary = await storage.getShippingItinerary(id);
    if (!itinerary) {
      return res.status(404).json({ error: 'Shipping itinerary not found' });
    }
    
    // Update the itinerary status
    const updatedItinerary = await storage.updateShippingItineraryStatus(id, status);
    
    return res.json(updatedItinerary);
  } catch (error) {
    console.error(`Error updating itinerary status for #${req.params.id}:`, error);
    return res.status(500).json({ 
      error: 'Failed to update itinerary status' 
    });
  }
}

// Get upcoming itineraries for calendar or dashboard
export async function getUpcomingItineraries(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const itineraries = await storage.getUpcomingItineraries(limit);
    
    return res.json(itineraries);
  } catch (error) {
    console.error('Error getting upcoming itineraries:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve upcoming itineraries' 
    });
  }
}

// Get itineraries for a date range (for calendar view)
export async function getItinerariesForCalendar(req: Request, res: Response) {
  try {
    const startDate = new Date(req.query.start as string);
    const endDate = new Date(req.query.end as string);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date range' });
    }
    
    const itineraries = await storage.getItinerariesForCalendar(startDate, endDate);
    
    return res.json(itineraries);
  } catch (error) {
    console.error('Error getting itineraries for calendar:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve itineraries for calendar' 
    });
  }
}