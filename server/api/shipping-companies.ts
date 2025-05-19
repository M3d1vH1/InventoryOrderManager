import { Request, Response } from 'express';
import { storage } from '../storage';

// Get all shipping companies (unique shipping company names from customers)
export async function getShippingCompanies(req: Request, res: Response) {
  try {
    // Default shipping companies as fallback
    const defaultCompanies = [
      { id: 1, name: "ACS" },
      { id: 2, name: "ELTA Courier" },
      { id: 3, name: "Speedex" },
      { id: 4, name: "DHL" },
      { id: 5, name: "Geniki Taxydromiki" }
    ];

    // Get customers from the database
    const customers = await storage.getAllCustomers();
    if (!customers || customers.length === 0) {
      return res.json(defaultCompanies);
    }
    
    // Extract companies from customers with proper error handling
    const companySet = new Set<string>();
    const companyMap = new Map<string, number>();
    
    // First gather all unique company names and their customer IDs
    customers.forEach(customer => {
      if (customer.shippingCompany && typeof customer.shippingCompany === 'string' && customer.shippingCompany.trim() !== '') {
        companySet.add(customer.shippingCompany);
        // Store first customer ID for each company
        if (!companyMap.has(customer.shippingCompany) && typeof customer.id === 'number') {
          companyMap.set(customer.shippingCompany, customer.id);
        }
      }
    });
    
    // Create the shipping company array
    const shippingCompanies = Array.from(companySet).map(companyName => {
      // Get a customer ID if we have one, otherwise generate random ID
      const id = companyMap.get(companyName) || Math.floor(Math.random() * 10000) + 100;
      return {
        id,
        name: companyName
      };
    });
    
    // Add default companies if we don't have enough from customers
    if (shippingCompanies.length === 0) {
      return res.json(defaultCompanies);
    }
    
    // Sort alphabetically
    shippingCompanies.sort((a, b) => a.name.localeCompare(b.name));
    
    return res.json(shippingCompanies);
  } catch (error) {
    console.error('Error getting shipping companies:', error);
    // Return default companies if there's an error
    const defaultCompanies = [
      { id: 1, name: "ACS" },
      { id: 2, name: "ELTA Courier" },
      { id: 3, name: "Speedex" },
      { id: 4, name: "DHL" },
      { id: 5, name: "Geniki Taxydromiki" }
    ];
    return res.json(defaultCompanies);
  }
}