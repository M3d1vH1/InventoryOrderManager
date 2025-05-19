import { Request, Response } from 'express';
import { storage } from '../storage';

// Get all shipping companies (unique shipping company names from customers)
export async function getShippingCompanies(req: Request, res: Response) {
  try {
    // Get unique shipping companies from customers
    const customers = await storage.getAllCustomers();
    
    // Extract unique shipping company names that are not null or empty
    const companies = customers
      .filter(c => c.shippingCompany && c.shippingCompany.trim() !== '')
      .map(c => ({
        id: c.id || Math.floor(Math.random() * 1000) + 1,
        name: c.shippingCompany
      }));
    
    // Remove duplicates (using company name as unique identifier)
    const uniqueCompanies = Array.from(
      new Map(companies.map(c => [c.name, c])).values()
    );
    
    // Sort companies alphabetically
    uniqueCompanies.sort((a, b) => a.name.localeCompare(b.name));
    
    return res.json(uniqueCompanies);
  } catch (error) {
    console.error('Error getting shipping companies:', error);
    return res.status(500).json({ 
      message: 'Failed to retrieve shipping companies' 
    });
  }
}