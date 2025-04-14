import { Readable } from 'stream';
import { storage } from '../storage';
import puppeteer from 'puppeteer';

// Return a readable stream of the generated PDF using Puppeteer
export async function generateOrderPDF(orderId: number, language: string = 'en'): Promise<Readable> {
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
    
    // Generate HTML content
    const htmlContent = generateOrderHTML(orderWithItems, texts);
    
    // Launch a browser instance using system-installed Chromium
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
    });
    
    // Create a new page
    const page = await browser.newPage();
    
    // Set content to our generated HTML
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Generate PDF from the page
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });
    
    // Close the browser
    await browser.close();
    
    // Create a readable stream from the PDF buffer
    const stream = new Readable();
    stream.push(pdfBuffer);
    stream.push(null);
    
    return stream;
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    
    // Create a simple error PDF using HTML and Puppeteer
    try {
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
      });
      const page = await browser.newPage();
      
      // Generate simple error HTML
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Error</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 2cm; }
            h1 { color: #ff0000; }
          </style>
        </head>
        <body>
          <h1>Error generating PDF</h1>
          <p>${error.message}</p>
        </body>
        </html>
      `;
      
      await page.setContent(errorHtml);
      
      // Generate PDF
      const pdfBuffer = await page.pdf({ format: 'A4' });
      
      // Close browser
      await browser.close();
      
      // Create stream
      const stream = new Readable();
      stream.push(pdfBuffer);
      stream.push(null);
      
      return stream;
    } catch (fallbackError) {
      console.error('Error creating fallback error PDF:', fallbackError);
      
      // Ultimate fallback - empty PDF
      const stream = new Readable();
      stream.push(Buffer.from('%PDF-1.7\n1 0 obj<</Type/Catalog/Pages 2 0 R>>\nendobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>\nendobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>\nendobj\n4 0 obj<</Length 8>>stream\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \n0000000194 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n249\n%%EOF\n'));
      stream.push(null);
      
      return stream;
    }
  }
}

// Function to generate HTML content for the order
function generateOrderHTML(orderWithItems: any, texts: Record<string, string>): string {
  // Get shipping info if available
  let shippingInfo = '';
  if ((orderWithItems as any).shippingCompany) {
    shippingInfo = (orderWithItems as any).shippingCompany;
  } else if (orderWithItems.area) {
    shippingInfo = orderWithItems.area;
  }
  
  // HTML template with CSS for printing
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Order #${orderWithItems.orderNumber}</title>
      <style>
        @page {
          size: A4;
          margin: 1cm;
        }
        body {
          font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
          margin: 0;
          padding: 0;
          font-size: 12px;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .subtitle {
          font-size: 14px;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background-color: #f2f2f2;
          padding: 8px;
          text-align: left;
          border: 1px solid #ddd;
          font-weight: bold;
        }
        td {
          padding: 8px;
          border: 1px solid #ddd;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .tag-header {
          background-color: #e6e6e6;
          padding: 8px;
          font-weight: bold;
          border: 1px solid #ddd;
        }
        .checkbox {
          width: 15px;
          height: 15px;
          border: 1px solid #000;
          display: inline-block;
          margin-right: 5px;
        }
        .verification {
          margin-top: 30px;
        }
        .verification-item {
          margin-bottom: 10px;
        }
        .notes-box {
          border: 1px solid #ddd;
          padding: 10px;
          margin-top: 20px;
          min-height: 60px;
        }
        .notes-title {
          font-weight: bold;
          margin-bottom: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          font-size: 10px;
          position: fixed;
          bottom: 1cm;
          left: 0;
          right: 0;
        }
        .notes-container {
          float: right;
          width: 45%;
        }
        .verification-container {
          float: left;
          width: 45%;
        }
        .clearfix::after {
          content: "";
          clear: both;
          display: table;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${texts.orderForm}: #${orderWithItems.orderNumber}</div>
        <div class="subtitle">${texts.customer}: ${orderWithItems.customerName}</div>
      </div>
      
      <!-- Iterate through each tag group -->
      ${orderWithItems.tagGroups.map((tagGroup: string) => {
        // Get display name for the tag
        let displayTagName;
        if (tagGroup === 'Uncategorized') {
          displayTagName = texts.uncategorized;
        } else {
          // For other tag groups, add the category/tag label and capitalize first letter of tag
          const tagLabel = texts.tag + ': ';
          displayTagName = tagLabel + tagGroup.charAt(0).toUpperCase() + tagGroup.slice(1);
        }
        
        // Sort items alphabetically by name
        const itemsInGroup = [...orderWithItems.groupedItems[tagGroup]].sort((a: any, b: any) => 
          a.name.localeCompare(b.name)
        );
        
        return `
          <div class="tag-header">${displayTagName}</div>
          <table>
            <thead>
              <tr>
                <th width="5%"></th>
                <th width="15%">${texts.sku}</th>
                <th width="50%">${texts.product}</th>
                <th width="15%">${texts.piecesPerBox}</th>
                <th width="15%">${texts.quantity}</th>
              </tr>
            </thead>
            <tbody>
              ${itemsInGroup.map((item: any) => `
                <tr>
                  <td><div class="checkbox"></div></td>
                  <td>${item.sku || ''}</td>
                  <td>${item.name || ''}</td>
                  <td>${item.piecesPerBox || ''}</td>
                  <td>${item.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }).join('')}
      
      <!-- Bottom section with verification and notes -->
      <div class="clearfix">
        <div class="verification-container">
          <div class="verification">
            <div class="verification-item">
              <div class="checkbox"></div> ${texts.frontOfficeVerified}
            </div>
            <div class="verification-item">
              <div class="checkbox"></div> ${texts.warehouseVerified}
            </div>
          </div>
          
          ${shippingInfo ? `
            <div style="margin-top: 20px;">
              <strong>${texts.shippingCompany}:</strong> ${shippingInfo}
            </div>
          ` : ''}
        </div>
        
        ${orderWithItems.notes && orderWithItems.notes.trim() ? `
          <div class="notes-container">
            <div class="notes-title">${texts.notes}</div>
            <div class="notes-box">
              ${orderWithItems.notes}
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="footer">
        ${texts.page} 1 ${texts.of} 1
      </div>
    </body>
    </html>
  `;
}

// Translation helper
function getTranslatedTexts(language: string): Record<string, string> {
  // Add translations for PDF labels
  if (language === 'el') {
    // Return Greek translations
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
      warehouseVerified: 'Επαλήθευση από Αποθήκη',
      notes: 'Σημειώσεις',
      category: 'Κατηγορία',
      tag: 'Ετικέτα',
      uncategorized: 'Χωρίς Κατηγορία'
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
    warehouseVerified: 'Warehouse Verified',
    notes: 'Notes',
    category: 'Category',
    tag: 'Tag',
    uncategorized: 'Uncategorized'
  };
}