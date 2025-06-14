import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { storage } from '../storage';
import { z } from 'zod';

// Constants for label dimensions (standard 100x70mm shipping label)
const LABEL_WIDTH_MM = 100;
const LABEL_HEIGHT_MM = 70;

// Schema for validating the direct label request
const directLabelSchema = z.object({
  orderId: z.number(),
  boxCount: z.number().default(1),
  currentBox: z.number().default(1)
});

/**
 * Generate a direct shipping label HTML page that can be immediately printed
 */
export async function generateDirectLabel(req: Request, res: Response) {
  try {
    // Parse and validate request parameters
    const { orderId, boxCount, currentBox } = directLabelSchema.parse(req.params);
    
    console.log(`[directLabel] Generating direct label - Order ID: ${orderId}, Box: ${currentBox}/${boxCount}`);
    
    // Check if order exists
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).send('Order not found');
    }
    
    // Get order items
    const orderItems = await storage.getOrderItems(orderId);
    
    // Get enhanced items with product details
    const enhancedItems = [];
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
    const orderWithItems = {
      ...order,
      items: enhancedItems,
      createdAt: order.orderDate || new Date(),
      updatedAt: order.lastUpdated || new Date()
    };
    
    // Get customer info if available
    let customer = null;
    if (order.customerName) {
      customer = await storage.getCustomerByName(order.customerName);
    }
    
    // Get shipping info from customer if available
    let shippingCompanyInfo = '';
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
    
    // Build customer address
    const addressParts = [];
    
    // Try to get address from order first
    if (order.customerAddress) addressParts.push(order.customerAddress);
    if (order.customerCity) addressParts.push(order.customerCity);
    if (order.customerState) addressParts.push(order.customerState);
    if (order.customerPostalCode) addressParts.push(order.customerPostalCode);
    
    // If no address in order, try to get from customer object
    if (addressParts.length === 0 && customer) {
      if (customer.address) addressParts.push(customer.address);
      if (customer.city) addressParts.push(customer.city);
      if (customer.state) addressParts.push(customer.state);
      if (customer.postalCode) addressParts.push(customer.postalCode);
    }
    
    // If still no address, show placeholder
    const address = addressParts.length > 0 ? addressParts.join(', ') : 'Διεύθυνση μη διαθέσιμη';
    
    // Box info
    const boxInfo = `${currentBox} / ${boxCount}`;
    
    // Create simple HTML for direct printing
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Shipping Label - Order ${order.orderNumber}</title>
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
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    
    .shipping-label {
      width: ${LABEL_WIDTH_MM}mm;
      height: ${LABEL_HEIGHT_MM}mm;
      padding: 5mm;
      box-sizing: border-box;
      position: relative;
      border: 1px solid #ddd;
      background-color: white;
    }
    
    .logo {
      width: 45mm;
      height: 17mm;
      display: block;
      margin: 0 auto 5mm;
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
      margin-bottom: 4mm;
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
    
    @media print {
      body {
        background: none;
      }
      
      .shipping-label {
        border: none;
        box-shadow: none;
      }
    }
  </style>
  <script>
    // Auto-print when page loads
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</head>
<body>
  <div class="shipping-label">
    <img src="/shipping-logo.png" class="logo" alt="Company Logo" onerror="this.src='/simple-logo.svg'"/>
    
    <div class="content">
      <div class="customer-info">
        <div class="order-number">Αρ. Παραγγελίας: ${order.orderNumber}</div>
        <div class="customer-name">${order.customerName || ''}</div>
        <div class="customer-address">${address}</div>
        <div class="customer-phone">Τηλέφωνο: ${customer?.phone || ''}</div>
        <div class="shipping-company">Μεταφορική: ${shippingCompanyInfo}</div>
      </div>
      
      <div class="spacer"></div>
      
      <div class="box-count">Κιβώτιο: ${boxInfo}</div>
    </div>
  </div>
</body>
</html>`;
    
    // Ensure logo is available in public directory
    await ensureLogoAvailable();
    
    // Log the print action
    try {
      await storage.addOrderChangelog({
        orderId: orderId,
        userId: (req.user as any)?.id || null,
        timestamp: new Date(),
        changeType: 'label_printed',
        details: `Printed shipping label for box ${currentBox} of ${boxCount}`,
        previousValue: null,
        newValue: null
      });
    } catch (error) {
      console.warn('Failed to log label printing:', error);
    }
    
    // Send HTML directly to the browser
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error: any) {
    console.error('Error generating direct label:', error);
    res.status(400).send(`Error generating label: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Make sure the logo is available in the public directory
 */
async function ensureLogoAvailable() {
  // Logo paths
  const sourceLogo = path.join(process.cwd(), 'attached_assets', 'Frame 40.png');
  const targetDir = path.join(process.cwd(), 'public');
  const targetLogo = path.join(targetDir, 'shipping-logo.png');
  const targetSvgLogo = path.join(targetDir, 'simple-logo.svg');
  
  // Ensure directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Copy the PNG logo to ensure the latest version is used
  if (fs.existsSync(sourceLogo)) {
    // Copy logo file even if it exists to ensure latest version
    fs.copyFileSync(sourceLogo, targetLogo);
    
    // Set proper permissions for web access
    try {
      fs.chmodSync(targetLogo, 0o644);
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
        fs.copyFileSync(placeholderPath, targetLogo);
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
    fs.writeFileSync(targetSvgLogo, svgContent, 'utf8');
    fs.chmodSync(targetSvgLogo, 0o644);
  }
}