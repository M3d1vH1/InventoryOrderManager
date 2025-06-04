import nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from '../storage';
import { Order, Customer } from '@shared/schema';
import { RobustHttpClient, HttpRequestError } from '../utils/robustHttpClient';
import { withDatabaseErrorHandling } from '../utils/errorUtils';
import { log } from '../vite';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email templates directory
const TEMPLATES_DIR = path.join(__dirname, '../../email_templates');

// Robust email service with retry logic and timeout handling
export class RobustEmailService {
  private httpClient: RobustHttpClient;
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Configure HTTP client for email API services (e.g., SendGrid, Mailgun)
    this.httpClient = new RobustHttpClient(
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Warehouse-Management-System/1.0'
        }
      },
      {
        timeout: 30000, // 30 seconds for email APIs
        maxRetries: 3,
        retryDelay: 2000, // 2 seconds initial delay
        maxRetryDelay: 60000, // 60 seconds max delay
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
        onRetry: (attempt, error) => {
          log(`Email service retry attempt ${attempt}: ${error.message}`, 'email');
        }
      }
    );
  }

  /**
   * Initialize email transporter with robust configuration
   */
  private async initializeTransporter(): Promise<nodemailer.Transporter> {
    try {
      const config = await this.getEmailConfig();
      
      // Create transporter with connection pooling and retry logic
      const transportConfig = {
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.auth.user,
          pass: config.auth.pass,
        },
        // Connection pool settings for better performance
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        // Timeout settings
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000,
        socketTimeout: 60000, // 60 seconds
      };
      
      const transporter = nodemailer.createTransport(transportConfig);

      // Verify connection
      await this.verifyEmailConnection(transporter);
      
      this.transporter = transporter;
      log('Email transporter initialized successfully', 'email');
      
      return transporter;
    } catch (error) {
      log(`Failed to initialize email transporter: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Verify email connection with retry logic
   */
  private async verifyEmailConnection(transporter: nodemailer.Transporter): Promise<void> {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        await transporter.verify();
        log('Email connection verified successfully', 'email');
        return;
      } catch (error) {
        attempts++;
        log(`Email connection verification attempt ${attempts} failed: ${error}`, 'error');
        
        if (attempts < maxAttempts) {
          const delay = 5000 * attempts; // Increasing delay
          log(`Retrying email connection verification in ${delay}ms`, 'email');
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw new Error(`Email connection verification failed after ${maxAttempts} attempts: ${error}`);
        }
      }
    }
  }

  /**
   * Get email configuration with fallback handling
   */
  private async getEmailConfig(): Promise<EmailConfig> {
    try {
      const settings = await withDatabaseErrorHandling(
        () => storage.getEmailSettings(),
        'fetch email settings'
      );
      
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
      
      // Fallback to environment variables
      return this.getDefaultEmailConfig();
    } catch (error) {
      log(`Error loading email configuration: ${error}`, 'error');
      return this.getDefaultEmailConfig();
    }
  }

  /**
   * Get default email configuration from environment variables
   */
  private getDefaultEmailConfig(): EmailConfig {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('Email credentials not configured in settings or environment variables');
    }

    return {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      companyName: process.env.COMPANY_NAME || 'Warehouse Management System',
    };
  }

  /**
   * Send email with robust error handling and retries
   */
  public async sendOrderShippedEmail(
    order: Order, 
    customer: Customer, 
    items: Array<{ productId: number; name: string; quantity: number; sku: string }>
  ): Promise<boolean> {
    const requestId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      log(`[${requestId}] Starting order shipped email for order ${order.orderNumber}`, 'email');

      // Validate email address
      if (!customer.email || !this.isValidEmail(customer.email)) {
        log(`[${requestId}] Invalid or missing customer email: ${customer.email}`, 'error');
        return false;
      }

      // Initialize transporter if not already done
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      // Get email template with error handling
      const template = await this.getEmailTemplate('order-shipped');
      const compiledTemplate = handlebars.compile(template);
      
      // Get shipping document information with error handling
      const shippingDoc = await withDatabaseErrorHandling(
        () => storage.getShippingDocument(order.id),
        'fetch shipping document'
      );
      
      // Prepare email data
      const mailData = {
        customerName: customer.name,
        orderNumber: order.orderNumber,
        orderDate: new Date(order.orderDate).toLocaleDateString(),
        shippingCompany: customer.preferredShippingCompany || 'Standard Shipping',
        trackingNumber: shippingDoc?.trackingNumber || '',
        items: items,
        currentYear: new Date().getFullYear(),
        companyName: (await this.getEmailConfig()).companyName,
      };
      
      // Compile email HTML
      const html = compiledTemplate(mailData);
      const config = await this.getEmailConfig();
      
      // Send email with retry logic
      const result = await this.sendEmailWithRetry({
        from: config.from || `"${config.companyName}" <${config.auth.user}>`,
        to: customer.email,
        subject: `Order ${order.orderNumber} Shipped`,
        html,
      }, requestId);
      
      if (result.success) {
        log(`[${requestId}] Order shipped email sent successfully to ${customer.email}`, 'email');
        return true;
      } else {
        log(`[${requestId}] Failed to send order shipped email: ${result.error}`, 'error');
        return false;
      }
    } catch (error) {
      log(`[${requestId}] Error in sendOrderShippedEmail: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Send email with retry logic and robust error handling
   */
  private async sendEmailWithRetry(
    mailOptions: nodemailer.SendMailOptions,
    requestId: string,
    maxRetries: number = 3
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      attempt++;
      
      try {
        log(`[${requestId}] Email send attempt ${attempt}/${maxRetries + 1}`, 'email');
        
        if (!this.transporter) {
          await this.initializeTransporter();
        }

        const info = await this.transporter!.sendMail(mailOptions);
        
        log(`[${requestId}] Email sent successfully on attempt ${attempt}`, 'email');
        return { success: true, messageId: info.messageId };
      } catch (error) {
        lastError = error as Error;
        
        log(`[${requestId}] Email send attempt ${attempt} failed: ${lastError.message}`, 'error');
        
        // Check if error is retryable
        if (attempt <= maxRetries && this.isRetryableEmailError(lastError)) {
          const delay = 5000 * attempt; // Increasing delay: 5s, 10s, 15s
          log(`[${requestId}] Retrying email send in ${delay}ms`, 'email');
          
          // Reset transporter on connection errors
          if (this.isConnectionError(lastError)) {
            this.transporter = null;
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    return { 
      success: false, 
      error: `Email sending failed after ${attempt} attempts: ${lastError?.message || 'Unknown error'}` 
    };
  }

  /**
   * Check if email error is retryable
   */
  private isRetryableEmailError(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNABORTED',
      'ESOCKET',
      'EAI_AGAIN'
    ];
    
    const errorMessage = error.message.toLowerCase();
    
    // Check for temporary SMTP errors
    if (errorMessage.includes('421') || // Service not available
        errorMessage.includes('450') || // Mailbox busy
        errorMessage.includes('451') || // Local error
        errorMessage.includes('452')) { // Insufficient storage
      return true;
    }
    
    // Check for network errors
    return retryableErrors.some(code => 
      error.message.includes(code) || (error as any).code === code
    );
  }

  /**
   * Check if error is a connection error requiring transporter reset
   */
  private isConnectionError(error: Error): boolean {
    const connectionErrors = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
    return connectionErrors.some(code => 
      error.message.includes(code) || (error as any).code === code
    );
  }

  /**
   * Get email template with error handling
   */
  private async getEmailTemplate(templateName: string): Promise<string> {
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
      
      // Return default template
      log(`Template ${templateName} not found, using default template`, 'email');
      return this.getDefaultShippingTemplate();
    } catch (error) {
      log(`Error reading email template ${templateName}: ${error}`, 'error');
      return this.getDefaultShippingTemplate();
    }
  }

  /**
   * Validate email address
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get default shipping email template
   */
  private getDefaultShippingTemplate(): string {
    return `
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
  }
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

// Export singleton instance
export const robustEmailService = new RobustEmailService();