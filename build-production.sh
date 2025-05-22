#!/bin/bash
# Production build script for Replit deployment

echo "=== Starting Production Build ==="
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

# Step 1: Clean previous build files
echo "Step 1: Cleaning previous build files..."
rm -rf dist
rm -rf client/dist
mkdir -p server/public

# Step 2: Create minimal server/public content
echo "Step 2: Creating minimal server/public content..."
cat > server/public/index.html << 'EOL'
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
    h1 { color: #333; }
    p { color: #666; }
    .loader {
      border: 5px solid #f3f3f3;
      border-top: 5px solid #3498db;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 2s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="message">
    <h1>Amphoreus Warehouse Management System</h1>
    <p>Production server is running</p>
    <div class="loader"></div>
    <p>If you are not redirected automatically, please click <a href="/login">here</a> to access the application.</p>
  </div>
</body>
</html>
EOL

# Step 3: Build backend
echo "Step 3: Building backend..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "=== Production Build Complete ==="
echo "Your application is now ready for deployment to Replit."
echo "Application will be available at: https://amphoreus.replit.app"