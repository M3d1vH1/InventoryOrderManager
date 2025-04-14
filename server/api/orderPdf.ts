import { Request, Response } from 'express';
import { generateOrderPDF } from '../services/pdfService';
import { isAuthenticated } from '../auth';
import express from 'express';

const router = express.Router();

/**
 * Generate a PDF for an order
 * GET /api/order-pdf/:orderId
 */
router.get('/:orderId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.orderId);
    
    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }
    
    // Get the language from the query parameter or default to 'en'
    const language = req.query.lang === 'el' ? 'el' : 'en';
    
    // Generate the PDF
    const pdfStream = await generateOrderPDF(orderId, language);
    
    // Set headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="order-${orderId}.pdf"`);
    
    // Pipe the PDF to the response
    pdfStream.pipe(res);
  } catch (error) {
    console.error('Error generating order PDF:', error);
    res.status(500).json({ message: 'Error generating PDF', error: error.message });
  }
});

export default router;