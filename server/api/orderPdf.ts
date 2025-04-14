import express, { Request, Response } from 'express';
import { isAuthenticated } from '../auth';
import { generateOrderPDF as generatePDFKitOrderPDF } from '../services/pdfService';
import { generateOrderPDF } from '../services/puppeteerPdfService';

const router = express.Router();

/**
 * Test route to check if the PDF generation is working
 * GET /api/order-pdf/test
 */
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'PDF generation endpoint is ready to use' });
});

/**
 * Test route to generate a sample PDF with known orderId for testing Greek characters
 * GET /api/order-pdf/test-greek/:orderId
 */
router.get('/test-greek/:orderId', async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }
    
    // Force Greek language for this test
    const language = 'el';
    
    // Generate the PDF with Greek language using Puppeteer for better Unicode support
    const pdfStream = await generateOrderPDF(orderId, language);
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=greek-test-order-${orderId}.pdf`);
    
    // Send PDF data
    pdfStream.pipe(res);
  } catch (error: any) {
    console.error('Error generating test Greek PDF:', error);
    res.status(500).json({
      message: 'Error generating test Greek PDF',
      error: error.message
    });
  }
});

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
    
    // Get preferred language from query params, defaulting to Greek
    const language = req.query.lang as string || 'el';
    
    // Generate the PDF using Puppeteer for better Unicode (Greek) character support
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