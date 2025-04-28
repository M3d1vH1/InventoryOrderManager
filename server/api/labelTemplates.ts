import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

// Path to label templates directory
const labelTemplatesDir = path.join(process.cwd(), 'label_templates');

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
      return res.status(404).json({ 
        message: `Label template '${templateName}' not found`,
        templateName
      });
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
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(labelTemplatesDir)) {
      fs.mkdirSync(labelTemplatesDir, { recursive: true });
    }
    
    // Write template to file
    const templatePath = path.join(labelTemplatesDir, `${templateName}.jscript`);
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

/**
 * Get all available label templates
 */
export async function getAllLabelTemplates(req: Request, res: Response) {
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(labelTemplatesDir)) {
      fs.mkdirSync(labelTemplatesDir, { recursive: true });
      return res.json({ templates: [] });
    }
    
    // Read all files in the directory
    const files = fs.readdirSync(labelTemplatesDir);
    
    // Filter for .jscript files and extract template names
    const templates = files
      .filter(file => file.endsWith('.jscript'))
      .map(file => ({
        name: file.replace('.jscript', ''),
        path: path.join(labelTemplatesDir, file)
      }));
    
    return res.json({ templates });
  } catch (error: unknown) {
    console.error('Error getting all label templates:', error);
    return res.status(500).json({ 
      message: 'Failed to get label templates',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}