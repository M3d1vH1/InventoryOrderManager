// Special Replit deployment configuration
import fs from 'fs';
import path from 'path';

// Create a minimal public directory structure if it doesn't exist
const ensurePublicDirectory = () => {
  const publicDir = path.join(process.cwd(), 'server', 'public');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Create a minimal index.html if it doesn't exist
  const indexPath = path.join(publicDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Amphoreus - Warehouse Management System</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .message {
            text-align: center;
            padding: 2rem;
            border-radius: 0.5rem;
            background-color: white;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #333;
          }
          p {
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="message">
          <h1>Amphoreus</h1>
          <p>Warehouse Management System</p>
          <p>Loading application...</p>
        </div>
      </body>
      </html>
    `;
    fs.writeFileSync(indexPath, htmlContent);
  }
};

export default ensurePublicDirectory;