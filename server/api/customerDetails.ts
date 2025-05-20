import { Request, Response } from 'express';
import { storage } from '../storage';

/**
 * Get customer details by name
 * This endpoint is used to fetch customer information when generating shipping labels
 */
export async function getCustomerByName(req: Request, res: Response) {
  try {
    const customerName = req.params.name;
    
    if (!customerName) {
      return res.status(400).json({ error: 'Customer name is required' });
    }
    
    const customer = await storage.getCustomerByName(customerName);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    return res.status(200).json(customer);
  } catch (error: any) {
    console.error('Error fetching customer details:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve customer details',
      message: error.message 
    });
  }
}