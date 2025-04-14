import express, { Request, Response } from 'express';
import { isAuthenticated } from '../auth';
import { generateOrderPDF } from '../services/pdfService';

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
    
    // Get preferred language from query params, defaulting to English
    const language = req.query.lang as string || 'en';
    
    // Generate the PDF
    const pdfStream = await generateOrderPDF(orderId, language);
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=order-${orderId}.pdf`);
    
    // Send PDF data
    pdfStream.pipe(res);
  } catch (error: any) {
    console.error('Error generating order PDF:', error);
    res.status(500).json({
      message: 'Error generating PDF',
      error: error.message
    });
  }
});

export default router;