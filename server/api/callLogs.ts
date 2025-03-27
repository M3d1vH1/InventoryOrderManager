import express from 'express';
import { storage } from '../storage';
import { insertCallLogSchema, insertCallOutcomeSchema } from '@shared/schema';
import { authenticateSession, requirePermission } from '../auth';

const router = express.Router();

// Middleware for authentication
router.use(authenticateSession);

// Get all call logs (with optional date filtering)
router.get('/', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const logs = await storage.getAllCallLogs(
      dateFrom as string | undefined, 
      dateTo as string | undefined
    );
    res.json(logs);
  } catch (error) {
    console.error('Error fetching call logs:', error);
    res.status(500).json({ error: 'Failed to fetch call logs' });
  }
});

// Get scheduled calls (optionally filtered by userId)
router.get('/scheduled', async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;
    const logs = await storage.getScheduledCalls(userId);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching scheduled calls:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled calls' });
  }
});

// Get calls requiring follow-up
router.get('/followup', async (req, res) => {
  try {
    const logs = await storage.getCallLogsRequiringFollowup();
    res.json(logs);
  } catch (error) {
    console.error('Error fetching calls requiring follow-up:', error);
    res.status(500).json({ error: 'Failed to fetch calls requiring follow-up' });
  }
});

// Search call logs
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const logs = await storage.searchCallLogs(query);
    res.json(logs);
  } catch (error) {
    console.error('Error searching call logs:', error);
    res.status(500).json({ error: 'Failed to search call logs' });
  }
});

// Get call logs for a specific customer
router.get('/customer/:customerId', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }
    
    const logs = await storage.getCallLogsByCustomer(customerId);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching call logs for customer:', error);
    res.status(500).json({ error: 'Failed to fetch call logs for customer' });
  }
});

// Get a specific call log by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid call log ID' });
    }
    
    const log = await storage.getCallLog(id);
    if (!log) {
      return res.status(404).json({ error: 'Call log not found' });
    }
    
    res.json(log);
  } catch (error) {
    console.error('Error fetching call log:', error);
    res.status(500).json({ error: 'Failed to fetch call log' });
  }
});

// Create a new call log
router.post('/', async (req, res) => {
  try {
    // Validate the request body
    const validatedData = insertCallLogSchema.parse(req.body);
    
    // Set the user ID from session if not provided
    if (!validatedData.userId && req.session.user) {
      validatedData.userId = req.session.user.id;
    }
    
    const newLog = await storage.createCallLog(validatedData);
    res.status(201).json(newLog);
  } catch (error) {
    console.error('Error creating call log:', error);
    res.status(400).json({ error: 'Invalid call log data', details: error });
  }
});

// Update a call log
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid call log ID' });
    }
    
    // Get the existing log to check ownership
    const existingLog = await storage.getCallLog(id);
    if (!existingLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }
    
    // Only allow updates if user is admin or the creator of the log
    const userId = req.session?.user?.id;
    const userRole = req.session?.user?.role;
    if (userRole !== 'admin' && existingLog.userId !== userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    const updatedLog = await storage.updateCallLog(id, req.body);
    res.json(updatedLog);
  } catch (error) {
    console.error('Error updating call log:', error);
    res.status(400).json({ error: 'Invalid update data', details: error });
  }
});

// Delete a call log
router.delete('/:id', requirePermission('manage_call_logs'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid call log ID' });
    }
    
    const success = await storage.deleteCallLog(id);
    if (!success) {
      return res.status(404).json({ error: 'Call log not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting call log:', error);
    res.status(500).json({ error: 'Failed to delete call log' });
  }
});

// Get call outcomes for a specific call
router.get('/:id/outcomes', async (req, res) => {
  try {
    const callId = parseInt(req.params.id, 10);
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'Invalid call log ID' });
    }
    
    const outcomes = await storage.getCallOutcomesByCall(callId);
    res.json(outcomes);
  } catch (error) {
    console.error('Error fetching call outcomes:', error);
    res.status(500).json({ error: 'Failed to fetch call outcomes' });
  }
});

// Create a new call outcome
router.post('/:id/outcomes', async (req, res) => {
  try {
    const callId = parseInt(req.params.id, 10);
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'Invalid call log ID' });
    }
    
    // Verify call exists
    const callLog = await storage.getCallLog(callId);
    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }
    
    // Validate and set call ID in the outcome data
    const outcomeData = {
      ...req.body,
      callId
    };
    
    const validatedData = insertCallOutcomeSchema.parse(outcomeData);
    const newOutcome = await storage.createCallOutcome(validatedData);
    
    res.status(201).json(newOutcome);
  } catch (error) {
    console.error('Error creating call outcome:', error);
    res.status(400).json({ error: 'Invalid call outcome data', details: error });
  }
});

// Update a call outcome
router.patch('/outcomes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid outcome ID' });
    }
    
    const updatedOutcome = await storage.updateCallOutcome(id, req.body);
    if (!updatedOutcome) {
      return res.status(404).json({ error: 'Call outcome not found' });
    }
    
    res.json(updatedOutcome);
  } catch (error) {
    console.error('Error updating call outcome:', error);
    res.status(400).json({ error: 'Invalid update data', details: error });
  }
});

// Mark a call outcome as complete
router.post('/outcomes/:id/complete', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid outcome ID' });
    }
    
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { notes } = req.body;
    
    const completedOutcome = await storage.completeCallOutcome(id, userId, notes);
    if (!completedOutcome) {
      return res.status(404).json({ error: 'Call outcome not found' });
    }
    
    res.json(completedOutcome);
  } catch (error) {
    console.error('Error completing call outcome:', error);
    res.status(500).json({ error: 'Failed to complete call outcome' });
  }
});

// Delete a call outcome
router.delete('/outcomes/:id', requirePermission('manage_call_logs'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid outcome ID' });
    }
    
    const success = await storage.deleteCallOutcome(id);
    if (!success) {
      return res.status(404).json({ error: 'Call outcome not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting call outcome:', error);
    res.status(500).json({ error: 'Failed to delete call outcome' });
  }
});

export default router;