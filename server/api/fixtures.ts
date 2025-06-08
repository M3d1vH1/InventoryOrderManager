import express from 'express';
import { storage } from '../storage';
import { hasPermission } from '../auth';

const router = express.Router();

// Endpoint to fix the call logs subject field
router.post('/fix-call-logs-subject', hasPermission('manage_call_logs'), async (req, res) => {
  try {
    // Get all call logs
    const callLogs = await storage.getAllCallLogs();
    
    // Update each call log to ensure it has a subject
    for (const log of callLogs) {
      if (!log.subject) {
        const updateData = {
          subject: log.contactName || log.callPurpose || 'No subject'
        };
        await storage.updateCallLog(log.id, updateData);
      }
    }
    
    res.json({ success: true, message: 'Call logs subjects fixed successfully' });
  } catch (error) {
    console.error('Error fixing call logs subjects:', error);
    res.status(500).json({ error: 'Failed to fix call logs subjects' });
  }
});

export default router;