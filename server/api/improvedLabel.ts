import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { storage } from '../storage';
import { z } from 'zod';

// Constants for label dimensions (standard 100x70mm shipping label)
const LABEL_WIDTH_MM = 100;
const LABEL_HEIGHT_MM = 70;

// Schema for validating the label request
const labelSchema = z.object({
  orderId: z.number(),
  boxCount: z.number().default(1),
  currentBox: z.number().default(1)
});

/**
 * Generate an improved shipping label with proper logo sizing and phone display
 */
export async function generateImprovedLabel(req: Request, res: Response) {
  try {
    const { orderId, boxCount = 1, currentBox = 1 } = labelSchema.parse(req.body);
    
    console.log(`[improvedLabel] Generating label - Order ID: ${orderId}, Box: ${currentBox}/${boxCount}`);
    
    // Check if order exists
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
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
    if ((order as any).customerAddress) addressParts.push((order as any).customerAddress);
    if ((order as any).customerCity) addressParts.push((order as any).customerCity);
    if ((order as any).customerState) addressParts.push((order as any).customerState);
    if ((order as any).customerPostalCode) addressParts.push((order as any).customerPostalCode);
    
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
    
    // Get customer phone
    const phoneNumber = customer?.phone || '';
    
    // Create the preview HTML file
    const filename = `improved-label-${orderId}-${currentBox}.html`;
    const publicPath = path.join(process.cwd(), 'public', filename);
    
    // Ensure logo is available
    await ensureLogoAvailable();
    
    // Create HTML content
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
        <div class="customer-phone">Τηλέφωνο: ${phoneNumber}</div>
        <div class="shipping-company">Μεταφορική: ${shippingCompanyInfo}</div>
      </div>
      
      <div class="spacer"></div>
      
      <div class="box-count">Κιβώτιο: ${boxInfo}</div>
    </div>
  </div>
</body>
</html>`;
    
    // Write file to public directory
    fs.writeFileSync(publicPath, html, 'utf8');
    fs.chmodSync(publicPath, 0o644);
    
    // Return the URL to access the preview
    const previewUrl = `/improved-label/${filename}`;
    
    // Log the action
    try {
      await storage.addOrderChangelog({
        orderId: orderId,
        userId: (req.user as any)?.id || null,
        action: "label_printed",
        notes: `Generated improved shipping label for box ${currentBox} of ${boxCount}`,
      });
    } catch (error) {
      console.warn('Failed to log label printing:', error);
    }
    
    return res.status(200).json({
      success: true,
      previewUrl,
      isHtml: true,
      message: 'Improved shipping label generated successfully'
    });
  } catch (error: any) {
    console.error('Error generating improved label:', error);
    return res.status(400).json({ 
      error: error.message || 'Failed to generate improved label' 
    });
  }
}

/**
 * Serve the generated HTML file
 */
export function serveImprovedLabel(req: Request, res: Response) {
  try {
    const { filename } = req.params;
    
    // Security check to prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(process.cwd(), 'public', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Label not found' });
    }
    
    return res.sendFile(filePath);
  } catch (error: any) {
    console.error('Error serving improved label:', error);
    return res.status(500).json({ error: 'Failed to serve improved label' });
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
<svg width="400" height="100" viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="400" height="100" fill="#ffffff" rx="0" ry="0"/>
  <text x="20" y="60" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#0055aa">Amphoreus</text>
  <text x="20" y="85" font-family="Arial, sans-serif" font-size="20" fill="#555555">Olive Oil Company</text>
</svg>`;
    fs.writeFileSync(targetSvgLogo, svgContent, 'utf8');
    fs.chmodSync(targetSvgLogo, 0o644);
  }
}