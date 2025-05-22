import { Request, Response } from 'express';
import { storage } from '../storage';
import path from 'path';
import fs from 'fs';

// Constants for label dimensions
const LABEL_WIDTH_MM = 100;
const LABEL_HEIGHT_MM = 70;

/**
 * Generate and serve a simple shipping label HTML page for direct printing
 */
export async function directShippingLabel(req: Request, res: Response) {
  try {
    // Parse parameters
    const orderId = parseInt(req.params.orderId);
    const boxCount = parseInt(req.params.boxCount || '1');
    const currentBox = parseInt(req.params.currentBox || '1');
    
    if (isNaN(orderId)) {
      return res.status(400).send('Invalid order ID');
    }
    
    // Get order data
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).send('Order not found');
    }
    
    // Get customer info
    let customerAddress = '';
    let shippingCompany = '';
    let customerPhone = '';
    
    // Get customer info if available
    let customer = null;
    if (order.customerName) {
      customer = await storage.getCustomerByName(order.customerName);
    }
    
    // Build shipping info from customer or order data
    if (customer) {
      // Shipping company info
      if (customer.shippingCompany) {
        shippingCompany = customer.shippingCompany;
      } else if (customer.preferredShippingCompany) {
        shippingCompany = customer.preferredShippingCompany;
      } else if (customer.billingCompany) {
        shippingCompany = customer.billingCompany;
      }
      
      // Address
      const addressParts = [];
      if (customer.address) addressParts.push(customer.address);
      if (customer.city) addressParts.push(customer.city);
      if (customer.state) addressParts.push(customer.state);
      if (customer.postalCode) addressParts.push(customer.postalCode);
      customerAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Διεύθυνση μη διαθέσιμη';
      
      // Phone - only use the standard phone field from schema
      customerPhone = customer.phone || '';
    }
    
    // If no shipping company from customer, use order data
    if (!shippingCompany && order.area) {
      shippingCompany = order.area;
    }
    
    // If still no address, use a placeholder
    if (!customerAddress) {
      customerAddress = 'Διεύθυνση μη διαθέσιμη';
    }
    
    // Box info
    const boxInfo = `${currentBox} / ${boxCount}`;
    
    // Ensure logo is available
    await ensureLogoAvailable();
    
    // Generate simple HTML
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Ετικέτα αποστολής - ${order.orderNumber}</title>
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
      background-color: white;
      display: flex;
      flex-direction: column;
    }
    
    .logo-container {
      width: 100%;
      height: 30mm;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 3mm;
    }
    
    .logo {
      width: 90mm;
      height: 30mm;
      object-fit: contain;
    }
    
    .content {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    
    .customer-info {
      margin-bottom: 3mm;
    }
    
    .order-number {
      font-size: 11pt;
      margin-bottom: 2mm;
    }
    
    .customer-name {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 2mm;
    }
    
    .customer-address {
      font-size: 10pt;
      margin-bottom: 2mm;
    }
    
    .customer-phone {
      font-size: 10pt;
      margin-bottom: 2mm;
      font-weight: bold;
    }
    
    .shipping-company {
      font-size: 11pt;
      font-weight: bold;
      border-left: 3px solid #555;
      padding: 1mm 2mm 1mm 3mm;
      background-color: #f8f8f8;
      margin-bottom: 3mm;
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
    }
  </style>
  <script>
    // Auto-print when the page loads
    window.onload = function() {
      // Make sure the logo is fully loaded before printing
      const logo = document.querySelector('.logo');
      
      // Function to start printing
      const startPrinting = function() {
        setTimeout(function() {
          window.print();
        }, 500);
      };
      
      // If logo is already complete, print right away
      if (logo.complete) {
        startPrinting();
      } else {
        // Otherwise wait for it to load
        logo.onload = startPrinting;
        // Fallback in case of loading error
        logo.onerror = startPrinting;
      }
    };
  </script>
</head>
<body>
  <div class="shipping-label">
    <div class="logo-container">
      <img src="/shipping-logo.png" class="logo" alt="Company Logo" onerror="this.src='/simple-logo.svg'"/>
    </div>
    
    <div class="content">
      <div class="customer-info">
        <div class="order-number">Αρ. Παραγγελίας: ${order.orderNumber}</div>
        <div class="customer-name">${order.customerName || ''}</div>
        <div class="customer-address">${customerAddress}</div>
        ${customerPhone ? `<div class="customer-phone">Τηλέφωνο: ${customerPhone}</div>` : ''}
        <div class="shipping-company">Μεταφορική: ${shippingCompany}</div>
      </div>
      
      <div class="spacer"></div>
      
      <div class="box-count">Κιβώτιο: ${boxInfo}</div>
    </div>
  </div>
</body>
</html>`;

    // Log the print activity (when possible)
    try {
      if (req.user) {
        await storage.addOrderChangelog({
          orderId,
          userId: (req.user as any)?.id || null,
          action: 'label_printed',
          notes: `Printed shipping label for box ${currentBox} of ${boxCount} using direct HTML`,
          changes: { boxCount, currentBox, method: 'direct-html' }
        });
      }
    } catch (err) {
      console.warn('Failed to log label printing activity:', err);
    }

    // Send the HTML directly
    res.set('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error: any) {
    console.error('Error generating direct shipping label:', error);
    res.status(500).send(`Error generating label: ${error.message}`);
  }
}

/**
 * Ensure the logo is available in the public directory
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
  
  // Copy the PNG logo
  if (fs.existsSync(sourceLogo)) {
    fs.copyFileSync(sourceLogo, targetLogo);
    
    // Set permissions
    try {
      fs.chmodSync(targetLogo, 0o644);
    } catch (err) {
      console.warn('Failed to update logo permissions:', err);
    }
  } else {
    console.warn(`Logo source file not found at ${sourceLogo}`);
  }
  
  // Create SVG logo if it doesn't exist (as a fallback)
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