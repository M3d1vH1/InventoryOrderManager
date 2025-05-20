import { Request, Response } from 'express';
import { storage } from '../storage';

/**
 * Gets customer information for shipping label
 */
export async function getCustomerInfoForLabel(req: Request, res: Response) {
  try {
    const { customerName } = req.params;
    
    if (!customerName) {
      return res.status(400).json({ error: 'Customer name is required' });
    }
    
    // Try to find the exact customer by name
    const customer = await storage.getCustomerByName(customerName);
    
    // If not found, try to search for similar names
    if (!customer) {
      const similarCustomers = await storage.searchCustomers(customerName);
      if (similarCustomers && similarCustomers.length > 0) {
        // Return the most similar customer (first match)
        return res.json(similarCustomers[0]);
      }
      
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Return the customer information
    return res.json(customer);
  } catch (error: any) {
    console.error('Error fetching customer info for label:', error);
    return res.status(500).json({ error: error.message });
  }
}