/**
 * CAB EOS 1 Printer Detection Script
 * 
 * This script attempts to detect a connected CAB EOS 1 printer by:
 * 1. On Windows: scanning available COM ports
 * 2. On Linux: checking standard printer device paths
 */

import fs from 'fs';
import { exec } from 'child_process';
import os from 'os';

// Function to detect printer on Windows
function detectOnWindows() {
  console.log('Detecting CAB EOS 1 printer on Windows...');
  
  // Use PowerShell to list all COM ports
  exec('powershell "Get-WmiObject Win32_SerialPort | Select-Object DeviceID,Description"', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing PowerShell command: ${error.message}`);
      console.log('Try running as Administrator if you have permission issues');
      return;
    }
    
    const lines = stdout.split('\n');
    let found = false;
    
    console.log('\nAvailable COM ports:');
    console.log('------------------');
    
    lines.forEach(line => {
      // Look for CAB devices or generic USB-to-Serial devices
      if (line.includes('COM') && (
          line.toLowerCase().includes('cab') || 
          line.toLowerCase().includes('eos') || 
          line.toLowerCase().includes('usb') || 
          line.toLowerCase().includes('serial')
        )) {
        console.log(line.trim());
        found = true;
        
        // Extract the COM port
        const match = line.match(/COM\d+/);
        if (match) {
          console.log(`\nPotential CAB EOS 1 printer found at: ${match[0]}`);
          console.log(`Add this to your .env file: PRINTER_PORT=${match[0]}`);
        }
      }
    });
    
    if (!found) {
      console.log('No potential CAB printer ports found. Check if the printer is connected and powered on.');
    }
  });
}

// Function to detect printer on Linux
function detectOnLinux() {
  console.log('Detecting CAB EOS 1 printer on Linux...');
  
  // Common USB printer device paths on Linux
  const possiblePaths = [
    '/dev/usb/lp0',
    '/dev/usb/lp1',
    '/dev/usb/lp2',
    '/dev/lp0',
    '/dev/lp1',
    '/dev/lp2'
  ];
  
  // Check each path to see if it exists
  console.log('\nChecking device paths:');
  console.log('--------------------');
  
  let found = false;
  
  possiblePaths.forEach(path => {
    try {
      if (fs.existsSync(path)) {
        console.log(`${path}: ✓ Device exists`);
        found = true;
        
        console.log(`\nPotential CAB EOS 1 printer found at: ${path}`);
        console.log(`Add this to your .env file: PRINTER_PORT=${path}`);
      } else {
        console.log(`${path}: ✗ Not found`);
      }
    } catch (err) {
      console.log(`${path}: ✗ Error checking path`);
    }
  });
  
  if (!found) {
    console.log('\nNo printer devices found in standard locations.');
    console.log('Try running: ls -l /dev/usb/lp* /dev/lp* 2>/dev/null');
    console.log('or: lpstat -p');
  } else {
    // Also show CUPS printers for reference
    exec('lpstat -p 2>/dev/null || echo "CUPS not found"', (error, stdout, stderr) => {
      if (!error && stdout && !stdout.includes('not found')) {
        console.log('\nCUPS printers:');
        console.log('-------------');
        console.log(stdout);
      }
    });
  }
}

// Main function
function detectPrinter() {
  console.log('====================================');
  console.log('   CAB EOS 1 Printer Detection');
  console.log('====================================');
  console.log(`System: ${os.type()} ${os.release()}`);
  
  // Detect based on platform
  switch (os.platform()) {
    case 'win32':
      detectOnWindows();
      break;
    case 'linux':
      detectOnLinux();
      break;
    case 'darwin':
      console.log('MacOS detected. CAB EOS 1 printers usually use CUPS on Mac.');
      console.log('Try running: lpstat -p');
      break;
    default:
      console.log(`Unsupported platform: ${os.platform()}`);
      console.log('This script supports Windows and Linux.');
  }
}

// Use promisified exec
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

// Run the detection
detectPrinter();