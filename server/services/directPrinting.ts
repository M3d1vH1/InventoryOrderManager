/**
 * Direct Printing Service for CAB EOS 1 Label Printer
 * 
 * This service provides direct printing capabilities for the CAB EOS 1 printer
 * by handling the platform-specific printing commands and managing print jobs.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Define printer types
export enum PrinterType {
  CABEOS1 = 'CAB EOS1',
  GENERIC = 'Generic'
}

// Define printer connection types
export enum ConnectionType {
  USB = 'USB',
  NETWORK = 'NETWORK',
  CUPS = 'CUPS'
}

// Printer configuration object
export interface PrinterConfig {
  type: PrinterType;
  connection: ConnectionType;
  name: string;
  port?: string; // For USB connections, e.g. COM3 on Windows
  ipAddress?: string; // For network printers
}

// Default CAB EOS1 configuration
const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  type: PrinterType.CABEOS1,
  connection: ConnectionType.USB,
  name: 'CABEOS1',
  port: process.platform === 'win32' ? 'COM1' : '/dev/usb/lp0' // Default ports for different platforms
};

/**
 * DirectPrintingService class for handling printer operations
 */
export class DirectPrintingService {
  private config: PrinterConfig;
  private tempDir: string;

  /**
   * Initialize the printing service with printer configuration
   */
  constructor(config: PrinterConfig = DEFAULT_PRINTER_CONFIG) {
    this.config = config;
    this.tempDir = path.join(process.cwd(), 'temp_labels');
    
    // Ensure the temporary directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Save label content to a temporary file
   */
  async saveToTempFile(content: string, prefix: string = 'label'): Promise<string> {
    const filename = `${prefix}_${Date.now()}.txt`;
    const filePath = path.join(this.tempDir, filename);
    
    await fs.promises.writeFile(filePath, content, 'utf8');
    console.log(`[printer] Label content saved to ${filePath}`);
    
    return filePath;
  }

  /**
   * Check if running in Replit environment
   */
  private isReplitEnvironment(): boolean {
    return process.env.REPL_ID !== undefined || process.env.REPL_OWNER !== undefined;
  }
  
  /**
   * Create platform-specific printer command
   */
  createPrintCommand(filePath: string): string {
    let command = '';
    
    // Special handling for Replit environment
    if (this.isReplitEnvironment()) {
      console.log('[printer] Detected Replit environment, using simulation mode');
      // In Replit, just cat the file to stdout so we can see what would be printed
      return `cat "${filePath}" && echo "[REPLIT] In production, this would be sent to the CAB EOS 1 printer"`;
    }
    
    switch (process.platform) {
      case 'win32':
        // Windows command using COM port
        if (this.config.connection === ConnectionType.USB && this.config.port) {
          // Direct to COM port
          command = `copy "${filePath}" ${this.config.port}:`;
        } else {
          // Shared printer
          command = `copy "${filePath}" \\\\localhost\\${this.config.name}`;
        }
        break;
        
      case 'linux':
        // Linux command using CUPS
        if (this.config.connection === ConnectionType.CUPS) {
          command = `lp -d ${this.config.name} "${filePath}"`;
        } else if (this.config.connection === ConnectionType.USB) {
          // Try direct USB device access on Linux
          command = `cat "${filePath}" > /dev/usb/lp0`;
        } else {
          command = `lp -d ${this.config.name} "${filePath}"`;
        }
        break;
        
      case 'darwin':
        // macOS command
        command = `lp -d ${this.config.name} "${filePath}"`;
        break;
        
      default:
        // Fallback for other platforms
        command = `echo "Platform ${process.platform} not directly supported, attempting generic print command"`;
        command += ` && cat "${filePath}" > /dev/usb/lp0`;
    }
    
    return command;
  }

  /**
   * Send content directly to the printer
   */
  async printContent(content: string, identifier: string = ''): Promise<{success: boolean, message: string}> {
    try {
      // Save content to temp file
      const prefix = identifier ? `label_${identifier}` : 'label';
      const filePath = await this.saveToTempFile(content, prefix);
      
      // Create the platform-specific print command
      const command = this.createPrintCommand(filePath);
      console.log(`[printer] Executing print command: ${command}`);
      
      try {
        // Execute the print command
        const { stdout, stderr } = await execPromise(command);
        
        if (stderr && stderr.trim() !== '') {
          console.error(`[printer] Command error: ${stderr}`);
          return { success: false, message: `Error: ${stderr}` };
        }
        
        console.log(`[printer] Command output: ${stdout || 'No output'}`);
        return { 
          success: true, 
          message: `Label successfully sent to ${this.config.type} printer` 
        };
      } catch (execError: any) {
        console.error('[printer] Error executing print command:', execError.message);
        
        // On error, try an alternative approach
        if (process.platform === 'win32' && this.config.connection === ConnectionType.USB) {
          console.log('[printer] Attempting alternative Windows print approach...');
          try {
            // Try alternative printer name approach
            const altCommand = `copy "${filePath}" \\\\localhost\\${this.config.name}`;
            console.log(`[printer] Executing alternative command: ${altCommand}`);
            const { stdout, stderr } = await execPromise(altCommand);
            
            if (!stderr) {
              console.log(`[printer] Alternative command succeeded: ${stdout || 'No output'}`);
              return { 
                success: true, 
                message: `Label successfully sent to ${this.config.type} printer (alternative method)` 
              };
            }
          } catch (altError) {
            console.error('[printer] Alternative method also failed');
          }
        }
        
        return { 
          success: false, 
          message: `Failed to print: ${execError.message}` 
        };
      }
    } catch (error: any) {
      console.error('[printer] Error in print process:', error);
      return { 
        success: false, 
        message: `Error: ${error.message}` 
      };
    }
  }
}

// Create and export a singleton instance with default configuration
export const directPrinter = new DirectPrintingService();