import { Request, Response } from 'express';
import { storage } from '../storage';

// Get all shipping companies (unique shipping company names from customers)
export async function getShippingCompanies(req: Request, res: Response) {
  try {
    // Hard-coded shipping companies for reliability
    const hardcodedCompanies = [
      { id: 1, name: "ACS" },
      { id: 2, name: "ELTA Courier" },
      { id: 3, name: "Speedex" },
      { id: 4, name: "DHL" },
      { id: 5, name: "Geniki Taxydromiki" },
      { id: 6, name: "Courier Center" }
    ];
    
    return res.json(hardcodedCompanies);
  } catch (error) {
    console.error('Error getting shipping companies:', error);
    return res.status(500).json({ 
      message: 'Failed to retrieve shipping companies' 
    });
  }
}