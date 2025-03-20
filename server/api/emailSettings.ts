import { Request, Response } from 'express';
import { storage } from '../storage';
import nodemailer from 'nodemailer';
import { z } from 'zod';

/**
 * Get current email settings
 */
export async function getEmailSettings(req: Request, res: Response) {
  try {
    const settings = await storage.getEmailSettings();
    
    // Return settings, but don't include the auth password
    if (settings) {
      const { authPass, ...settingsWithoutPassword } = settings;
      return res.json(settingsWithoutPassword);
    }
    
    return res.status(404).json({ message: 'No email settings found' });
  } catch (error) {
    console.error('Error getting email settings:', error);
    return res.status(500).json({ message: 'Failed to get email settings' });
  }
}

/**
 * Update email settings
 */
export async function updateEmailSettings(req: Request, res: Response) {
  try {
    const schema = z.object({
      host: z.string().optional(),
      port: z.number().optional(),
      secure: z.boolean().optional(), 
      authUser: z.string().optional(),
      authPass: z.string().optional(),
      fromEmail: z.string().email().optional(),
      companyName: z.string().optional(),
      enableNotifications: z.boolean().optional(),
    });

    const validatedData = schema.parse(req.body);
    const updatedSettings = await storage.updateEmailSettings(validatedData);
    
    if (updatedSettings) {
      const { authPass, ...settingsWithoutPassword } = updatedSettings;
      return res.json(settingsWithoutPassword);
    }
    
    return res.status(500).json({ message: 'Failed to update email settings' });
  } catch (error) {
    console.error('Error updating email settings:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid input data', 
        errors: error.errors 
      });
    }
    return res.status(500).json({ message: 'Failed to update email settings' });
  }
}

/**
 * Test email connection
 */
export async function testEmailConnection(req: Request, res: Response) {
  try {
    console.log('Email test request received:', JSON.stringify(req.body));
    
    const schema = z.object({
      host: z.string(),
      port: z.number(),
      secure: z.boolean(),
      authUser: z.string(),
      authPass: z.string(),
      fromEmail: z.string().email(),
      companyName: z.string().optional(),
      enableNotifications: z.boolean().optional(),
      testEmail: z.string().email(),
    });

    const validatedData = schema.parse(req.body);
    
    // Create a test transporter
    const transporter = nodemailer.createTransport({
      host: validatedData.host,
      port: validatedData.port,
      secure: validatedData.secure,
      auth: {
        user: validatedData.authUser,
        pass: validatedData.authPass,
      },
    });
    
    const companyName = validatedData.companyName || 'Warehouse Management System';
    
    // Send a test email
    await transporter.sendMail({
      from: `"${companyName}" <${validatedData.fromEmail}>`,
      to: validatedData.testEmail,
      subject: 'Test Email from Warehouse Management System',
      text: 'This is a test email from your Warehouse Management System. If you received this email, your email configuration is working correctly.',
      html: '<p>This is a test email from your Warehouse Management System.</p><p>If you received this email, your email configuration is working correctly.</p>',
    });
    
    return res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    console.error('Error testing email connection:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email configuration', 
        errors: error.errors,
      });
    }
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to send test email',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get email template
 */
export async function getEmailTemplate(req: Request, res: Response) {
  try {
    const { templateName } = req.params;
    
    if (!templateName) {
      return res.status(400).json({ message: 'Template name is required' });
    }
    
    // Logic to get the email template by name
    // This would typically read from a file or database
    const fs = require('fs');
    const path = require('path');
    
    const templatePath = path.join(process.cwd(), 'email_templates', `${templateName}.hbs`);
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ message: `Template '${templateName}' not found` });
    }
    
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    return res.json({ templateName, content: templateContent });
  } catch (error) {
    console.error('Error getting email template:', error);
    return res.status(500).json({ message: 'Failed to get email template' });
  }
}

/**
 * Update email template
 */
export async function updateEmailTemplate(req: Request, res: Response) {
  try {
    const { templateName } = req.params;
    const { content } = req.body;
    
    if (!templateName) {
      return res.status(400).json({ message: 'Template name is required' });
    }
    
    if (!content) {
      return res.status(400).json({ message: 'Template content is required' });
    }
    
    // Logic to update the email template
    const fs = require('fs');
    const path = require('path');
    
    const templateDir = path.join(process.cwd(), 'email_templates');
    const templatePath = path.join(templateDir, `${templateName}.hbs`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }
    
    fs.writeFileSync(templatePath, content, 'utf8');
    
    return res.json({ 
      success: true, 
      message: 'Template updated successfully',
      templateName,
    });
  } catch (error) {
    console.error('Error updating email template:', error);
    return res.status(500).json({ message: 'Failed to update email template' });
  }
}