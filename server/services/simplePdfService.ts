import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { storage } from '../storage';

// Create a simplified PDF generation service specifically to handle Greek characters properly
export async function generateSimpleOrderPDF(orderId: number, language: string = 'el'): Promise<Readable> {
  // Create a stream to return the PDF
  const buffers: Buffer[] = [];
  const stream = new Readable();
  
  // Set basic page dimensions
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 50;
  
  // Initialize PDF document with UTF-8 encoding
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    info: {
      Title: `Order #${orderId}`,
      Author: 'Warehouse Management System',
      Subject: 'Order Details'
    },
    lang: language === 'el' ? 'el-GR' : 'en-US'
  });
  
  // Use Courier font for better Greek character support
  const FONT = {
    REGULAR: 'Courier',
    BOLD: 'Courier-Bold'
  };
  
  // Set up document buffers
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    stream.push(Buffer.concat(buffers));
    stream.push(null);
  });

  try {
    // Get order data
    const order = await storage.getOrder(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found`);
    }
    
    // Get order items with products
    const items = await storage.getOrderItems(orderId);
    const enhancedItems = await Promise.all(items.map(async item => {
      const product = await storage.getProduct(item.productId);
      return {
        ...item,
        name: product?.name || 'Unknown Product',
        sku: product?.sku || '',
        piecesPerBox: product?.unitsPerBox || 0
      };
    }));
    
    // Get translations
    const texts = getTranslatedTexts(language);
    
    // Draw header
    doc.font(FONT.BOLD).fontSize(16)
       .text(`${texts.orderForm}: #${order.orderNumber}`, { align: 'center' });
    
    doc.moveDown(0.5);
    
    doc.font(FONT.REGULAR).fontSize(12)
       .text(`${texts.customer}: ${order.customerName}`, { align: 'center' });
    
    doc.moveDown(2);
    
    // Draw items table
    const tableTop = doc.y;
    const tableWidth = PAGE_WIDTH - (MARGIN * 2);
    
    // Table header
    doc.font(FONT.BOLD).fontSize(10);
    doc.rect(doc.x, tableTop, tableWidth, 20).fillAndStroke('#f2f2f2', '#cccccc');
    
    // Draw header text
    doc.fillColor('#000000');
    doc.text(texts.sku, MARGIN, tableTop + 5, { width: 100 });
    doc.text(texts.product, MARGIN + 100, tableTop + 5, { width: 250 });
    doc.text(texts.piecesPerBox, MARGIN + 350, tableTop + 5, { width: 100 });
    doc.text(texts.quantity, MARGIN + 450, tableTop + 5, { width: 50 });
    
    // Draw rows
    let y = tableTop + 20;
    doc.font(FONT.REGULAR).fontSize(9);
    
    for (const item of enhancedItems) {
      // Check if we need a new page
      if (y > PAGE_HEIGHT - MARGIN - 50) {
        doc.addPage();
        y = MARGIN;
        
        // Redraw header
        doc.font(FONT.BOLD).fontSize(10);
        doc.rect(doc.x, y, tableWidth, 20).fillAndStroke('#f2f2f2', '#cccccc');
        
        doc.fillColor('#000000');
        doc.text(texts.sku, MARGIN, y + 5, { width: 100 });
        doc.text(texts.product, MARGIN + 100, y + 5, { width: 250 });
        doc.text(texts.piecesPerBox, MARGIN + 350, y + 5, { width: 100 });
        doc.text(texts.quantity, MARGIN + 450, y + 5, { width: 50 });
        
        y += 20;
        doc.font(FONT.REGULAR).fontSize(9);
      }
      
      // Draw row background
      doc.rect(doc.x, y, tableWidth, 20).fillAndStroke('#ffffff', '#cccccc');
      
      // Draw item data
      doc.fillColor('#000000');
      doc.text(item.sku || '', MARGIN, y + 5, { width: 100 });
      
      // Product name - explicitly handle as UTF-8
      doc.text(item.name, MARGIN + 100, y + 5, { width: 250 });
      
      doc.text(item.piecesPerBox?.toString() || '', MARGIN + 350, y + 5, { width: 100 });
      doc.text(item.quantity.toString(), MARGIN + 450, y + 5, { width: 50 });
      
      y += 20;
    }
    
    // Add footer
    doc.font(FONT.REGULAR).fontSize(10);
    doc.text(
      `${texts.page} 1 ${texts.of} 1`,
      MARGIN,
      PAGE_HEIGHT - MARGIN - 10,
      { align: 'center', width: tableWidth }
    );
    
    // Finalize the document
    doc.end();
    return stream;
    
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    
    // Return error PDF
    doc.font(FONT.BOLD).fontSize(14)
      .text('Error generating PDF', { align: 'center' });
      
    doc.moveDown();
    
    doc.font(FONT.REGULAR).fontSize(10)
      .text(`Error: ${error.message}`, { align: 'center' });
      
    doc.end();
    return stream;
  }
}

// Translation helper
function getTranslatedTexts(language: string): Record<string, any> {
  if (language === 'el') {
    return {
      orderForm: 'Φόρμα Παραγγελίας',
      customer: 'Πελάτης',
      sku: 'Κωδικός SKU',
      product: 'Προϊόν',
      quantity: 'Ποσότητα',
      piecesPerBox: 'Τεμάχια/Κιβώτιο',
      page: 'Σελίδα',
      of: 'από'
    };
  }
  
  // Default to English
  return {
    orderForm: 'Order Form',
    customer: 'Customer',
    sku: 'SKU',
    product: 'Product',
    quantity: 'Quantity',
    piecesPerBox: 'Pieces/Box',
    page: 'Page',
    of: 'of'
  };
}