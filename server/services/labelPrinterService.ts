import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from '../storage';
import { Product } from '../../shared/schema';
// Import HTML-based rendering instead of Canvas

const execPromise = promisify(exec);

// CAB EOS1 specific configurations
const PRINTER_MODEL = 'EOS1';
const PRINTER_DPI = 300;
const LABEL_WIDTH_MM = 100; // 10 cm width
const LABEL_HEIGHT_MM = 70;  // 7 cm height
const LOGO_PATH_PNG = path.join(process.cwd(), 'public', 'shipping-logo.png');
const LOGO_PATH_SVG = path.join(process.cwd(), 'public', 'simple-logo.svg');

// Convert from mm to dots based on DPI
const mmToDots = (mm: number): number => Math.round((mm * PRINTER_DPI) / 25.4);

// Width and height in dots
const labelWidthDots = mmToDots(LABEL_WIDTH_MM);
const labelHeightDots = mmToDots(LABEL_HEIGHT_MM);

// Define OrderWithItems interface
interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  shipped_quantity?: number | null;
  shipping_status?: string | null;
  hasQualityIssues?: boolean | null;
  // These will be fetched from products table
  name?: string;
  sku?: string;
  category?: string | null;
  tags?: string[] | null;
  piecesPerBox?: number | null;
}

interface Customer {
  id: number;
  name: string;
  vatNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  shippingCompany?: string | null;
  preferredShippingCompany?: string | null;
  billingCompany?: string | null;
  notes?: string | null;
  createdAt: Date;
}

interface OrderWithItems {
  id: number;
  orderNumber: string;
  customerName: string;
  customerAddress?: string | null;
  customerCity?: string | null;
  customerState?: string | null;
  customerPostalCode?: string | null;
  customerCountry?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerVat?: string | null;
  status: string;
  priority?: string | null;
  area?: string | null;
  notes?: string | null;
  items: OrderItem[];
  customer?: Customer | null;
  createdAt?: Date;
  updatedAt?: Date;
  orderDate?: Date;
}

/**
 * Service for generating and printing shipping labels using CAB EOS1 printer
 */
export class LabelPrinterService {
  /**
   * Generate JScript code for a shipping label
   * @param order The order data to print on the label
   * @param boxCount Number of boxes for this shipment
   * @param currentBox Current box number
   * @returns JScript code as string
   */
  generateLabelJScript(order: OrderWithItems, boxCount: number, currentBox: number): string {
    // Get shipping info from customer if available
    let shippingCompanyInfo = '';
    
    // First check customer info
    const customer = order.customer || null;
    
    if (customer?.shippingCompany) {
      shippingCompanyInfo = customer.shippingCompany;
    } else if (customer?.preferredShippingCompany) {
      shippingCompanyInfo = customer.preferredShippingCompany;
    } else if (customer?.billingCompany) {
      shippingCompanyInfo = customer.billingCompany;
    } else if ((order as any).shippingCompany) {
      shippingCompanyInfo = (order as any).shippingCompany;
    } else if (order.area) {
      shippingCompanyInfo = order.area;
    }

    // Build customer address from order data
    const customerInfo = order.customerName || '';
    const addressParts = [];
    
    if (order.customerAddress) addressParts.push(order.customerAddress);
    if (order.customerCity) addressParts.push(order.customerCity);
    if (order.customerState) addressParts.push(order.customerState);
    if (order.customerPostalCode) addressParts.push(order.customerPostalCode);
    
    const customerAddress = addressParts.join(', ');
    const customerPhone = order.customerPhone || '';
    
    // Box count information
    const boxInfo = `${currentBox} / ${boxCount}`;
    
    // Create JScript commands for the label
    const jScript = `
m m
j
h ${PRINTER_DPI}
O R
; Initialize label format
J
S l1;0,0,${labelWidthDots},${labelHeightDots},100

; Set label size
H ${labelHeightDots},0,T,P

; Print logo at the top (using exact path)
GI 10,10,"public/shipping-logo.png"

; Customer name (bold)
T 10,50,0,3,pt15,b:"${customerInfo}"

; Customer address
T 10,80,0,3,pt12:"${customerAddress}"

; Customer phone
T 10,110,0,3,pt12:"Τηλέφωνο: ${customerPhone}"

; Shipping company info (bold)
T 10,150,0,3,pt12,b:"Μεταφορική: ${shippingCompanyInfo}"

; Box count (bold, larger)
T 10,180,0,3,pt20,b:"Κιβώτιο: ${boxInfo}"

; Order number reference
T 10,220,0,3,pt12:"Αρ. Παραγγελίας: ${order.orderNumber}"

; Print command
A 1

; End job
O
E
`;

    return jScript;
  }

  /**
   * Save JScript to a temporary file
   * @param jScript JScript commands
   * @returns Path to the saved file
   */
  async saveJScriptToFile(jScript: string): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, `label-${Date.now()}.txt`);
    await fs.promises.writeFile(filePath, jScript, 'utf8');
    
    return filePath;
  }
  
  /**
   * Copy logo to public directory for printer access
   */
  async ensureLogoAvailable(): Promise<void> {
    const sourceLogo = path.join(process.cwd(), 'attached_assets', 'Frame 40.png');
    const targetDir = path.join(process.cwd(), 'public');
    const targetLogo = path.join(targetDir, 'shipping-logo.png');
    const targetSvgLogo = path.join(targetDir, 'simple-logo.svg');
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Always copy the PNG logo to ensure the latest version is used
    if (fs.existsSync(sourceLogo)) {
      // Copy logo file even if it exists to ensure latest version
      console.log(`Copying logo from ${sourceLogo} to ${targetLogo} for label printing`);
      await fs.promises.copyFile(sourceLogo, targetLogo);
      
      // Set proper permissions for web access
      try {
        fs.chmodSync(targetLogo, 0o644);
        console.log('Updated logo file permissions for web access');
      } catch (error) {
        console.error('Failed to update permissions:', error);
      }
    } else {
      console.error(`Warning: Logo source file not found at ${sourceLogo}`);
      
      // As a fallback, create a placeholder text-based logo if needed
      if (!fs.existsSync(targetLogo)) {
        console.log('Creating placeholder logo image for labels');
        const placeholderPath = path.join(process.cwd(), 'public', 'placeholder-image.png');
        if (fs.existsSync(placeholderPath)) {
          await fs.promises.copyFile(placeholderPath, targetLogo);
          fs.chmodSync(targetLogo, 0o644);
        }
      }
    }
    
    // Create SVG logo if it doesn't exist
    if (!fs.existsSync(targetSvgLogo)) {
      console.log('Creating SVG logo for label printing');
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="50" viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="200" height="50" fill="#f8f8f8" rx="5" ry="5"/>
  <text x="10" y="30" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0055aa">Amphoreus</text>
  <text x="10" y="45" font-family="Arial, sans-serif" font-size="12" fill="#555555">Olive Oil Company</text>
</svg>`;
      await fs.promises.writeFile(targetSvgLogo, svgContent, 'utf8');
      fs.chmodSync(targetSvgLogo, 0o644);
    }
  }

  /**
   * Generate a visual preview of the shipping label
   * @param order Order data
   * @param boxCount Total number of boxes
   * @param currentBox Current box number
   * @returns HTML content for preview
   */
  async generatePreview(orderId: number, boxCount: number, currentBox: number): Promise<string> {
    try {
      // Log the exact user-specified box count values in preview generation
      console.log(`[labelPrinterService:preview] Preview with exact user values - Box count: ${boxCount}, Current box: ${currentBox}`);
      
      // Ensure logo is available
      await this.ensureLogoAvailable();
      
      // Get order data
      const order = await storage.getOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Get order items
      const orderItems = await storage.getOrderItems(orderId);
      
      // Get product details for each item
      const enhancedItems: OrderItem[] = [];
      
      for (const item of orderItems) {
        const product = await storage.getProduct(item.productId);
        
        enhancedItems.push({
          ...item,
          name: product?.name || 'Unknown Product',
          sku: product?.sku || 'N/A',
          category: product?.categoryId ? String(product.categoryId) : null
        });
      }
      
      // Create order with items
      const orderWithItems: OrderWithItems = {
        ...order,
        items: enhancedItems,
        createdAt: order.orderDate || new Date(),
        updatedAt: order.lastUpdated || new Date()
      };
      
      // Get customer info if available
      if (order.customerName) {
        orderWithItems.customer = await storage.getCustomerByName(order.customerName);
      }
      
      // Get shipping info from customer if available
      let shippingCompanyInfo = '';
      const customer = orderWithItems.customer || null;
      
      if (customer?.shippingCompany) {
        shippingCompanyInfo = customer.shippingCompany;
      } else if (customer?.preferredShippingCompany) {
        shippingCompanyInfo = customer.preferredShippingCompany;
      } else if (customer?.billingCompany) {
        shippingCompanyInfo = customer.billingCompany;
      } else if ((orderWithItems as any).shippingCompany) {
        shippingCompanyInfo = (orderWithItems as any).shippingCompany;
      } else if (orderWithItems.area) {
        shippingCompanyInfo = orderWithItems.area;
      }
      
      // Build customer address
      const addressParts = [];
      if (orderWithItems.customerAddress) addressParts.push(orderWithItems.customerAddress);
      if (orderWithItems.customerCity) addressParts.push(orderWithItems.customerCity);
      if (orderWithItems.customerState) addressParts.push(orderWithItems.customerState);
      if (orderWithItems.customerPostalCode) addressParts.push(orderWithItems.customerPostalCode);
      
      const address = addressParts.join(', ');
      
      // Box info
      const boxInfo = `${currentBox} / ${boxCount}`;
      
      // Create HTML preview
      const logoPath = '/simple-logo.svg'; // Public URL to the SVG logo
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shipping Label Preview</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
          }
          .label-container {
            width: ${LABEL_WIDTH_MM * 3.779528}px; /* Convert mm to pixels at 96 DPI */
            height: ${LABEL_HEIGHT_MM * 3.779528}px;
            border: 1px solid #000;
            margin: 20px auto;
            padding: 10px;
            position: relative;
            box-sizing: border-box;
            background-color: white;
          }
          .logo {
            display: block;
            max-width: 150px;
            max-height: 45px;
            margin-bottom: 20px;
          }
          .barcode {
            height: 40px;
            margin-bottom: 15px;
            background-color: #f8f8f8;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: monospace;
            border: 1px solid #ddd;
          }
          .customer-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .customer-address, .customer-phone {
            font-size: 14px;
            margin-bottom: 8px;
          }
          .shipping-company {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 15px;
          }
          .box-count {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #0055aa;
          }
          .order-number {
            font-size: 14px;
            margin-bottom: 8px;
            display: inline-block;
          }
          .order-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="label-container">
          <!-- Logo at the top with simple fallback text -->
          <img src="${logoPath}" class="logo" alt="Company Logo" onerror="this.onerror=null; this.src='/simple-logo.svg'" />
          
          <!-- Barcode placeholder -->
          <div class="barcode">Barcode: ${orderWithItems.orderNumber}</div>
          
          <!-- Order and Box info in the same line -->
          <div class="order-info">
            <div class="order-number">Αρ. Παραγγελίας: ${orderWithItems.orderNumber}</div>
            <div class="box-count">BOX: ${boxInfo}</div>
          </div>
          
          <!-- Customer information -->
          <div class="customer-name">${orderWithItems.customerName || ''}</div>
          <div class="customer-address">${address}</div>
          <div class="customer-phone">Τηλέφωνο: ${orderWithItems.customerPhone || ''}</div>
          
          <!-- Shipping information -->
          <div class="shipping-company">Μεταφορική: ${shippingCompanyInfo}</div>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <p>This is a preview of how the label will appear on the printer.</p>
          <p>The actual label will be ${LABEL_WIDTH_MM}mm x ${LABEL_HEIGHT_MM}mm.</p>
        </div>
      </body>
      </html>
      `;
      
      // Save HTML to a temporary file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const previewPath = path.join(tempDir, `label-preview-${orderId}-${currentBox}-${Date.now()}.html`);
      await fs.promises.writeFile(previewPath, html, 'utf8');
      
      return previewPath;
    } catch (error: any) {
      console.error('Failed to generate label preview:', error);
      throw error;
    }
  }

  /**
   * Send JScript file to printer via USB
   * @param filePath Path to JScript file
   * @returns Success message or error
   */
  async sendToPrinter(filePath: string): Promise<string> {
    try {
      // For Windows, we would use direct USB printing
      // For Linux, we'll simulate the printer command with echo for now
      // This would be replaced with actual USB printing in production
      
      // In Windows environment, this would be:
      // const command = `copy "${filePath}" \\\\\\\\Computer\\\\${PRINTER_MODEL}`;
      
      // For demonstration on Linux/Mac, we'll just echo to console
      const command = `cat "${filePath}" > /dev/null && echo "Label sent to printer: ${PRINTER_MODEL}"`;
      
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr) {
        console.error(`Error sending to printer: ${stderr}`);
        return `Error: ${stderr}`;
      }
      
      console.log(`Printer output: ${stdout}`);
      return `Success: ${stdout}`;
    } catch (error: any) {
      console.error('Failed to send to printer:', error);
      return `Error: ${error.message}`;
    }
  }

  /**
   * Print shipping label for an order
   * @param orderId Order ID
   * @param boxCount Total number of boxes
   * @param currentBox Current box number
   * @returns Success message or error
   */
  async printShippingLabel(orderId: number, boxCount: number, currentBox: number): Promise<string> {
    try {
      // Log the exact user-specified box count values in the service
      console.log(`[labelPrinterService] Printing with exact user values - Box count: ${boxCount}, Current box: ${currentBox}`);
      
      // Ensure logo is available
      await this.ensureLogoAvailable();
      
      // Get order data
      const order = await storage.getOrder(orderId);
      if (!order) {
        return 'Error: Order not found';
      }
      
      // Get order items
      const orderItems = await storage.getOrderItems(orderId);
      
      // Get product details for each item
      const enhancedItems: OrderItem[] = [];
      
      for (const item of orderItems) {
        const product = await storage.getProduct(item.productId);
        
        enhancedItems.push({
          ...item,
          name: product?.name || 'Unknown Product',
          sku: product?.sku || 'N/A',
          category: product?.categoryId ? String(product.categoryId) : null
        });
      }
      
      // Create order with items
      const orderWithItems: OrderWithItems = {
        ...order,
        items: enhancedItems,
        createdAt: order.orderDate || new Date(),
        updatedAt: order.lastUpdated || new Date()
      };
      
      // Get customer info if available
      if (order.customerName) {
        orderWithItems.customer = await storage.getCustomerByName(order.customerName);
      }
      
      // Generate JScript for label
      const jScript = this.generateLabelJScript(orderWithItems, boxCount, currentBox);
      
      // Save to file
      const filePath = await this.saveJScriptToFile(jScript);
      
      // Send to printer
      const result = await this.sendToPrinter(filePath);
      
      // Log the printing event
      await storage.addOrderChangelog({
        orderId,
        userId: 1, // Default to system user if auth user not available
        action: 'label_printed',
        notes: `Printed shipping label for box ${currentBox}/${boxCount}`
      });
      
      return result;
    } catch (error: any) {
      console.error('Error printing shipping label:', error);
      return `Error: ${error.message}`;
    }
  }
  
  /**
   * Print a batch of labels for an order
   * @param orderId Order ID
   * @param boxCount Total number of boxes
   * @returns Results of printing operations
   */
  async printBatchLabels(orderId: number, boxCount: number): Promise<string[]> {
    // Log the exact user-specified box count in batch printing
    console.log(`[labelPrinterService:batchPrint] Using exact user-specified box count: ${boxCount}`);
    
    const results: string[] = [];
    
    for (let i = 1; i <= boxCount; i++) {
      const result = await this.printShippingLabel(orderId, boxCount, i);
      results.push(result);
    }
    
    return results;
  }
}

// Export singleton instance
export const labelPrinterService = new LabelPrinterService();