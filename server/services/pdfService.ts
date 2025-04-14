import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { storage } from '../storage';
import PDFDocumentWithTables from 'pdfkit-table';

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
const CHECKBOX_SIZE = 20; // Increased from 15 to 20
const CHECKBOX_MARGIN = 5;
const PRODUCT_CHECKBOX_SIZE = 15; // Size for product checkboxes

// Using built-in fonts with better Unicode support
const FONTS = {
  REGULAR: 'Helvetica',
  BOLD: 'Helvetica-Bold'
};

// Return a readable stream of the generated PDF
export async function generateOrderPDF(orderId: number, language: string = 'en'): Promise<Readable> {
  // Create a stream to return the PDF
  const buffers: Buffer[] = [];
  const stream = new Readable();
  
  // Initialize the PDF document with UTF-8 encoding for Greek characters
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: {
      Title: `Order #${orderId}`,
      Author: 'Warehouse Management System',
      Subject: 'Order Details'
    },
    // We are explicitly setting proper encoding for Greek characters
    pdfVersion: '1.7',
    lang: language === 'el' ? 'el-GR' : 'en-US',
    autoFirstPage: true,
    bufferPages: true
  });
  
  // Set default font with proper encoding for Greek characters
  doc.font(FONTS.REGULAR);
  
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
    
    // We also need to get the product details for each item, including tags
    const enhancedItems = await Promise.all(items.map(async item => {
      // Fetch product details
      const product = await storage.getProduct(item.productId);
      
      // Get product tags - using the array in product.tags or fetch from productTags table
      let productTags: string[] = [];
      if (product?.tags && Array.isArray(product.tags)) {
        productTags = product.tags;
      }
      
      return {
        ...item,
        // Add product details to each item
        name: product?.name || 'Unknown Product',
        sku: product?.sku || '',
        piecesPerBox: product?.unitsPerBox || 0,
        barcode: product?.barcode || '',
        tags: productTags,
        // If no tags, mark as "Uncategorized"
        tagGroup: productTags.length > 0 ? productTags[0] : 'Uncategorized'
      };
    }));
    
    // Group items by their first tag (or "Uncategorized" if no tags)
    const groupedItems: {[key: string]: Array<any>} = {};
    
    // First sort the items into groups by tag
    enhancedItems.forEach(item => {
      const tagGroup = item.tagGroup;
      if (!groupedItems[tagGroup]) {
        groupedItems[tagGroup] = [];
      }
      groupedItems[tagGroup].push(item);
    });
    
    // Create a sorted array of tag groups for consistent ordering
    const tagGroups = Object.keys(groupedItems).sort();
    
    // Add the items to the order object
    const orderWithItems = {
      ...order,
      items: enhancedItems,
      groupedItems,
      tagGroups
    };
    
    // Add translatable texts
    const texts = getTranslatedTexts(language);
    
    // Add title
    doc.font(FONTS.BOLD).fontSize(16)
      .text(`${texts.orderForm}: #${orderWithItems.orderNumber}`, MARGINS.left, MARGINS.top, { align: 'center' });
    
    // Add customer name under the order number
    doc.font(FONTS.REGULAR).fontSize(12)
      .text(`${texts.customer}: ${orderWithItems.customerName}`, MARGINS.left, MARGINS.top + 25, { align: 'center' });
    
    // Add items table
    doc.moveDown(3);
    
    // Table header
    const startY = doc.y;
    doc.font(FONTS.BOLD).fontSize(12);
    
    // Define checkbox size for each row - using the constant defined at the top
    const checkboxColumnWidth = PRODUCT_CHECKBOX_SIZE + 10; // Checkbox width plus margin
    
    const columnWidths = {
      checkbox: checkboxColumnWidth,
      sku: TABLE_WIDTH * 0.15,
      name: TABLE_WIDTH * 0.5,
      piecesPerBox: TABLE_WIDTH * 0.15,
      quantity: TABLE_WIDTH * 0.15
    };
    
    // Draw table header
    doc.rect(MARGINS.left, startY, TABLE_WIDTH, 30).fillAndStroke('#f2f2f2', '#cccccc');
    
    // Header text
    doc.fillColor('#000000');
    // Skip space for checkbox in header
    doc.text(texts.sku, MARGINS.left + columnWidths.checkbox + 5, startY + 10);
    doc.text(texts.product, MARGINS.left + columnWidths.checkbox + columnWidths.sku + 5, startY + 10);
    doc.text(texts.piecesPerBox, MARGINS.left + columnWidths.checkbox + columnWidths.sku + columnWidths.name + 5, startY + 10);
    doc.text(texts.quantity, MARGINS.left + columnWidths.checkbox + columnWidths.sku + columnWidths.name + columnWidths.piecesPerBox + 5, startY + 10);
    
    // Table rows
    let currentY = startY + 30;
    const rowHeight = 24; // Reduced row height
    let rowColor = '#ffffff';
    
    // Reset font for table content with smaller font
    doc.font(FONTS.REGULAR).fontSize(8);
    
    // Tag group header height
    const tagHeaderHeight = 25;
    
    // Loop through each tag group
    for (const tagGroup of orderWithItems.tagGroups) {
      // Check if we need a new page for tag header
      if (currentY + tagHeaderHeight > PAGE_HEIGHT - MARGINS.bottom - 50) {
        doc.addPage({ size: 'A4', margin: 0 });
        // Reset Y position and redraw header
        currentY = MARGINS.top;
        doc.font(FONTS.BOLD).fontSize(12);
        
        doc.rect(MARGINS.left, currentY, TABLE_WIDTH, 30).fillAndStroke('#f2f2f2', '#cccccc');
        
        doc.fillColor('#000000');
        // Skip space for checkbox in header (same as the first page)
        doc.text(texts.sku, MARGINS.left + columnWidths.checkbox + 5, currentY + 10);
        doc.text(texts.product, MARGINS.left + columnWidths.checkbox + columnWidths.sku + 5, currentY + 10);
        doc.text(texts.piecesPerBox, MARGINS.left + columnWidths.checkbox + columnWidths.sku + columnWidths.name + 5, currentY + 10);
        doc.text(texts.quantity, MARGINS.left + columnWidths.checkbox + columnWidths.sku + columnWidths.name + columnWidths.piecesPerBox + 5, currentY + 10);
        
        currentY += 30;
      }
      
      // Draw tag group header
      doc.rect(MARGINS.left, currentY, TABLE_WIDTH, tagHeaderHeight)
         .fillAndStroke('#e6e6e6', '#cccccc');
      
      // Set tag group header font
      doc.font(FONTS.BOLD).fontSize(10);
      doc.fillColor('#000000');
      
      // Tag group name - handle special case for "Uncategorized"
      let displayTagName;
      if (tagGroup === 'Uncategorized') {
        displayTagName = texts.uncategorized;
      } else {
        // For other tag groups, add the category/tag label and capitalize first letter of tag
        const tagLabel = texts.tag + ': ';
        displayTagName = tagLabel + tagGroup.charAt(0).toUpperCase() + tagGroup.slice(1);
      }
      doc.text(displayTagName, MARGINS.left + 10, currentY + 8);
      
      // Move to next row
      currentY += tagHeaderHeight;
      
      // Reset font for items
      doc.font(FONTS.REGULAR).fontSize(8);
      
      // Get items for this tag group
      const itemsInGroup = orderWithItems.groupedItems[tagGroup];
      
      // Sort items by name within the group for a more organized display
      itemsInGroup.sort((a: any, b: any) => a.name.localeCompare(b.name));
      
      // Loop through items in this tag group
      for (const item of itemsInGroup) {
        // Check if we need a new page
        if (currentY + rowHeight > PAGE_HEIGHT - MARGINS.bottom - 50) {
          doc.addPage({ size: 'A4', margin: 0 });
          // Reset Y position and redraw header
          currentY = MARGINS.top;
          doc.font(FONTS.BOLD).fontSize(12);
          
          doc.rect(MARGINS.left, currentY, TABLE_WIDTH, 30).fillAndStroke('#f2f2f2', '#cccccc');
          
          doc.fillColor('#000000');
          // Skip space for checkbox in header (same as the first page)
          doc.text(texts.sku, MARGINS.left + columnWidths.checkbox + 5, currentY + 10);
          doc.text(texts.product, MARGINS.left + columnWidths.checkbox + columnWidths.sku + 5, currentY + 10);
          doc.text(texts.piecesPerBox, MARGINS.left + columnWidths.checkbox + columnWidths.sku + columnWidths.name + 5, currentY + 10);
          doc.text(texts.quantity, MARGINS.left + columnWidths.checkbox + columnWidths.sku + columnWidths.name + columnWidths.piecesPerBox + 5, currentY + 10);
          
          currentY += 30;
          doc.font(FONTS.REGULAR).fontSize(8);
        }
        
        // Row background
        doc.rect(MARGINS.left, currentY, TABLE_WIDTH, rowHeight)
           .fillAndStroke(rowColor, '#cccccc');
        
        // Add checkbox for this product (using the constant defined at the top)
        doc.rect(MARGINS.left + 2, currentY + (rowHeight / 2) - (PRODUCT_CHECKBOX_SIZE / 2), 
                 PRODUCT_CHECKBOX_SIZE, PRODUCT_CHECKBOX_SIZE)
          .lineWidth(0.5)
          .stroke();
        
        // Item data
        doc.fillColor('#000000');
        // Adjust SKU position to account for the checkbox
        doc.text(item.sku || '', MARGINS.left + PRODUCT_CHECKBOX_SIZE + 7, currentY + 8);
        
        // Handle product name with UTF-8 encoding for Greek characters
        // Limit name length to prevent overflow
        const productName = item.name || '';
        const maxNameLength = 50; // Maximum characters to display
        
        // Convert Greek characters to normalized form for better encoding
        let normalizedName = '';
        try {
          // Try to normalize Unicode characters
          normalizedName = productName.normalize('NFC');
        } catch (e) {
          console.error('Error normalizing product name:', e);
          normalizedName = productName;
        }
        
        const displayName = normalizedName.length > maxNameLength ? 
          normalizedName.substring(0, maxNameLength) + '...' : 
          normalizedName;
        
        // Text options for proper rendering
        const textOptions = {
          width: columnWidths.name - 10,
          ellipsis: true,
          lineBreak: false
        };
        
        doc.text(displayName, MARGINS.left + columnWidths.checkbox + columnWidths.sku + 5, currentY + 8, textOptions);
        doc.text(item.piecesPerBox?.toString() || '', MARGINS.left + columnWidths.checkbox + columnWidths.sku + columnWidths.name + 5, currentY + 8);
        doc.text(item.quantity.toString(), MARGINS.left + columnWidths.checkbox + columnWidths.sku + columnWidths.name + columnWidths.piecesPerBox + 5, currentY + 8);
        
        // Alternate row colors
        rowColor = rowColor === '#ffffff' ? '#f9f9f9' : '#ffffff';
        currentY += rowHeight;
      }
      
      // Add small spacing between tag groups
      currentY += 5;
    }
    
    // Add verification checkboxes at the bottom
    const checkboxY = PAGE_HEIGHT - MARGINS.bottom - 60;
    
    // Front office checkbox
    doc.font(FONTS.BOLD).fontSize(10);
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
    
    // Add notes box if there are order notes
    if (orderWithItems.notes && orderWithItems.notes.trim()) {
      // Define notes box position and size
      const notesBoxY = checkboxY;
      const notesBoxX = PAGE_WIDTH / 2; // Position on right half of page
      const notesBoxWidth = TABLE_WIDTH / 2 - 10;
      const notesBoxHeight = CHECKBOX_SIZE * 2 + CHECKBOX_MARGIN;
      
      // Draw the notes box
      doc.rect(notesBoxX, notesBoxY, notesBoxWidth, notesBoxHeight)
        .lineWidth(1)
        .stroke();
        
      // Add the label
      doc.font(FONTS.BOLD).fontSize(10);
      doc.text(texts.notes, notesBoxX + 5, notesBoxY - 15);
      
      // Add the notes text with smaller font to fit in box
      doc.font(FONTS.REGULAR).fontSize(8);
      
      // Format notes text to fit in box
      const truncatedNotes = orderWithItems.notes.length > 100 ? 
        orderWithItems.notes.substring(0, 100) + '...' : 
        orderWithItems.notes;
      
      doc.text(truncatedNotes, notesBoxX + 5, notesBoxY + 5, {
        width: notesBoxWidth - 10,
        height: notesBoxHeight - 10,
        ellipsis: true
      });
    }
    
    // If we have shipping info, display it on the right side
    if (shippingInfo) {
      doc.font(FONTS.BOLD).fontSize(10);
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
      doc.font(FONTS.REGULAR).fontSize(10).text(
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
    doc.font(FONTS.BOLD).fontSize(16)
      .text('Error generating PDF', MARGINS.left, MARGINS.top + 100, { align: 'center' });
    doc.font(FONTS.REGULAR).fontSize(12)
      .text(`Error: ${error.message}`, MARGINS.left, MARGINS.top + 150, { align: 'center' });
    doc.end();
    return stream;
  }
}

// Translation helper
function getTranslatedTexts(language: string): Record<string, any> {
  // Add translations for PDF labels
  if (language === 'el') {
    // Create the translation object
    const translations = {
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
      warehouseVerified: 'Επαλήθευση από Αποθήκη',
      notes: 'Σημειώσεις',
      category: 'Κατηγορία',
      tag: 'Ετικέτα',
      uncategorized: 'Χωρίς Κατηγορία'
    };
    
    // Normalize all Greek strings for better encoding
    const normalizedTranslations: Record<string, string> = {};
    for (const [key, value] of Object.entries(translations)) {
      try {
        normalizedTranslations[key] = value.normalize('NFC');
      } catch (e) {
        console.error(`Error normalizing translation for ${key}:`, e);
        normalizedTranslations[key] = value;
      }
    }
    
    return normalizedTranslations;
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
    warehouseVerified: 'Warehouse Verified',
    notes: 'Notes',
    category: 'Category',
    tag: 'Tag',
    uncategorized: 'Uncategorized'
  };
}