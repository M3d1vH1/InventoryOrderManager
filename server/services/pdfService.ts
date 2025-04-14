import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { getOrderWithItems } from '../api/utils';

// Margins in points (72 points = 1 inch, A4 = 595.28 x 841.89 points)
const MARGINS = {
  top: 50,
  bottom: 50,
  left: 50,
  right: 50
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const TABLE_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right;

// Return a readable stream of the generated PDF
export async function generateOrderPDF(orderId: number, language: string = 'en'): Promise<Readable> {
  // Create a stream to return the PDF
  const buffers: Buffer[] = [];
  const stream = new Readable();
  
  // Initialize the PDF document
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: {
      Title: `Order #${orderId}`,
      Author: 'Warehouse Management System',
      Subject: 'Order Details'
    }
  });
  
  // Write to buffers
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    stream.push(Buffer.concat(buffers));
    stream.push(null);
  });
  
  try {
    // Get the order data
    const order = await getOrderWithItems(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found`);
    }
    
    // Add translatable texts
    const texts = getTranslatedTexts(language);
    
    // Add title
    doc.font('Helvetica-Bold').fontSize(16)
      .text(`${texts.orderForm}: #${order.orderNumber}`, MARGINS.left, MARGINS.top, { align: 'center' });
    
    // Add items table
    doc.moveDown(2);
    
    // Table header
    const startY = doc.y;
    doc.font('Helvetica-Bold').fontSize(12);
    
    const columnWidths = {
      sku: TABLE_WIDTH * 0.2,
      name: TABLE_WIDTH * 0.5,
      piecesPerBox: TABLE_WIDTH * 0.15,
      quantity: TABLE_WIDTH * 0.15
    };
    
    // Draw table header
    doc.rect(MARGINS.left, startY, TABLE_WIDTH, 30).fillAndStroke('#f2f2f2', '#cccccc');
    
    // Header text
    doc.fillColor('#000000');
    doc.text(texts.sku, MARGINS.left + 5, startY + 10);
    doc.text(texts.product, MARGINS.left + columnWidths.sku + 5, startY + 10);
    doc.text(texts.piecesPerBox, MARGINS.left + columnWidths.sku + columnWidths.name + 5, startY + 10);
    doc.text(texts.quantity, MARGINS.left + columnWidths.sku + columnWidths.name + columnWidths.piecesPerBox + 5, startY + 10);
    
    // Table rows
    let currentY = startY + 30;
    const rowHeight = 30;
    let rowColor = '#ffffff';
    
    // Reset font for table content
    doc.font('Helvetica').fontSize(10);
    
    for (const item of order.items) {
      // Check if we need a new page
      if (currentY + rowHeight > PAGE_HEIGHT - MARGINS.bottom - 50) {
        doc.addPage({ size: 'A4', margin: 0 });
        // Reset Y position and redraw header
        currentY = MARGINS.top;
        doc.font('Helvetica-Bold').fontSize(12);
        
        doc.rect(MARGINS.left, currentY, TABLE_WIDTH, 30).fillAndStroke('#f2f2f2', '#cccccc');
        
        doc.fillColor('#000000');
        doc.text(texts.sku, MARGINS.left + 5, currentY + 10);
        doc.text(texts.product, MARGINS.left + columnWidths.sku + 5, currentY + 10);
        doc.text(texts.piecesPerBox, MARGINS.left + columnWidths.sku + columnWidths.name + 5, currentY + 10);
        doc.text(texts.quantity, MARGINS.left + columnWidths.sku + columnWidths.name + columnWidths.piecesPerBox + 5, currentY + 10);
        
        currentY += 30;
        doc.font('Helvetica').fontSize(10);
      }
      
      // Row background
      doc.rect(MARGINS.left, currentY, TABLE_WIDTH, rowHeight)
         .fillAndStroke(rowColor, '#cccccc');
      
      // Item data
      doc.fillColor('#000000');
      doc.text(item.sku || '', MARGINS.left + 5, currentY + 10);
      doc.text(item.name || '', MARGINS.left + columnWidths.sku + 5, currentY + 10);
      doc.text(item.piecesPerBox?.toString() || '', MARGINS.left + columnWidths.sku + columnWidths.name + 5, currentY + 10);
      doc.text(item.quantity.toString(), MARGINS.left + columnWidths.sku + columnWidths.name + columnWidths.piecesPerBox + 5, currentY + 10);
      
      // Alternate row colors
      rowColor = rowColor === '#ffffff' ? '#f9f9f9' : '#ffffff';
      currentY += rowHeight;
    }
    
    // Add customer and shipping info at the bottom
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(
      `${texts.customer}: ${order.customerName}`,
      MARGINS.left,
      PAGE_HEIGHT - MARGINS.bottom - 30
    );
    
    // Shipping company
    if (order.shippingCompany) {
      doc.text(
        `${texts.shippingCompany}: ${order.shippingCompany}`,
        MARGINS.left,
        PAGE_HEIGHT - MARGINS.bottom - 10
      );
    }
    
    // Add page numbers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(10).text(
        `${texts.page} ${i + 1} ${texts.of} ${totalPages}`,
        MARGINS.left,
        PAGE_HEIGHT - MARGINS.bottom / 2,
        { align: 'center', width: TABLE_WIDTH }
      );
    }
    
    // Finalize the PDF
    doc.end();
    return stream;
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    // Handle errors by returning a simple error PDF
    doc.font('Helvetica-Bold').fontSize(16)
      .text('Error generating PDF', MARGINS.left, MARGINS.top + 100, { align: 'center' });
    doc.font('Helvetica').fontSize(12)
      .text(`Error: ${error.message}`, MARGINS.left, MARGINS.top + 150, { align: 'center' });
    doc.end();
    return stream;
  }
}

// Translation helper
function getTranslatedTexts(language: string): Record<string, any> {
  // Add translations for PDF labels
  if (language === 'el') {
    return {
      orderForm: 'Φόρμα Παραγγελίας',
      customer: 'Πελάτης',
      sku: 'Κωδικός SKU',
      product: 'Προϊόν',
      quantity: 'Ποσότητα',
      piecesPerBox: 'Τεμάχια/Κιβώτιο',
      page: 'Σελίδα',
      of: 'από',
      shippingCompany: 'Εταιρεία Μεταφοράς'
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
    of: 'of',
    shippingCompany: 'Shipping Company'
  };
}