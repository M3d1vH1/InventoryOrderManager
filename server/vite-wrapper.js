/**
 * Vite Development Server Wrapper for Replit Deployment
 * This script provides fallback functionality for Replit production deployments
 */

import fs from 'fs';
import path from 'path';

// Function to ensure the server/public directory exists with minimal content
const ensurePublicDirectory = () => {
  const publicDir = path.join(process.cwd(), 'server', 'public');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Create basic index.html if it doesn't exist
  const indexPath = path.join(publicDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Amphoreus - Warehouse Management</title>
        <style>
          body { font-family: Arial; margin: 0; padding: 40px; text-align: center; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Amphoreus Warehouse Management System</h1>
          <p>API server is running in production mode</p>
          <script>
            // Redirect to login page on production deployment
            window.location.href = '/login';
          </script>
        </div>
      </body>
      </html>
    `;
    fs.writeFileSync(indexPath, htmlContent);
  }
  
  // Create favicon to prevent 404 errors
  const faviconPath = path.join(publicDir, 'favicon.ico');
  if (!fs.existsSync(faviconPath)) {
    // Create minimal 1x1 ICO file (empty favicon)
    const emptyFavicon = Buffer.from([
      0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x01, 
      0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x30, 0x00, 
      0x00, 0x00, 0x16, 0x00, 0x00, 0x00, 0x28, 0x00, 
      0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 
      0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 
      0xff, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    fs.writeFileSync(faviconPath, emptyFavicon);
  }
  
  return true;
};

// Call the function to ensure the public directory exists
ensurePublicDirectory();

// Export the function for use elsewhere
export { ensurePublicDirectory };