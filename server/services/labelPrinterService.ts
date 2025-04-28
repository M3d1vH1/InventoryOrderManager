import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from '../storage';
import { OrderWithItems } from '../api/types';

const execPromise = promisify(exec);

// CAB EOS1 specific configurations
const PRINTER_MODEL = 'EOS1';
const PRINTER_DPI = 300;
const LABEL_WIDTH_MM = 100; // 10 cm width
const LABEL_HEIGHT_MM = 70;  // 7 cm height
const LOGO_PATH = path.join(process.cwd(), 'public', 'shipping-logo.png');

// Convert from mm to dots based on DPI
const mmToDots = (mm: number): number => Math.round((mm * PRINTER_DPI) / 25.4);

// Width and height in dots
const labelWidthDots = mmToDots(LABEL_WIDTH_MM);
const labelHeightDots = mmToDots(LABEL_HEIGHT_MM);

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

; Print logo at the top
GI 10,10,"shipping-logo.png"

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
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Copy logo if it doesn't exist and source exists
    if (!fs.existsSync(targetLogo) && fs.existsSync(sourceLogo)) {
      await fs.promises.copyFile(sourceLogo, targetLogo);
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
      // Ensure logo is available
      await this.ensureLogoAvailable();
      
      // Get order with customer info
      const order = await storage.getOrderWithItems(orderId);
      if (!order) {
        return 'Error: Order not found';
      }
      
      // If customer info not embedded, fetch it
      if (!order.customer && order.customerName) {
        order.customer = await storage.getCustomerByName(order.customerName);
      }
      
      // Generate JScript for label
      const jScript = this.generateLabelJScript(order, boxCount, currentBox);
      
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