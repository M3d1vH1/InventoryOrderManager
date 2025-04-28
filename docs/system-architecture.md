# Warehouse Management System: System Architecture

## System Overview

The Warehouse Management System (WMS) is a comprehensive application designed for an olive oil business to manage inventory, orders, production, and shipping. Built with a React frontend and Express.js backend, it handles the full product lifecycle from raw materials through production to shipping and delivery.

## User Journey & Technical Structure

### 1. Authentication Flow

**User Journey:**
1. User navigates to the application
2. User is presented with a login form
3. After successful authentication, they're directed to the dashboard

**Technical Implementation:**
- Frontend: `client/src/pages/Login.tsx` handles login form and validation
- Backend: `server/auth.ts` manages authentication via Passport.js with local strategy
- Express middleware (`isAuthenticated` and `hasRole`) protects routes requiring authentication
- Sessions are managed via express-session and stored in PostgreSQL
- Default admin is created at first run via `createDefaultAdminUser()`

### 2. Dashboard & Navigation

**User Journey:**
1. User views key metrics and navigation options on the dashboard
2. User can navigate to different modules (Orders, Products, Customers, Inventory, Production)

**Technical Implementation:**
- The `client/src/pages/Dashboard.tsx` shows business metrics
- Navigation via `client/src/components/Sidebar.tsx` using wouter for routing
- Data fetching for metrics uses React Query to call backend API endpoints
- Real-time updates via WebSocket connection managed in `server/routes.ts`

### 3. Order Management Flow

**User Journey:**
1. User navigates to Orders page
2. User views list of orders with status-based color coding and filtering options
3. User can create new order, view/edit existing orders, or generate PDFs for warehouse staff

**Technical Implementation:**
- Order list view: `client/src/pages/Orders.tsx` shows all orders with filtering
- Order creation/editing: `client/src/components/orders/OrderForm.tsx` 
- API endpoints in `server/api/orders.ts` connect to database via Drizzle ORM
- Order data model defined in `shared/schema.ts` with order status tracking
- PDF generation via `server/services/puppeteerPdfService.ts` for printable order forms

**Order PDF Generation Flow:**
1. User clicks "Print Order PDF" button
2. Frontend calls `/api/order-pdf/:id` endpoint
3. Backend retrieves order and customer information, generates HTML with proper translations
4. Puppeteer converts HTML to PDF with Greek language support
5. PDF is streamed back to the client for download or preview

### 4. Product & Inventory Management

**User Journey:**
1. User navigates to Products/Inventory
2. User views product list with stock levels, can filter by category
3. User can add, edit products, update inventory levels, upload product images

**Technical Implementation:**
- Product list: `client/src/pages/Products.tsx` and `client/src/pages/ProductsShopify.tsx`
- Product form: `client/src/components/products/ProductForm.tsx`
- Image handling: `client/src/components/products/ProductImage.tsx` for consistent display with fallbacks
- API endpoints in `server/api/products.ts` and `server/api/imageUploadFix.ts`
- Inventory adjustments tracked in `inventory_history` table with proper audit trail

**Image Upload & Storage:**
1. User uploads an image via form with file input
2. Frontend sends multipart form data to `/api/products/upload-image` endpoint
3. Backend saves images to persistent storage (`.data/uploads/products`)
4. Images are served statically and displayed via the ProductImage component with fallback SVGs

### 5. Production Management

**User Journey:**
1. User navigates to Production module
2. User manages recipes, creates production batches, tracks material consumption
3. User monitors production status and output

**Technical Implementation:**
- Production overview: `client/src/pages/Production.tsx` with tabs for different production areas
- Production forms: `client/src/components/production/ProductionBatchForm.tsx`, `ProductionOrderForm.tsx`
- API endpoints in `server/api/production.ts` handle CRUD operations
- Recipe management connects raw materials to finished products
- Quality control tracking for production batches

### 6. Customer Management

**User Journey:**
1. User navigates to Customers page
2. User views/searches customer list, adds/edits customer information
3. When creating orders, customer information is used to pre-fill shipping details

**Technical Implementation:**
- Customer list: `client/src/pages/Customers.tsx`
- Customer form: `client/src/components/customers/CustomerForm.tsx`
- API endpoints in `server/api/customers.ts`
- Customer data is linked to orders, with persistent shipping/billing preferences

### 7. Data Flow Architecture

**Frontend to Backend Communication:**
1. API requests via React Query's `useQuery` and `useMutation` hooks
2. Axios for HTTP requests via standardized `apiRequest` in `client/src/lib/queryClient.ts`
3. WebSocket connection for real-time updates (inventory changes, order status updates)

**Backend to Database Communication:**
1. PostgreSQL database connection via `server/db.ts` with connection pooling
2. Drizzle ORM with typed schemas defined in `shared/schema.ts`
3. Repository pattern with `server/storage.ts` providing data access interface
4. Database migrations managed via Drizzle's schema push capability

**Internationalization:**
1. i18next library for translations in `client/src/i18n/`
2. Greek and English language support throughout the application
3. Language selection persisted in user preferences
4. PDF generation respects selected language for all text elements

## Key Technical Components

### Frontend Architecture

- **React** with functional components and hooks
- **Shadcn UI** components with **Tailwind CSS** for styling
- **React Query** for data fetching and cache management
- **React Hook Form** with **Zod** for form validation
- **Wouter** for lightweight routing
- **i18next** for internationalization

### Backend Architecture

- **Express.js** server with TypeScript
- **PostgreSQL** database
- **Drizzle ORM** for type-safe database access
- **Passport.js** for authentication
- **Puppeteer** for PDF generation
- **WebSocket** for real-time updates

### Database Schema Highlights

- **users**: Authentication and permission management
- **products**: Product catalog with inventory tracking
- **orders**: Order header information
- **order_items**: Line items for each order
- **customers**: Customer information with shipping preferences
- **production_batches**: Production process tracking
- **recipes**: Product formulations and requirements
- **inventory_history**: Audit trail for inventory changes

## Security Considerations

- Authentication via secure sessions
- Role-based access control (admin, warehouse, frontoffice)
- Input validation on both client and server side
- SQL injection protection via ORM parameterized queries
- XSS protection via React's automatic escaping and CSP headers
- HTTPS for all communications in production

## Deployment Architecture

- Node.js application deployed on Replit
- PostgreSQL database for data persistence
- Static assets (images, PDFs) stored in persistent storage
- Environment variables for configuration

## Conclusion

The Warehouse Management System integrates all aspects of warehouse operations from inventory control to order processing and production tracking. Its modular architecture allows for easy extension of functionality, while maintaining a consistent user experience and solid performance. The internationalization support and carefully designed PDF generation capabilities make it particularly suitable for this olive oil business with international customers and Greek-language internal operations.