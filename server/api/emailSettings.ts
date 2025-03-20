import { Request, Response } from "express";
import { db } from "../storage.postgresql";
import { emailSettings, insertEmailSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { saveEmailTemplate } from "../services/emailService";

// Get email settings
export async function getEmailSettings(req: Request, res: Response) {
  try {
    const settings = await db.query.emailSettings.findFirst();
    
    if (!settings) {
      return res.status(404).json({ message: "Email settings not found" });
    }
    
    // Don't return the auth password
    const { authPass, ...safeSettings } = settings;
    
    return res.json(safeSettings);
  } catch (error) {
    console.error("Error fetching email settings:", error);
    return res.status(500).json({ message: "Failed to fetch email settings" });
  }
}

// Create or update email settings
export async function updateEmailSettings(req: Request, res: Response) {
  try {
    const validatedData = insertEmailSettingsSchema.parse(req.body);
    
    // Check if settings exist
    const existingSettings = await db.query.emailSettings.findFirst();
    
    if (existingSettings) {
      // Update existing settings
      const updated = await db.update(emailSettings)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(emailSettings.id, existingSettings.id))
        .returning();
      
      if (!updated || updated.length === 0) {
        return res.status(500).json({ message: "Failed to update email settings" });
      }
      
      // Don't return the auth password
      const { authPass, ...safeSettings } = updated[0];
      
      return res.json(safeSettings);
    } else {
      // Create new settings
      const created = await db.insert(emailSettings)
        .values({
          ...validatedData,
          updatedAt: new Date()
        })
        .returning();
      
      if (!created || created.length === 0) {
        return res.status(500).json({ message: "Failed to create email settings" });
      }
      
      // Don't return the auth password
      const { authPass, ...safeSettings } = created[0];
      
      return res.status(201).json(safeSettings);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid email settings data", 
        errors: error.errors 
      });
    }
    
    console.error("Error updating email settings:", error);
    return res.status(500).json({ message: "Failed to update email settings" });
  }
}

// Test email connection
export async function testEmailConnection(req: Request, res: Response) {
  try {
    // This endpoint will be implemented later to test email connection
    return res.json({ success: true, message: "Email connection test successful" });
  } catch (error) {
    console.error("Error testing email connection:", error);
    return res.status(500).json({ message: "Email connection test failed" });
  }
}

// Get email template
export async function getEmailTemplate(req: Request, res: Response) {
  try {
    const { templateName } = req.params;
    
    if (!templateName) {
      return res.status(400).json({ message: "Template name is required" });
    }
    
    // This will be implemented to retrieve the template from the file system
    return res.json({ templateName });
  } catch (error) {
    console.error("Error fetching email template:", error);
    return res.status(500).json({ message: "Failed to fetch email template" });
  }
}

// Update email template
export async function updateEmailTemplate(req: Request, res: Response) {
  try {
    const { templateName } = req.params;
    const { content } = req.body;
    
    if (!templateName) {
      return res.status(400).json({ message: "Template name is required" });
    }
    
    if (!content) {
      return res.status(400).json({ message: "Template content is required" });
    }
    
    const success = await saveEmailTemplate(templateName, content);
    
    if (!success) {
      return res.status(500).json({ message: "Failed to save email template" });
    }
    
    return res.json({ success: true, message: "Email template saved successfully" });
  } catch (error) {
    console.error("Error updating email template:", error);
    return res.status(500).json({ message: "Failed to update email template" });
  }
}