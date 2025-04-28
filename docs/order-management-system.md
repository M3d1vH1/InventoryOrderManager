# Order Management System Documentation

## Overview

The Order Management System is a core component of the Warehouse Management System, handling the complete lifecycle of customer orders from creation through fulfillment to delivery. Built for an olive oil business with seasonal demand patterns, it provides comprehensive tools for managing orders, tracking status changes, and generating necessary documentation.

## Architecture

The Order Management System follows a layered architecture:
1. **User Interface Layer**: React components for order creation, editing, and visualization
2. **Service Layer**: Backend APIs handling business logic and data validation
3. **Data Access Layer**: Database operations for persistent storage
4. **Integration Layer**: Connections to other system modules (inventory, shipping, production)

## Components

### 1. Order Data Model

**File:** `shared/schema.ts`

The core order data structure includes:
- `orders` table: Order header information
- `order_items` table: Line items for each order
- Related entities: `customers`, `products`, `shipping_documents`

**Key Fields:**
- Order: ID, orderNumber, customerName, customerAddress, status, priority, area, notes, createdAt, updatedAt
- Order Items: ID, orderId, productId, quantity, price, notes
- Support fields: billingCompany (previously customShippingCompany), shippingCompany, shippingDocumentId

**Order Status Tracking:**
- `pending`: Initial state, order created but not processed
- `picked`: Products gathered from warehouse
- `partially_shipped`: Some items shipped, others pending
- `shipped`: All items shipped, awaiting delivery confirmation
- `delivered`: Order successfully received by customer
- `cancelled`: Order cancelled before completion

### 2. Frontend Components

**Files:**
- `client/src/pages/Orders.tsx`: Main order listing page
- `client/src/components/orders/OrderForm.tsx`: Order creation/editing form
- `client/src/components/orders/OrderList.tsx`: Tabular view of orders with filtering
- `client/src/components/orders/OrderDetail.tsx`: Detailed view of a single order
- `client/src/components/orders/OrderStatusBadge.tsx`: Visual indicator of order status

**Key Features:**
- Status-based color coding for quick visual identification
- Advanced filtering by customer, status, date range
- Batch selection for multi-order operations
- Inline editing for quick updates
- PDF generation for warehouse picking

### 3. Backend API

**Files:**
- `server/api/orders.ts`: Primary order management endpoints
- `server/api/orderItems.ts`: Endpoints for managing order line items
- `server/api/orderPdf.ts`: PDF generation endpoints
- `server/routes.ts`: Additional order-related routes

**Key Endpoints:**
- `GET /api/orders`: List all orders with filtering
- `GET /api/orders/:id`: Get single order details
- `POST /api/orders`: Create new order
- `PATCH /api/orders/:id`: Update order information
- `DELETE /api/orders/:id`: Delete order (with validation)
- `GET /api/orders/:id/items`: Get items for specific order
- `POST /api/orders/:id/items`: Add items to order
- `GET /api/order-pdf/:id`: Generate printable order form

### 4. Order Change Tracking

**Files:**
- `server/api/orderChangelogs.ts`: Endpoints for change history
- `client/src/components/orders/OrderHistory.tsx`: UI for viewing changes

**Implementation:**
- Each order modification is logged with timestamp, user, and change details
- Changes are displayed in chronological order
- Provides audit trail for troubleshooting and accountability

## Order Lifecycle

### 1. Order Creation

When a user creates a new order:
1. User fills the OrderForm with customer details, products, quantities
2. Form validates data using Zod schema from `shared/schema.ts`
3. On submit, data is sent to `/api/orders` endpoint
4. Backend validates the data again for security
5. New order is created with `pending` status
6. Order items are created in separate transactions
7. Inventory is checked (with optional reservation)
8. Order confirmation is displayed to user

### 2. Order Processing

The warehouse team processes orders by:
1. Printing order PDF with categorized products and verification checkboxes
2. Gathering products from warehouse locations
3. Marking items as verified on the printed form
4. Updating order status to `picked` via the UI
5. Recording any inventory discrepancies

### 3. Order Shipping

For order fulfillment:
1. Orders are packed and prepared for shipping
2. Shipping details are confirmed using customer's preferred shipping company
3. Order status is updated to `shipped` or `partially_shipped`
4. Shipping documents are generated and linked to the order
5. Tracking information is recorded if available

### 4. Order Completion

Order lifecycle completion includes:
1. Delivery confirmation updates status to `delivered`
2. Any returns or issues are recorded
3. Final inventory adjustments are made if necessary
4. Order is archived for reporting and analytics

## Special Features

### 1. Partial Order Fulfillment

The system supports partial order fulfillment with:
- Line-item level status tracking
- Ability to ship available items while keeping others pending
- Special `partially_shipped` status for split orders
- Visual indicators of partial fulfillment in the UI

### 2. Order Prioritization

Order priority system includes:
- Three levels: High, Medium, Low (with color coding)
- Priority filtering in order list
- Prominent display in order PDFs
- Can be updated based on changing customer needs

### 3. Customer Information Persistence

For improved customer experience:
- Previous shipping preferences are stored with customer record
- Billing company information persists across orders
- Area and shipping company selections are remembered
- Each customer's order history is easily accessible

### 4. PDF Generation

Printable order forms include:
- Product grouping by category/tag for easier picking
- Verification checkboxes for warehouse staff
- Full internationalization (Greek/English)
- Shipping company information with fallback hierarchy
- Notes section for special instructions

## Integration Points

### 1. Inventory Management

Orders interact with inventory through:
- Stock level checks during order creation
- Inventory reservations when orders are confirmed
- Automatic stock adjustments when orders are shipped
- Alerts for insufficient inventory

### 2. Customer Management

Order system integrates with customer data via:
- Customer selection during order creation
- Auto-population of customer shipping details
- Customer order history tracking
- Customer-specific preferences

### 3. Production Planning

Orders influence production through:
- Demand forecasting based on order history
- Production prioritization based on pending orders
- Just-in-time manufacturing triggers
- Seasonal pattern recognition

## Reporting and Analytics

The order system provides insights through:
- Order volume metrics by time period
- Status distribution analysis
- Customer ordering patterns
- Product popularity tracking
- Geographic distribution of orders
- Shipping company usage statistics

## Future Enhancements

Potential improvements to the Order Management System:
- Automated shipping rate calculation
- Direct integration with shipping carriers
- Customer portal for order tracking
- Mobile scanning application for warehouse staff
- Enhanced return processing
- Subscription/recurring order capability
- Advanced demand forecasting with machine learning