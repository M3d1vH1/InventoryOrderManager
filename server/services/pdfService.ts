import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { getOrderWithItems } from '../api/utils';
import { IOrder } from '../types';
import { db } from '../db';
import JsBarcode from 'jsbarcode';
import { Canvas } from 'canvas';

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
      Subject: 'Order Details',
      Keywords: 'order, warehouse, pdf',
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
    
    // Add company logo if available
    try {
      const logoPath = path.join(process.cwd(), 'public', 'placeholder-image.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, MARGINS.left, MARGINS.top, { width: 100 });
        doc.moveDown(2);
      }
    } catch (error) {
      console.error('Error loading logo:', error);
    }
    
    // Add title and order info
    doc.font('Helvetica-Bold').fontSize(18)
      .text(`${texts.orderForm}: #${order.orderNumber}`, MARGINS.left, MARGINS.top + 50, { align: 'center' });
    
    // Add order barcode
    addBarcode(doc, order.orderNumber, MARGINS.left + 200, MARGINS.top + 80);

    // Add date and customer info
    doc.moveDown(3);
    doc.fontSize(12).font('Helvetica-Bold')
      .text(`${texts.date}:`, MARGINS.left, MARGINS.top + 150);
    doc.font('Helvetica')
      .text(new Date(order.orderDate).toLocaleDateString(language === 'el' ? 'el-GR' : 'en-US'), 200, MARGINS.top + 150);
    
    doc.font('Helvetica-Bold')
      .text(`${texts.customer}:`, MARGINS.left);
    doc.font('Helvetica')
      .text(order.customerName, 200);
    
    if (order.area) {
      doc.font('Helvetica-Bold')
        .text(`${texts.area}:`, MARGINS.left);
      doc.font('Helvetica')
        .text(order.area, 200);
    }
    
    // Add status
    doc.font('Helvetica-Bold')
      .text(`${texts.status}:`, MARGINS.left);
    doc.font('Helvetica')
      .text(texts.statusValues[order.status] || order.status, 200);
    
    // Add notes if available
    if (order.notes) {
      doc.moveDown();
      doc.font('Helvetica-Bold')
        .text(`${texts.notes}:`, MARGINS.left);
      doc.font('Helvetica')
        .text(order.notes, MARGINS.left, doc.y, { width: TABLE_WIDTH });
    }
    
    // Add items table
    doc.moveDown(2);
    
    // Table header
    const startY = doc.y;
    doc.font('Helvetica-Bold').fontSize(12);
    
    const columnWidths = {
      sku: TABLE_WIDTH * 0.15,
      name: TABLE_WIDTH * 0.4,
      quantity: TABLE_WIDTH * 0.15,
      barcode: TABLE_WIDTH * 0.2,
      picked: TABLE_WIDTH * 0.1
    };
    
    // Draw table header
    doc.rect(MARGINS.left, startY, TABLE_WIDTH, 30).fillAndStroke('#f2f2f2', '#cccccc');
    
    // Header text
    doc.fillColor('#000000');
    doc.text(texts.sku, MARGINS.left + 5, startY + 10);
    doc.text(texts.product, MARGINS.left + columnWidths.sku + 5, startY + 10);
    doc.text(texts.quantity, MARGINS.left + columnWidths.sku + columnWidths.name + 5, startY + 10);
    doc.text(texts.barcode, MARGINS.left + columnWidths.sku + columnWidths.name + columnWidths.quantity + 5, startY + 10);
    doc.text(texts.picked, MARGINS.left + columnWidths.sku + columnWidths.name + columnWidths.quantity + columnWidths.barcode + 5, startY + 10);
    
    // Table rows
    let currentY = startY + 30;
    const rowHeight = 40;
    let rowColor = '#ffffff';
    
    // Reset font for table content
    doc.font('Helvetica').fontSize(10);
    
    for (const item of order.items) {
      // Check if we need a new page
      if (currentY + rowHeight > PAGE_HEIGHT - MARGINS.bottom) {
        doc.addPage({ size: 'A4', margin: 0 });
        // Reset Y position and redraw header
        currentY = MARGINS.top;
        doc.font('Helvetica-Bold').fontSize(12);
        
        doc.rect(MARGINS.left, currentY, TABLE_WIDTH, 30).fillAndStroke('#f2f2f2', '#cccccc');
        
        doc.fillColor('#000000');
        doc.text(texts.sku, MARGINS.left + 5, currentY + 10);
        doc.text(texts.product, MARGINS.left + columnWidths.sku + 5, currentY + 10);
        doc.text(texts.quantity, MARGINS.left + columnWidths.sku + columnWidths.name + 5, currentY + 10);
        doc.text(texts.barcode, MARGINS.left + columnWidths.sku + columnWidths.name + columnWidths.quantity + 5, currentY + 10);
        doc.text(texts.picked, MARGINS.left + columnWidths.sku + columnWidths.name + columnWidths.quantity + columnWidths.barcode + 5, currentY + 10);
        
        currentY += 30;
        doc.font('Helvetica').fontSize(10);
      }
      
      // Row background
      doc.rect(MARGINS.left, currentY, TABLE_WIDTH, rowHeight)
         .fillAndStroke(rowColor, '#cccccc');
      
      // Item data
      doc.fillColor('#000000');
      doc.text(item.sku || '', MARGINS.left + 5, currentY + 15);
      doc.text(item.name, MARGINS.left + columnWidths.sku + 5, currentY + 15);
      doc.text(item.quantity.toString(), MARGINS.left + columnWidths.sku + columnWidths.name + 5, currentY + 15);
      
      // Try to add barcode for the item
      if (item.barcode) {
        addItemBarcode(doc, item.barcode, 
                      MARGINS.left + columnWidths.sku + columnWidths.name + columnWidths.quantity + 20, 
                      currentY + 10);
      } else {
        doc.text('N/A', MARGINS.left + columnWidths.sku + columnWidths.name + columnWidths.quantity + 20, currentY + 15);
      }
      
      // Draw checkbox for "Picked"
      doc.rect(
        MARGINS.left + columnWidths.sku + columnWidths.name + columnWidths.quantity + columnWidths.barcode + 20,
        currentY + 12,
        15,
        15
      ).stroke();
      
      // Alternate row colors
      rowColor = rowColor === '#ffffff' ? '#f9f9f9' : '#ffffff';
      currentY += rowHeight;
    }
    
    // Add footer with page numbers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(10).text(
        `${texts.page} ${i + 1} ${texts.of} ${totalPages}`,
        MARGINS.left,
        PAGE_HEIGHT - MARGINS.bottom / 2,
        { align: 'center', width: TABLE_WIDTH }
      );
      
      // Add signature lines
      doc.font('Helvetica').fontSize(10);
      
      // Prepared by
      doc.text(
        `${texts.preparedBy}: ___________________`,
        MARGINS.left,
        PAGE_HEIGHT - MARGINS.bottom - 50
      );
      
      // Shipping company
      if (order.shippingCompany) {
        doc.text(
          `${texts.shippingCompany}: ${order.shippingCompany}`,
          MARGINS.left + 250,
          PAGE_HEIGHT - MARGINS.bottom - 50
        );
      }
      
      // Date prepared
      doc.text(
        `${texts.date}: ___________________`,
        MARGINS.left,
        PAGE_HEIGHT - MARGINS.bottom - 30
      );
      
      // Signature
      doc.text(
        `${texts.signature}: ___________________`,
        MARGINS.left + 250,
        PAGE_HEIGHT - MARGINS.bottom - 30
      );
    }
    
    // Finalize the PDF
    doc.end();
    return stream;
  } catch (error) {
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

// Helper function to generate barcode image
function addBarcode(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number = 150): void {
  try {
    const canvas = new Canvas(width, 50);
    JsBarcode(canvas, text, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 12,
      height: 40,
      margin: 1
    });
    
    // Add the barcode to the PDF
    doc.image(canvas.toBuffer(), x, y, { width });
  } catch (error) {
    console.error('Error generating barcode:', error);
    // Fallback to text if barcode generation fails
    doc.text(text, x, y);
  }
}

// Helper function to generate item barcode
function addItemBarcode(doc: PDFKit.PDFDocument, text: string, x: number, y: number): void {
  try {
    const canvas = new Canvas(100, 30);
    JsBarcode(canvas, text, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 8,
      height: 25,
      margin: 1,
      width: 1
    });
    
    // Add the barcode to the PDF
    doc.image(canvas.toBuffer(), x, y, { width: 100 });
  } catch (error) {
    console.error('Error generating item barcode:', error);
    // Fallback to text if barcode generation fails
    doc.text(text, x, y);
  }
}

// Translation helper
function getTranslatedTexts(language: string): Record<string, any> {
  // Add translations for PDF labels
  if (language === 'el') {
    return {
      orderForm: 'Φόρμα Παραγγελίας',
      date: 'Ημερομηνία',
      customer: 'Πελάτης',
      area: 'Περιοχή',
      status: 'Κατάσταση',
      notes: 'Σημειώσεις',
      sku: 'Κωδικός SKU',
      product: 'Προϊόν',
      quantity: 'Ποσότητα',
      barcode: 'Barcode',
      picked: 'Συλλογή',
      page: 'Σελίδα',
      of: 'από',
      preparedBy: 'Προετοιμάστηκε από',
      shippingCompany: 'Εταιρεία Μεταφοράς',
      signature: 'Υπογραφή',
      statusValues: {
        pending: 'Σε Εκκρεμότητα',
        picked: 'Συλλεχθείσα',
        shipped: 'Απεσταλμένη',
        delivered: 'Παραδομένη',
        cancelled: 'Ακυρωμένη',
        partially_shipped: 'Μερικώς Απεσταλμένη'
      }
    };
  }
  
  // Default to English
  return {
    orderForm: 'Order Form',
    date: 'Date',
    customer: 'Customer',
    area: 'Area',
    status: 'Status',
    notes: 'Notes',
    sku: 'SKU',
    product: 'Product',
    quantity: 'Quantity',
    barcode: 'Barcode',
    picked: 'Picked',
    page: 'Page',
    of: 'of',
    preparedBy: 'Prepared by',
    shippingCompany: 'Shipping Company',
    signature: 'Signature',
    statusValues: {
      pending: 'Pending',
      picked: 'Picked',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      partially_shipped: 'Partially Shipped'
    }
  };
}