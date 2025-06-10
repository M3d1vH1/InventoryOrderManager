import { Request, Response } from 'express';
import { storage } from '../storage';

/**
 * Get all unique shipping companies from the database
 * Combines data from both shipping_company and custom_shipping_company fields
 */
export async function getShippingCompanies(req: Request, res: Response) {
  try {
    const companies = await storage.getShippingCompanies();
    return res.json(companies);
  } catch (error) {
    console.error('Error getting shipping companies:', error);
    return res.status(500).json({ message: 'Failed to get shipping companies' });
  }
}

/**
 * Update customer's preferred shipping company
 */
export async function updateCustomerShippingCompany(req: Request, res: Response) {
  try {
    const customerId = parseInt(req.params.id, 10);
    const { shippingCompany } = req.body;
    
    if (!shippingCompany) {
      return res.status(400).json({ message: 'Shipping company is required' });
    }
    
    // Update customer's shipping company preference
    const updatedCustomer = await storage.updateCustomer(customerId, {
      preferredShippingCompany: 'other',
      customShippingCompany: shippingCompany
    });
    
    if (!updatedCustomer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    return res.json({ 
      message: 'Shipping company updated successfully',
      customer: updatedCustomer 
    });
  } catch (error) {
    console.error('Error updating customer shipping company:', error);
    return res.status(500).json({ message: 'Failed to update shipping company' });
  }
}