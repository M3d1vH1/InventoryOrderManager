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
    
    // Get customer phone - check both order and customer objects
    let customerPhone = '';
    if (order.customerPhone) {
      customerPhone = order.customerPhone;
    } else if (customer && customer.phone) {
      customerPhone = customer.phone;
    }
    
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
<svg width="800" height="120" viewBox="0 0 800 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="800" height="120" fill="#ffffff" rx="0" ry="0"/>
  <text x="20" y="70" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="#0055aa">Amphoreus</text>
  <text x="20" y="100" font-family="Arial, sans-serif" font-size="30" fill="#555555">Olive Oil Company</text>
  <path d="M650,40 Q670,20 690,40 Q710,60 730,40" stroke="#0055aa" stroke-width="4" fill="none"/>
  <path d="M650,50 L730,50" stroke="#0055aa" stroke-width="3" fill="none"/>
  <path d="M660,60 Q690,90 720,60" stroke="#0055aa" stroke-width="4" fill="none"/>
  <path d="M600,30 Q620,10 640,30" stroke="#0055aa" stroke-width="3" fill="none" opacity="0.5"/>
  <path d="M740,30 Q760,10 780,30" stroke="#0055aa" stroke-width="3" fill="none" opacity="0.5"/>
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
      
      // Build customer address - check both order and customer objects
      const addressParts = [];
      
      // Try to get address from order first
      if (orderWithItems.customerAddress) addressParts.push(orderWithItems.customerAddress);
      if (orderWithItems.customerCity) addressParts.push(orderWithItems.customerCity);
      if (orderWithItems.customerState) addressParts.push(orderWithItems.customerState);
      if (orderWithItems.customerPostalCode) addressParts.push(orderWithItems.customerPostalCode);
      
      // If no address in order, try to get from customer object
      if (addressParts.length === 0 && customer) {
        if (customer.address) addressParts.push(customer.address);
        if (customer.city) addressParts.push(customer.city);
        if (customer.state) addressParts.push(customer.state);
        if (customer.postalCode) addressParts.push(customer.postalCode);
      }
      
      // If still no address, show placeholder
      const address = addressParts.length > 0 ? addressParts.join(', ') : 'Διεύθυνση μη διαθέσιμη';
      
      // Get customer phone - check both order and customer objects
      let customerPhone = '';
      if (orderWithItems.customerPhone) {
        customerPhone = orderWithItems.customerPhone;
      } else if (customer && customer.phone) {
        customerPhone = customer.phone;
      }
      
      // Box info
      const boxInfo = `${currentBox} / ${boxCount}`;
      
      // Create a simple, direct HTML for printing
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shipping Label - Order ${orderWithItems.orderNumber}</title>
        <meta charset="UTF-8">
        <style>
          @page {
            size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm;
            margin: 0;
          }
          
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: white;
          }
          
          .shipping-label {
            width: ${LABEL_WIDTH_MM}mm;
            height: ${LABEL_HEIGHT_MM}mm;
            padding: 5mm;
            box-sizing: border-box;
            position: relative;
          }
          
          .logo {
            width: 45mm;
            height: 10mm; /* Reduced height from 17mm to 10mm */
            display: block;
            margin: 0 auto 2mm; /* Reduced bottom margin from 5mm to 2mm */
            object-fit: contain;
          }
          
          .content {
            display: flex;
            flex-direction: column;
            height: calc(${LABEL_HEIGHT_MM}mm - 15mm);
          }
          
          .customer-info {
            margin-bottom: 5mm;
          }
          
          .order-number {
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 3mm;
          }
          
          .customer-name {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 2mm;
          }
          
          .customer-address, .customer-phone {
            font-size: 10pt;
            margin-bottom: 2mm;
          }
          
          .shipping-company {
            font-size: 11pt;
            font-weight: bold;
            border-left: 3px solid #555;
            padding-left: 3mm;
            background-color: #f8f8f8;
            padding: 1mm 2mm 1mm 3mm;
            margin-bottom: 2mm; /* Reduced to fix overflow issues */
          }
          
          .spacer {
            flex-grow: 1;
          }
          
          .box-count {
            font-size: 14pt;
            font-weight: bold;
            text-align: center;
            margin-top: auto;
            border: 1px solid #ccc;
            padding: 2mm;
            background-color: #f0f0f0;
          }
          
          /* Minimal screen preview styles */
          @media screen {
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background-color: #f8f8f8;
            }
            
            .shipping-label {
              margin: 0 auto;
              border: 1px solid #ddd;
              background-color: white;
              box-shadow: 0 1px 4px rgba(0,0,0,0.1);
            }
          }
        </style>
        <script>
          // Automatically prompt for printing when the page loads
          window.onload = function() {
            // Short delay to ensure everything is loaded
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </head>
      <body>
        <div class="shipping-label">
          <img src="/shipping-logo.png" class="logo" alt="Company Logo" onerror="this.src='/simple-logo.svg'"/>
          
          <div class="content">
            <div class="customer-info">
              <div class="order-number">${orderWithItems.orderNumber}</div>
              <div class="customer-name">${orderWithItems.customerName || ''}</div>
              <div class="customer-address">${address}</div>
              <div class="customer-phone">Τηλέφωνο: ${customerPhone}</div>
              <div class="shipping-company">Μεταφορική: ${shippingCompanyInfo}</div>
            </div>
            
            <div class="spacer"></div>
            
            <div class="box-count">Κιβώτιο: ${boxInfo}</div>
          </div>
        </div>
        

      </body>
      </html>
      `;
      
      // Save HTML to a temporary file, with cleanup of old files
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Clean up old preview files for this order to avoid accumulation
      try {
        const files = await fs.promises.readdir(tempDir);
        const orderPattern = `label-preview-${orderId}-`;
        
        // Delete old preview files for this order
        for (const file of files) {
          if (file.startsWith(orderPattern) && file.endsWith('.html')) {
            try {
              await fs.promises.unlink(path.join(tempDir, file));
            } catch (err) {
              console.warn(`Failed to delete old preview file ${file}:`, err);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to clean up old preview files:', err);
      }
      
      // Create a new preview file with a consistent name (without timestamp)
      const previewPath = path.join(tempDir, `label-preview-${orderId}-${currentBox}.html`);
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
      console.log(`Attempting to print to CAB EOS1 printer with file: ${filePath}`);
      
      // Different OS platforms require different commands
      let command = '';
      
      if (process.platform === 'win32') {
        // Windows - direct printing using copy command to printer port
        // Assuming printer is shared or connected directly via USB
        // Try USB port first (often COM3 or similar for printer devices)
        command = `copy "${filePath}" COM1:`;
        
        // Alternative Windows approach using printer name
        // command = `copy "${filePath}" \\\\localhost\\CABEOS1`;
      } else if (process.platform === 'linux') {
        // Linux - using lp or lpr command
        // Make sure printer is configured in CUPS with name CABEOS1
        command = `lp -d CABEOS1 "${filePath}"`;
        
        // Alternative using lpr
        // command = `lpr -P CABEOS1 "${filePath}"`;
      } else if (process.platform === 'darwin') {
        // macOS - using lp command
        command = `lp -d CABEOS1 "${filePath}"`;
      } else {
        // Other platforms - simulate printing
        command = `cat "${filePath}" > /dev/null && echo "Label sent to printer: ${PRINTER_MODEL}"`;
      }
      
      console.log(`Executing printer command: ${command}`);
      
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr) {
        console.error(`Error sending to printer: ${stderr}`);
        return `Error: ${stderr}`;
      }
      
      console.log(`Printer output: ${stdout}`);
      return `Success: Label sent to CAB EOS1 printer`;
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