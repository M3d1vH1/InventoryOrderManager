# Warehouse Management System: Wix Integration Guide

This guide explains how to integrate your Warehouse Management System (WMS) with a Wix website. As discussed, the WMS is a standalone Node.js application that requires its own hosting, but it can be integrated with Wix through APIs.

## Overview of Integration Options

### 1. API Integration (Recommended)
Host your WMS separately and use Wix's Velo development platform to communicate with your WMS API.

### 2. iFrame Embedding
Embed specific pages from your hosted WMS into Wix using iFrames for limited integration.

### 3. Simplified Version for Wix
Create a simplified version of certain features directly in Wix using Velo.

## Recommended Approach: API Integration

### Step 1: Host Your WMS
1. Deploy the WMS on a cloud provider like:
   - Heroku
   - AWS
   - DigitalOcean
   - Railway
   - Render
   - Fly.io

2. Ensure your hosting environment supports:
   - Node.js (v16+)
   - PostgreSQL database
   - Environment variables for configuration

### Step 2: Set Up API Endpoints
The WMS already includes API endpoints for:
- Products
- Orders
- Inventory
- Customers
- Categories

### Step 3: Create a Wix-WMS Integration Layer
Add these specific API endpoints to your WMS for Wix integration:

```javascript
// In server/routes.ts, add these endpoints:

// Get product inventory for Wix
app.get('/api/wix/products', isAuthenticated, async (req, res) => {
  try {
    const products = await storage.getAllProducts();
    // Format specifically for Wix consumption
    const wixProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock: product.currentStock,
      lowStock: product.currentStock <= product.minStockLevel
    }));
    res.json(wixProducts);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving products" });
  }
});

// Create order from Wix
app.post('/api/wix/orders', isAuthenticated, async (req, res) => {
  try {
    const { customerName, items, notes } = req.body;
    // Create order in WMS
    const order = await storage.createOrder({
      customerName, 
      notes,
      status: 'pending'
    });
    
    // Add order items
    if (items && items.length > 0) {
      for (const item of items) {
        await storage.addOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity
        });
      }
    }
    
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: "Error creating order" });
  }
});

// Check if SKU exists (for Wix product creation)
app.get('/api/wix/check-sku/:sku', isAuthenticated, async (req, res) => {
  try {
    const product = await storage.getProductBySku(req.params.sku);
    res.json({ exists: !!product });
  } catch (error) {
    res.status(500).json({ message: "Error checking SKU" });
  }
});
```

### Step 4: Add Authentication for Wix
Create a secure API key system for Wix to authenticate:

```javascript
// In server/auth.ts, add this middleware

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.WIX_API_KEY;
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  next();
}

// Then in routes.ts, use this for Wix endpoints:
app.get('/api/wix/products', apiKeyAuth, async (req, res) => {
  // ...
});
```

### Step 5: Implement in Wix Using Velo
In your Wix site, use Velo (JavaScript) to connect to your WMS:

```javascript
// Example Wix code to fetch products
import wixFetch from 'wix-fetch';

// On your Wix product page
$w.onReady(function () {
  getInventoryLevels();
});

function getInventoryLevels() {
  const wmsApiUrl = "https://your-wms-server.com/api/wix/products";
  
  wixFetch.fetch(wmsApiUrl, {
    headers: {
      'x-api-key': 'your-secure-api-key'
    }
  })
  .then(response => response.json())
  .then(products => {
    // Update your Wix page with inventory information
    displayProductInventory(products);
  })
  .catch(error => {
    console.error("Error fetching inventory:", error);
  });
}

function displayProductInventory(products) {
  // Implement your UI update logic here
  // e.g., show stock levels next to Wix products
}
```

## iFrame Integration Option

If you prefer embedding the WMS interface directly:

1. Add routes to your WMS that don't require full navigation:

```javascript
// In server/routes.ts

// Special routes for embedded views
app.get('/embed/inventory', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/embed-inventory.html'));
});

app.get('/embed/orders', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/embed-orders.html'));
});
```

2. Create simplified versions of your UI components for embedding.

3. In Wix, add an HTML iFrame element:
```html
<iframe src="https://your-wms-server.com/embed/inventory" width="100%" height="600px"></iframe>
```

## Security Considerations

1. **CORS Configuration**: Configure your WMS to accept requests only from your Wix domain:

```javascript
// In server/index.ts
import cors from 'cors';

app.use(cors({
  origin: 'https://your-wix-site.com',
  credentials: false
}));
```

2. **API Key Security**:
   - Use a strong, randomly generated API key
   - Store it securely in Wix backend code, not frontend
   - Rotate the key periodically

3. **Rate Limiting**: Implement rate limiting to prevent abuse:

```javascript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/wix/', apiLimiter);
```

## Deployment Instructions

1. Install necessary packages:
```bash
npm install cors express-rate-limit
```

2. Set environment variables:
```
WIX_API_KEY=your_secure_api_key
WIX_ALLOWED_ORIGIN=https://your-wix-site.com
```

3. Deploy your application to your hosting provider.

4. Test the integration thoroughly before going live.

## Maintenance and Monitoring

1. Implement logging for all Wix-WMS interactions
2. Set up monitoring for API health and performance
3. Create a backup plan for data synchronization
4. Document all integration points for future reference

## Need Additional Help?

If you need further assistance with the Wix integration, please contact our support team.