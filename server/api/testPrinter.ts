import { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

// Temporary directory for test labels
const TEMP_DIR = path.join(process.cwd(), 'temp_labels');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Create a test label for CAB EOS1 printer
 */
function createTestLabel(): string {
  // Generate a test label using JScript commands for CAB EOS1
  return `
m m
J
H 100,0,T
S l1;0,0,68,71,100
T 25,25,0,3,pt15;CAB EOS1 TEST LABEL
T 25,50,0,3,pt12;Warehouse Management System
T 25,75,0,3,pt10;Print Test: ${new Date().toLocaleString()}
T 25,100,0,3,pt12;TEST SUCCESSFUL
T 25,220,0,3,pt8;This is a test label for the CAB EOS1 printer
A 1
`;
}

/**
 * Test CAB EOS1 printer by sending a test label
 */
export async function testPrinter(req: Request, res: Response) {
  try {
    console.log('[printer] Starting printer test for CAB EOS1');
    
    // Create test label content
    const labelContent = createTestLabel();
    
    // Save to temporary file
    const tempFilePath = path.join(TEMP_DIR, `test-label-${Date.now()}.txt`);
    fs.writeFileSync(tempFilePath, labelContent);
    
    console.log(`[printer] Test label saved to: ${tempFilePath}`);
    
    // Detect platform and create appropriate print command
    let printCommand = '';
    
    if (process.platform === 'win32') {
      // Windows - direct to COM port
      printCommand = `copy "${tempFilePath}" COM1:`;
    } else if (process.platform === 'linux') {
      // Linux with CUPS
      printCommand = `lp -d CABEOS1 "${tempFilePath}"`;
    } else if (process.platform === 'darwin') {
      // macOS
      printCommand = `lp -d CABEOS1 "${tempFilePath}"`;
    } else {
      // Fallback
      printCommand = `cat "${tempFilePath}" > /dev/usb/lp0`;
    }
    
    console.log(`[printer] Executing print command: ${printCommand}`);
    
    try {
      // Execute print command
      const { stdout, stderr } = await execPromise(printCommand);
      
      if (stderr) {
        console.error(`[printer] Command error: ${stderr}`);
        
        // Try alternate command if the first one fails
        console.log('[printer] Attempting alternate print method');
        
        if (process.platform === 'win32') {
          // Try with printer name instead of COM port
          const altCommand = `copy "${tempFilePath}" \\\\localhost\\CABEOS1`;
          console.log(`[printer] Executing alternative command: ${altCommand}`);
          
          try {
            const altResult = await execPromise(altCommand);
            if (!altResult.stderr) {
              return res.json({
                success: true,
                message: 'Test label sent to printer using alternative method'
              });
            }
          } catch (altError) {
            console.error('[printer] Alternative method also failed');
          }
        }
        
        return res.status(500).json({
          success: false,
          message: 'Error sending test label to printer',
          error: stderr
        });
      }
      
      console.log(`[printer] Command output: ${stdout || 'No output'}`);
      
      return res.json({
        success: true,
        message: 'Test label sent to CAB EOS1 printer'
      });
    } catch (execError: any) {
      console.error('[printer] Error executing print command:', execError);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to execute print command',
        error: execError.message
      });
    }
  } catch (error: any) {
    console.error('[printer] Error in test print process:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error processing test print request',
      error: error.message
    });
  }
}