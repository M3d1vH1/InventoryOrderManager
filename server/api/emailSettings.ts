import { Request, Response } from 'express';
import { storage } from '../storage';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Setup for file paths using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

// Define paths for templates
const emailTemplatesDir = path.join(projectRoot, 'email_templates');
const labelTemplatesDir = path.join(projectRoot, 'label_templates');

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
    
    // First get the existing settings
    const existingSettings = await storage.getEmailSettings();
    console.log('Existing email settings:', JSON.stringify({
      ...existingSettings,
      authPass: existingSettings?.authPass ? '******' : null // Mask password for security
    }));
    
    if (!existingSettings) {
      return res.status(400).json({
        success: false,
        message: 'No email settings found. Please save settings first.'
      });
    }
    
    // Validate only the test email, use existing settings for everything else
    const testEmailSchema = z.object({
      testEmail: z.string().email('Please provide a valid email address'),
    });
    
    const { testEmail } = testEmailSchema.parse(req.body);
    console.log('Test email will be sent to:', testEmail);
    
    // Check if required email settings are provided
    if (!existingSettings.host) {
      return res.status(400).json({
        success: false,
        message: 'Email host is not configured.'
      });
    }
    
    if (!existingSettings.fromEmail) {
      return res.status(400).json({
        success: false,
        message: 'Sender email address (From Email) is not configured.'
      });
    }
    
    if (!existingSettings.authUser || !existingSettings.authPass) {
      return res.status(400).json({
        success: false,
        message: 'Email authentication credentials are not configured.'
      });
    }
    
    console.log(`Setting up email transporter with host: ${existingSettings.host}, port: ${existingSettings.port}, secure: ${existingSettings.secure}`);
    
    // Create a test transporter using the existing settings
    const transporter = nodemailer.createTransport({
      host: existingSettings.host,
      port: existingSettings.port,
      secure: existingSettings.secure,
      auth: {
        user: existingSettings.authUser,
        pass: existingSettings.authPass,
      },
    });
    
    // Verify transporter configuration
    console.log('Verifying email transporter connection...');
    try {
      await transporter.verify();
      console.log('Email transporter connection verified successfully');
    } catch (verifyError) {
      console.error('Email transporter verification failed:', verifyError);
      return res.status(500).json({ 
        success: false, 
        message: 'Email server connection failed. Please check your settings.',
        error: verifyError instanceof Error ? verifyError.message : String(verifyError)
      });
    }
    
    const companyName = existingSettings.companyName || 'Warehouse Management System';
    
    // Send a test email
    console.log(`Sending test email from: "${companyName}" <${existingSettings.fromEmail}> to: ${testEmail}`);
    const info = await transporter.sendMail({
      from: `"${companyName}" <${existingSettings.fromEmail}>`,
      to: testEmail,
      subject: 'Test Email from Warehouse Management System',
      text: 'This is a test email from your Warehouse Management System. If you received this email, your email configuration is working correctly.',
      html: '<p>This is a test email from your Warehouse Management System.</p><p>If you received this email, your email configuration is working correctly.</p>',
    });
    
    console.log('Test email sent successfully:', info.messageId);
    return res.json({ 
      success: true, 
      message: 'Test email sent successfully. Please check your email inbox (and spam folder).'
    });
  } catch (error: unknown) {
    console.error('Error testing email connection:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email address format', 
        errors: error.errors,
      });
    }
    
    // For Gmail users with less secure apps turned off or 2FA enabled
    if (error instanceof Error && error.message?.includes('535')) {
      return res.status(500).json({
        success: false,
        message: 'Authentication failed. If using Gmail, you need an app password. Go to your Google Account > Security > App passwords.',
        error: error.message
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to send test email: ' + (error instanceof Error ? error.message : 'Unknown error'),
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
    const templatePath = path.join(emailTemplatesDir, `${templateName}.hbs`);
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ message: `Template '${templateName}' not found` });
    }
    
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    return res.json({ templateName, content: templateContent });
  } catch (error: unknown) {
    console.error('Error getting email template:', error);
    return res.status(500).json({ 
      message: 'Failed to get email template',
      error: error instanceof Error ? error.message : String(error)
    });
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
    const templatePath = path.join(emailTemplatesDir, `${templateName}.hbs`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(emailTemplatesDir)) {
      fs.mkdirSync(emailTemplatesDir, { recursive: true });
    }
    
    fs.writeFileSync(templatePath, content, 'utf8');
    
    return res.json({ 
      success: true, 
      message: 'Template updated successfully',
      templateName,
    });
  } catch (error: unknown) {
    console.error('Error updating email template:', error);
    return res.status(500).json({ 
      message: 'Failed to update email template',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get label template
 */
export async function getLabelTemplate(req: Request, res: Response) {
  try {
    const { templateName } = req.params;
    
    if (!templateName) {
      return res.status(400).json({ message: 'Template name is required' });
    }
    
    // Logic to get the label template by name
    const templatePath = path.join(labelTemplatesDir, `${templateName}.jscript`);
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ message: `Label template '${templateName}' not found` });
    }
    
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    return res.json({ templateName, content: templateContent });
  } catch (error: unknown) {
    console.error('Error getting label template:', error);
    return res.status(500).json({ 
      message: 'Failed to get label template',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Update label template
 */
export async function updateLabelTemplate(req: Request, res: Response) {
  try {
    const { templateName } = req.params;
    const { content } = req.body;
    
    if (!templateName) {
      return res.status(400).json({ message: 'Template name is required' });
    }
    
    if (!content) {
      return res.status(400).json({ message: 'Template content is required' });
    }
    
    // Logic to update the label template
    const templatePath = path.join(labelTemplatesDir, `${templateName}.jscript`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(labelTemplatesDir)) {
      fs.mkdirSync(labelTemplatesDir, { recursive: true });
    }
    
    fs.writeFileSync(templatePath, content, 'utf8');
    
    return res.json({ 
      success: true, 
      message: 'Label template updated successfully',
      templateName,
    });
  } catch (error: unknown) {
    console.error('Error updating label template:', error);
    return res.status(500).json({ 
      message: 'Failed to update label template',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}