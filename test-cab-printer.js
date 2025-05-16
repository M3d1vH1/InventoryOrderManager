// Test script for CAB EOS 1 printer
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Create a temporary directory for label files
const tempDir = path.join(process.cwd(), 'temp_labels');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Create a simple test label using JScript for CAB EOS 1
const createTestLabel = () => {
  // Based on CAB EOS manual - JScript programming language
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
};

// Send the label to the printer
const printTestLabel = async () => {
  try {
    console.log('Creating test label for CAB EOS1 printer...');
    
    // Generate label content
    const labelContent = createTestLabel();
    
    // Save to temp file
    const filePath = path.join(tempDir, `test-label-${Date.now()}.txt`);
    fs.writeFileSync(filePath, labelContent);
    
    console.log(`Test label saved to: ${filePath}`);
    console.log('Sending to printer...');
    
    // Determine command based on platform
    let command = '';
    
    if (process.platform === 'win32') {
      // Windows - Use COM port (adjust as needed - COM1, COM3, etc.)
      command = `copy "${filePath}" COM1:`;
    } else if (process.platform === 'linux') {
      // Linux - Use CUPS
      command = `lp -d CABEOS1 "${filePath}"`;
    } else if (process.platform === 'darwin') {
      // macOS
      command = `lp -d CABEOS1 "${filePath}"`;
    } else {
      console.log('Platform not recognized, simulating print...');
      command = `cat "${filePath}" && echo "Simulated printing to CAB EOS1"`;
    }
    
    console.log(`Executing command: ${command}`);
    
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr) {
      console.error('Error printing:', stderr);
    } else {
      console.log('Print command output:', stdout || 'No output');
      console.log('Test label sent to printer successfully');
    }
  } catch (error) {
    console.error('Error during test print:', error);
  }
};

// Run the test
printTestLabel();