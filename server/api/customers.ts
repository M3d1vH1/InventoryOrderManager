import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../auth';

const router = Router();

// Get all customers (with pagination)
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const customers = await storage.getAllCustomers();
    
    // Simple pagination implementation
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedCustomers = customers.slice(startIndex, endIndex);
    
    res.json({
      customers: paginatedCustomers,
      pagination: {
        total: customers.length,
        page,
        limit,
        totalPages: Math.ceil(customers.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Error fetching customers' });
  }
});

// Search customers by name
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }
    
    // Get all customers and filter by name
    const allCustomers = await storage.getAllCustomers();
    
    // Case-insensitive partial name matching
    const filteredCustomers = allCustomers.filter(customer => 
      customer.name.toLowerCase().includes(query.toLowerCase())
    );
    
    res.json(filteredCustomers);
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({ message: 'Error searching customers' });
  }
});

// Get a single customer by ID
router.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }
    
    const customer = await storage.getCustomer(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ message: 'Error fetching customer' });
  }
});

export default router;