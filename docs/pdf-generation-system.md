# PDF Generation System Documentation

## Overview

The PDF generation system in the Warehouse Management System is designed to create printable order forms for warehouse staff. These PDFs include essential information about orders, products, and shipping details, formatted for A4 paper with proper internationalization support (Greek and English). 

## Architecture

The system uses a two-step process to generate PDFs:
1. Generate HTML content with CSS for styling and structure
2. Convert the HTML to PDF using Puppeteer (a headless Chrome browser)

This approach provides:
- Full Unicode support for Greek characters
- Rich styling and layout control
- Printable output formatted for A4 paper
- Support for complex structures like tables and checkboxes

## Components

### 1. Primary PDF Generation Service

**File:** `server/services/puppeteerPdfService.ts`

This service is the core of the PDF generation system, providing functions to:
- Create a PDF from an order
- Handle language translation
- Format product information
- Generate verification checkboxes
- Display shipping information
- Format customer notes

Key functions:
- `generateOrderPDF(orderId, language)`: Main entry point for PDF creation
- `generateOrderHTML(orderWithItems, texts)`: Creates the HTML template with order data
- `getTranslatedTexts(language)`: Provides translations for PDF elements

### 2. Route Handlers for PDF Access

**Files:**
- `server/routes.ts` - Contains test routes and HTML preview routes
- `server/api/orderPdf.ts` - Contains the primary PDF generation route

These routes:
- Handle PDF generation requests from the frontend
- Process language parameters
- Stream PDF data back to the client
- Provide preview capabilities for testing

### 3. Frontend Integration

**Files:**
- `client/src/components/orders/OrderDetail.tsx` - Contains PDF download buttons
- `client/src/components/orders/OrderList.tsx` - Contains batch PDF actions

These components:
- Trigger PDF generation API calls
- Handle PDF downloads
- Manage error states for PDF generation

## PDF Generation Process

### 1. Order Data Preparation

When a user requests an order PDF:
1. The backend retrieves the complete order with its items from the database
2. Order items are grouped by tag/category and sorted alphabetically
3. Customer information is retrieved to access shipping details
4. Shipping company information is collected with fallback hierarchy:
   - Customer's billingCompany (if available)
   - Customer's shippingCompany (if available)
   - Customer's preferredShippingCompany (if available)
   - Order's shippingCompany (for legacy data)
   - Order's area (as final fallback)

### 2. HTML Template Generation

The HTML template includes:
- Order header with order number and customer name
- Priority indicator with color coding
- Product tables grouped by category/tag
- Each product line with checkbox for verification
- Verification section with checkboxes for front office and warehouse
- Shipping company information
- Notes section (if order has notes)
- Page footer with page numbers

Key styling features:
- A4 page size with appropriate margins
- Print-optimized CSS
- Responsive table layouts
- Color-coded priority indicators
- Properly sized verification checkboxes

### 3. PDF Conversion with Puppeteer

Puppeteer is used to:
1. Launch a headless Chrome browser
2. Load the generated HTML
3. Convert it to PDF with proper dimensions and settings
4. Stream the PDF back to the client

Configuration details:
- Uses system-installed Chromium browser
- Sets proper viewport and page size
- Configures margins and scale
- Sets printBackground option for proper rendering of colored elements

## Internationalization

The PDF generation system supports multiple languages:
- All text elements use translated strings
- Language selection is passed as a parameter
- Greek character rendering is properly handled
- Default language is Greek (el) for internal warehouse use

Translation dictionary includes:
- Form titles and headers
- Product information labels
- Verification text
- Shipping labels
- Notes section title
- Page numbering text

## Error Handling

The system includes comprehensive error handling:
- Browser launch failures are captured and reported
- Database errors during order retrieval are handled
- Timeout protection for PDF generation
- Invalid order ID handling
- Client-friendly error messages

## Debugging and Logging

For troubleshooting purposes:
- The system logs key information during PDF generation
- A test endpoint (`/test-order-pdf/:id`) is available for testing without authentication
- HTML preview endpoint (`/view-order-html/:id`) allows checking the HTML before PDF conversion

## Usage Examples

### From Order Detail Page

When a user clicks the "Print Order PDF" button:
1. The frontend calls `/api/order-pdf/:id` with the order ID
2. The backend generates the PDF with default language (Greek)
3. The PDF is returned as a download to the user's browser

### From Order List (Batch PDF)

When a user selects multiple orders and clicks "Generate PDFs":
1. The frontend makes multiple calls to `/api/order-pdf/:id` for each selected order
2. The backend generates each PDF
3. Each PDF is downloaded to the user's browser

## Future Enhancements

Potential improvements to the PDF system:
- Add barcode/QR code generation for easier order scanning
- Implement multi-page support for very large orders
- Add product images to order forms
- Create specialized PDF templates for different departments
- Implement digital signature capability for verification
- Add PDF caching for frequently accessed orders