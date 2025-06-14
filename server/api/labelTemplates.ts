import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

// Path to label templates directory
const labelTemplatesDir = path.join(process.cwd(), 'label_templates');
const tempDir = path.join(process.cwd(), 'temp');

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

/**
 * Preview a label template with sample data
 */
export async function previewLabelTemplate(req: Request, res: Response) {
  try {
    const { templateName } = req.params;
    const { content } = req.body;
    
    console.log('Request body for template preview:', req.body);
    console.log('Template name:', templateName);
    
    if (!templateName) {
      return res.status(400).json({ message: 'Template name is required' });
    }
    
    if (!content) {
      console.log('Content missing in request body');
      // If content is not provided in the request, try to fetch from the filesystem
      const templatePath = path.join(labelTemplatesDir, `${templateName}.jscript`);
      if (fs.existsSync(templatePath)) {
        const fileContent = fs.readFileSync(templatePath, 'utf8');
        if (fileContent) {
          console.log('Using template content from file');
          req.body.content = fileContent;
        } else {
          return res.status(400).json({ message: 'Template content is required and file is empty' });
        }
      } else {
        return res.status(400).json({ message: 'Template content is required and template file not found' });
      }
    }
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate sample data for variables
    const sampleData = {
      orderNumber: 'ORD-0123',
      customerName: 'Sample Customer',
      customerAddress: '123 Sample Street',
      customerCity: 'Sample City',
      customerPostalCode: '12345',
      customerCountry: 'Greece',
      shippingCompany: 'Sample Courier',
      trackingNumber: 'TRACK123456789',
      companyName: 'Your Company Name',
      shippingDate: new Date().toLocaleDateString(),
      // Box counting information 
      boxNumber: '1',
      boxCount: '4',
      boxInfo: 'Κιβώτιο 1/4', // Greek for "Box 1/4"
      // Product-related sample data
      name: 'Sample Product',
      sku: '123456789',
      description: 'This is a sample product',
      price: '€24.99',
      barcode: '5901234123457'
    };
    
    // Replace variables in the template with sample data
    let previewContent = req.body.content || '';
    console.log('Preview content before variable replacement:', previewContent);
    
    if (previewContent) {
      for (const [key, value] of Object.entries(sampleData)) {
        const regex = new RegExp(`{${key}}`, 'g');
        previewContent = previewContent.replace(regex, value);
      }
      console.log('Preview content after variable replacement (first 50 chars):', previewContent.substring(0, 50));
    } else {
      console.error('Preview content is empty or undefined');
      return res.status(400).json({ message: 'Template content is empty or invalid' });
    }
    
    // Create HTML preview
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Label Preview</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .preview-container {
          border: 1px solid #ccc;
          padding: 20px;
          margin-bottom: 20px;
          width: 100%;
          max-width: 600px;
          background-color: #f9f9f9;
        }
        .jscript-container {
          font-family: monospace;
          white-space: pre;
          padding: 20px;
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 4px;
          width: 100%;
          max-width: 600px;
          overflow-x: auto;
        }
        .preview-title {
          margin-bottom: 15px;
          color: #555;
        }
        .command-explanation {
          margin-top: 10px;
          color: #666;
          font-size: 0.9em;
        }
        .command {
          background-color: #e0e0e0;
          padding: 5px;
          border-radius: 3px;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <h1 class="preview-title">Label Template Preview</h1>
      
      <div class="preview-container">
        <h2>Visual Representation (Simplified)</h2>
        <div class="jscript-visual-preview">
          <!-- Embedded SVG logo that will always show -->
          <div style="text-align: center; margin-bottom: 20px; border: 1px solid #eee; padding: 10px; background-color: white;">
            <div style="margin: 0 auto; max-width: 200px; background-color: #fff; padding: 8px; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <svg width="200" height="50" viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                <rect x="0" y="0" width="200" height="50" fill="#f8f8f8" rx="5" ry="5"/>
                <text x="10" y="30" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#0055aa">Amphoreus</text>
                <text x="10" y="45" font-family="Arial, sans-serif" font-size="12" fill="#555555">Olive Oil Company</text>
              </svg>
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">Company Logo (Always Visible)</div>
          </div>
          
          ${previewContent
            .split('\n')
            .map((line: string) => {
              // Parse label commands and convert to visual representation
              if (line.startsWith('T ')) {
                // Text command: T x,y,r,font,x-mult,y-mult;data
                const parts = line.split(';');
                if (parts.length > 1) {
                  return `<div><strong>Text:</strong> ${parts[1]}</div>`;
                }
              } else if (line.startsWith('B ')) {
                // Barcode command: B x,y,r,type,width,height;data
                const parts = line.split(';');
                if (parts.length > 1) {
                  return `<div><strong>Barcode:</strong> ${parts[1]}</div>`;
                }
              } else if (line.includes('GI') && (line.includes('shipping-logo.png') || line.includes('/home/runner/workspace/public/shipping-logo.png'))) {
                // Logo command (detects both relative and absolute paths)
                return `<div><strong>Logo:</strong> Company Logo will be displayed here</div>`;
              }
              return '';
            })
            .filter((line: string) => line)
            .join('\n')
          }
        </div>
      </div>
      
      <h2>JScript Preview</h2>
      <div class="jscript-container">
${previewContent}
      </div>
      
      <div class="command-explanation">
        <p>Note: This is a simplified preview. The actual label will be rendered by the printer.</p>
        <p>Common JScript commands:</p>
        <ul>
          <li><span class="command">T x,y,r,font,x-mult,y-mult;data</span> - Text</li>
          <li><span class="command">B x,y,r,type,width,height;data</span> - Barcode</li>
          <li><span class="command">GI x,y,"filename"</span> - Graphics/Image</li>
          <li><span class="command">J</span> - Job start</li>
          <li><span class="command">A n</span> - Number of labels</li>
          <li><span class="command">S l1;...</span> - Label size</li>
        </ul>
      </div>
    </body>
    </html>
    `;
    
    // Save preview HTML to a temporary file
    const timestamp = Date.now();
    const previewFilename = `template-preview-${templateName}-${timestamp}.html`;
    const previewPath = path.join(tempDir, previewFilename);
    fs.writeFileSync(previewPath, html, 'utf8');
    
    // Create a public copy for web access
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Ensure the logo is available for the preview
    const sourceLogo = path.join(process.cwd(), 'attached_assets', 'Frame 40.png');
    const targetLogo = path.join(publicDir, 'shipping-logo.png');
    
    // Always copy the latest logo for preview with read permissions for all
    if (fs.existsSync(sourceLogo)) {
      console.log(`Copying logo from ${sourceLogo} to ${targetLogo} for preview`);
      fs.copyFileSync(sourceLogo, targetLogo);
      
      // Make sure file has correct permissions for web access
      try {
        fs.chmodSync(targetLogo, 0o644);
        console.log(`Updated permissions for ${targetLogo}`);
      } catch (error) {
        console.error(`Error updating permissions: ${error}`);
      }
    }
    
    const publicPath = path.join(publicDir, previewFilename);
    fs.copyFileSync(previewPath, publicPath);
    
    // Return the URL to access the preview
    return res.status(200).json({
      success: true,
      previewUrl: `/api/preview-label/${previewFilename}`,
      message: 'Preview generated successfully'
    });
  } catch (error: unknown) {
    console.error('Error generating template preview:', error);
    return res.status(500).json({
      message: 'Failed to generate template preview',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}