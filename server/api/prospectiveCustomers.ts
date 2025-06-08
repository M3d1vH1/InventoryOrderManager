import express from 'express';
import { storage } from '../storage';
import { insertProspectiveCustomerSchema, ProspectiveCustomer } from '@shared/schema';
import { hasPermission } from '../auth';
import { User } from '@shared/schema';

const router = express.Router();

// Get all prospective customers
router.get('/', async (req, res) => {
  try {
    const prospectiveCustomers = await storage.getAllProspectiveCustomers();
    res.json(prospectiveCustomers);
  } catch (error) {
    console.error('Error fetching prospective customers:', error);
    res.status(500).json({ error: 'Failed to fetch prospective customers' });
  }
});

// Get prospective customers by status
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const prospectiveCustomers = await storage.getProspectiveCustomersByStatus(status);
    res.json(prospectiveCustomers);
  } catch (error) {
    console.error('Error fetching prospective customers by status:', error);
    res.status(500).json({ error: 'Failed to fetch prospective customers by status' });
  }
});

// Search prospective customers
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const prospectiveCustomers = await storage.searchProspectiveCustomers(query);
    res.json(prospectiveCustomers);
  } catch (error) {
    console.error('Error searching prospective customers:', error);
    res.status(500).json({ error: 'Failed to search prospective customers' });
  }
});

// Get a specific prospective customer by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid prospective customer ID' });
    }
    
    const prospectiveCustomer = await storage.getProspectiveCustomer(id);
    if (!prospectiveCustomer) {
      return res.status(404).json({ error: 'Prospective customer not found' });
    }
    
    res.json(prospectiveCustomer);
  } catch (error) {
    console.error('Error fetching prospective customer:', error);
    res.status(500).json({ error: 'Failed to fetch prospective customer' });
  }
});

// Create a new prospective customer
router.post('/', async (req, res) => {
  try {
    // Validate the request body
    const validatedData = insertProspectiveCustomerSchema.parse(req.body);
    
    // Set the user ID from session if not provided
    const user = req.user as User;
    if (!validatedData.assignedToId && user) {
      validatedData.assignedToId = user.id;
    }
    
    // Set the updatedAt date
    validatedData.updatedAt = new Date();
    
    const newProspectiveCustomer = await storage.createProspectiveCustomer(validatedData);
    res.status(201).json(newProspectiveCustomer);
  } catch (error) {
    console.error('Error creating prospective customer:', error);
    res.status(400).json({ error: 'Invalid prospective customer data', details: error });
  }
});

// Update a prospective customer
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = insertProspectiveCustomerSchema.parse(req.body);
    const updated = await storage.updateProspectiveCustomer(id, {
      ...data,
      updatedAt: new Date() // Add updatedAt field
    });
    res.json(updated);
  } catch (error) {
    console.error('Error updating prospective customer:', error);
    res.status(500).json({ error: 'Failed to update prospective customer' });
  }
});

// Delete a prospective customer
router.delete('/:id', hasPermission('manage_prospects'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid prospective customer ID' });
    }
    
    const success = await storage.deleteProspectiveCustomer(id);
    if (!success) {
      return res.status(404).json({ error: 'Prospective customer not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting prospective customer:', error);
    res.status(500).json({ error: 'Failed to delete prospective customer' });
  }
});

// Convert a prospective customer to a regular customer
router.post('/:id/convert', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid prospective customer ID' });
    }
    
    const customer = await storage.convertToCustomer(id);
    if (!customer) {
      return res.status(404).json({ error: 'Prospective customer not found or conversion failed' });
    }
    
    res.status(200).json(customer);
  } catch (error) {
    console.error('Error converting prospective customer:', error);
    res.status(500).json({ error: 'Failed to convert prospective customer' });
  }
});

export default router;