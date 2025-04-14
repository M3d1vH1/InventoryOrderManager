import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { storage } from '../storage';

// Margins in points (72 points = 1 inch, A4 = 595.28 x 841.89 points)
const MARGINS = {
  top: 50,
  bottom: 80, // Increased for checkboxes at bottom
  left: 50,
  right: 50
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const TABLE_WIDTH = PAGE_WIDTH - MARGINS.left - MARGINS.right;

// Checkbox size and positioning
const CHECKBOX_SIZE = 15;
const CHECKBOX_MARGIN = 5;

// Return a readable stream of the generated PDF
export async function generateOrderPDF(orderId: number, language: string = 'en'): Promise<Readable> {
  // Create a stream to return the PDF
  const buffers: Buffer[] = [];
  const stream = new Readable();
  
  // Initialize the PDF document with proper font encoding for Greek characters
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: {
      Title: `Order #${orderId}`,
      Author: 'Warehouse Management System',
      Subject: 'Order Details'
    },
    // Set default encoding to support international characters including Greek
    lang: language === 'el' ? 'el-GR' : 'en-US',
    pdfVersion: '1.7'
  });
  
  // Write to buffers
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    stream.push(Buffer.concat(buffers));
    stream.push(null);
  });
  
  try {
    // Get the order data
    const order = await storage.getOrder(orderId);
    if (!order) {
      throw new Error(`Order #${orderId} not found`);
    }
    
    // Get the order items
    const items = await storage.getOrderItems(orderId);
    
    // We also need to get the product details for each item
    const enhancedItems = await Promise.all(items.map(async item => {
      // Fetch product details
      const product = await storage.getProduct(item.productId);
      
      return {
        ...item,
        // Add product details to each item
        name: product?.name || 'Unknown Product',
        sku: product?.sku || '',
        piecesPerBox: product?.unitsPerBox || 0,
        barcode: product?.barcode || ''
      };
    }));
    
    // Add the items to the order object
    const orderWithItems = {
      ...order,
      items: enhancedItems
    };
    
    // Add translatable texts
    const texts = getTranslatedTexts(language);
    
    // Add title
    doc.font('Helvetica-Bold').fontSize(16)
      .text(`${texts.orderForm}: #${orderWithItems.orderNumber}`, MARGINS.left, MARGINS.top, { align: 'center' });
    
    // Add customer name under the order number
    doc.font('Helvetica').fontSize(12)
      .text(`${texts.customer}: ${orderWithItems.customerName}`, MARGINS.left, MARGINS.top + 25, { align: 'center' });
    
    // Add items table
    doc.moveDown(3);
    
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
    
    for (const item of orderWithItems.items) {
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
      
      // Handle product name - fix encoding issues by using standard Latin-1 characters where possible
      // and limit name length to prevent overflow
      const productName = item.name || '';
      const maxNameLength = 50; // Maximum characters to display
      const displayName = productName.length > maxNameLength ? 
        productName.substring(0, maxNameLength) + '...' : 
        productName;
        
      // Text options for proper rendering
      const textOptions = {
        width: columnWidths.name - 10,
        ellipsis: true,
        lineBreak: false
      };
      
      doc.text(displayName, MARGINS.left + columnWidths.sku + 5, currentY + 10, textOptions);
      doc.text(item.piecesPerBox?.toString() || '', MARGINS.left + columnWidths.sku + columnWidths.name + 5, currentY + 10);
      doc.text(item.quantity.toString(), MARGINS.left + columnWidths.sku + columnWidths.name + columnWidths.piecesPerBox + 5, currentY + 10);
      
      // Alternate row colors
      rowColor = rowColor === '#ffffff' ? '#f9f9f9' : '#ffffff';
      currentY += rowHeight;
    }
    
    // Add verification checkboxes at the bottom
    const checkboxY = PAGE_HEIGHT - MARGINS.bottom - 60;
    
    // Front office checkbox
    doc.font('Helvetica-Bold').fontSize(10);
    // Draw checkbox
    doc.rect(MARGINS.left, checkboxY, CHECKBOX_SIZE, CHECKBOX_SIZE)
      .lineWidth(1)
      .stroke();
    // Label
    doc.text(texts.frontOfficeVerified, 
      MARGINS.left + CHECKBOX_SIZE + CHECKBOX_MARGIN, 
      checkboxY + 3);
    
    // Warehouse checkbox
    const warehouseCheckboxY = checkboxY + CHECKBOX_SIZE + CHECKBOX_MARGIN;
    // Draw checkbox
    doc.rect(MARGINS.left, warehouseCheckboxY, CHECKBOX_SIZE, CHECKBOX_SIZE)
      .lineWidth(1)
      .stroke();
    // Label
    doc.text(texts.warehouseVerified, 
      MARGINS.left + CHECKBOX_SIZE + CHECKBOX_MARGIN, 
      warehouseCheckboxY + 3);
    
    // Shipping company - check if it exists in the order schema
    // Try the area field as it's often used to store shipping info
    let shippingInfo = '';
    
    // Try different possible fields in order of likelihood
    if ((orderWithItems as any).shippingCompany) {
      shippingInfo = (orderWithItems as any).shippingCompany;
    } else if (orderWithItems.area) {
      shippingInfo = orderWithItems.area;
    }
    
    // If we have shipping info, display it on the right side
    if (shippingInfo) {
      doc.font('Helvetica-Bold').fontSize(12);
      const rightAlign = PAGE_WIDTH - MARGINS.right - (MARGINS.left * 2);
      doc.text(
        `${texts.shippingCompany}: ${shippingInfo}`,
        MARGINS.left,
        PAGE_HEIGHT - MARGINS.bottom - 10,
        { width: rightAlign, align: 'left' }
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
      shippingCompany: 'Εταιρεία Μεταφοράς',
      frontOfficeVerified: 'Επαλήθευση από Γραφείο',
      warehouseVerified: 'Επαλήθευση από Αποθήκη'
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
    shippingCompany: 'Shipping Company',
    frontOfficeVerified: 'Front Office Verified',
    warehouseVerified: 'Warehouse Verified'
  };
}