import nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from '../storage.postgresql';
import { Order, Customer } from '@shared/schema';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email templates directory
const TEMPLATES_DIR = path.join(__dirname, '../../email_templates');

// Ensure templates directory exists
if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

// Default email template for order shipping notification
const DEFAULT_SHIPPING_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Shipped</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 0.8em; }
    .order-details { background-color: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Your Order Has Been Shipped</h1>
  </div>
  <div class="content">
    <p>Hello {{customerName}},</p>
    <p>We're pleased to inform you that your order <strong>{{orderNumber}}</strong> has been shipped.</p>
    
    <div class="order-details">
      <h3>Order Details:</h3>
      <p><strong>Order Number:</strong> {{orderNumber}}</p>
      <p><strong>Order Date:</strong> {{orderDate}}</p>
      <p><strong>Shipping Company:</strong> {{shippingCompany}}</p>
      {{#if trackingNumber}}
      <p><strong>Tracking Number:</strong> {{trackingNumber}}</p>
      {{/if}}
    </div>
    
    <h3>Items Shipped:</h3>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Quantity</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td>{{this.name}}</td>
          <td>{{this.quantity}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    
    <p>If you have any questions or concerns regarding your order, please don't hesitate to contact us.</p>
    <p>Thank you for your business!</p>
  </div>
  <div class="footer">
    <p>&copy; {{currentYear}} {{companyName}}. All rights reserved.</p>
  </div>
</body>
</html>
`;

// Initialize default template if it doesn't exist
const defaultTemplatePath = path.join(TEMPLATES_DIR, 'order_shipped.html');
if (!fs.existsSync(defaultTemplatePath)) {
  fs.writeFileSync(defaultTemplatePath, DEFAULT_SHIPPING_TEMPLATE);
}

// Email configuration interface
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  companyName: string;
}

// Default Gmail configuration
const defaultConfig: EmailConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || '',
  },
  from: process.env.EMAIL_FROM || '',
  companyName: process.env.COMPANY_NAME || 'Warehouse Management System',
};

// Read email configuration from settings
async function getEmailConfig(): Promise<EmailConfig> {
  try {
    const settings = await storage.getEmailSettings();
    
    if (settings && settings.host && settings.authUser && settings.authPass && settings.fromEmail) {
      return {
        host: settings.host,
        port: settings.port || 587,
        secure: settings.secure || false,
        auth: {
          user: settings.authUser,
          pass: settings.authPass,
        },
        from: settings.fromEmail,
        companyName: settings.companyName || 'Warehouse Management System',
      };
    }
    
    // If no valid settings found, return default config
    return defaultConfig;
  } catch (error) {
    console.error('Error loading email configuration:', error);
    return defaultConfig;
  }
}

// Get template content
function getTemplate(templateName: string): string {
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.hbs`);
  
  try {
    if (fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, 'utf-8');
    }
    
    // Try with .html extension as fallback
    const htmlTemplatePath = path.join(TEMPLATES_DIR, `${templateName}.html`);
    if (fs.existsSync(htmlTemplatePath)) {
      return fs.readFileSync(htmlTemplatePath, 'utf-8');
    }
    
    // If template doesn't exist, return default template
    console.warn(`Template ${templateName} not found, using default template.`);
    return DEFAULT_SHIPPING_TEMPLATE;
  } catch (error) {
    console.error(`Error reading email template ${templateName}:`, error);
    return DEFAULT_SHIPPING_TEMPLATE;
  }
}

// Send order shipped notification email
export async function sendOrderShippedEmail(
  order: Order, 
  customer: Customer, 
  items: Array<{ productId: number; name: string; quantity: number; sku: string }>
): Promise<boolean> {
  try {
    // Get email configuration
    const config = await getEmailConfig();
    
    // Check if email configuration is set
    if (!config.auth.user || !config.auth.pass) {
      console.error('Email credentials not configured');
      return false;
    }
    
    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    });
    
    // Get email template
    const template = getTemplate('order-shipped');
    const compiledTemplate = handlebars.compile(template);
    
    // Get shipping document information
    const shippingDoc = await storage.getShippingDocument(order.id);
    
    // Prepare email data
    const mailData = {
      customerName: customer.name,
      orderNumber: order.orderNumber,
      orderDate: new Date(order.orderDate).toLocaleDateString(),
      shippingCompany: customer.preferredShippingCompany || 'Standard Shipping',
      trackingNumber: shippingDoc?.trackingNumber || '',
      items: items,
      currentYear: new Date().getFullYear(),
      companyName: config.companyName,
    };
    
    // Compile email HTML
    const html = compiledTemplate(mailData);
    
    // Send email
    await transporter.sendMail({
      from: config.from || `"${config.companyName}" <${config.auth.user}>`,
      to: customer.email || '',
      subject: `Order ${order.orderNumber} Shipped`,
      html,
    });
    
    console.log(`Shipping notification email sent for order ${order.orderNumber}`);
    return true;
  } catch (error) {
    console.error('Error sending shipping notification email:', error);
    return false;
  }
}

// Save or update email template
export async function saveEmailTemplate(templateName: string, content: string): Promise<boolean> {
  try {
    const templatePath = path.join(TEMPLATES_DIR, `${templateName}.hbs`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(TEMPLATES_DIR)) {
      fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
    }
    
    fs.writeFileSync(templatePath, content);
    return true;
  } catch (error) {
    console.error(`Error saving email template ${templateName}:`, error);
    return false;
  }
}