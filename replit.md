# Warehouse Management System

## Overview
A comprehensive warehouse management system with order management, inventory tracking, supplier invoice/payment management, and shipping functionality. Built with React frontend and Express backend using PostgreSQL database.

## Recent Changes
- **June 24, 2025**: Completed professional tracking ID system implementation
  - **Tracking ID Generation**: All existing invoices (28) and payments (12) now have professional tracking IDs in format INV-001, PAY-001
  - **Console Error Fix**: Resolved missing Search import in AuditTrail component causing browser console errors
  - **Database Counters**: Implemented atomic counter system using tracking_id_counters table for reliable sequence generation
  - **API Integration**: Updated backend endpoints to include tracking IDs in invoice and payment list responses
  - **Frontend Display**: InvoiceList and PaymentList components now show tracking IDs in first column
  - **Future-Proof**: New invoices and payments automatically receive sequential tracking IDs starting from INV-029 and PAY-013
- **June 24, 2025**: Implemented comprehensive payment audit system with user tracking
  - **Payment Validation**: Added centralized validation service to prevent overpayments at API and database level
  - **Audit Trail**: Complete audit logging for all payment and invoice operations with user attribution, timestamps, and change history
  - **Database Triggers**: Added database-level protection against payment amount violations
  - **Data Repair**: Automated system to detect and fix payment discrepancies with proper audit logging
  - **API Endpoints**: New REST endpoints for accessing audit trails, checking discrepancies, and repairing data
  - **Security Features**: All audit operations require authentication, immutable audit logs, IP address tracking
  - **Audit UI**: Added comprehensive audit trail interface in Settings page with recent activity, entity search, discrepancy detection, and data management tools
- **June 24, 2025**: Fixed React Hooks console error and completed RBAC system
  - **React Hooks Fix**: Resolved hooks order violation that was causing component rendering errors
  - **Permission Toggle Controls**: Added real-time switches to enable/disable permissions for front_office and warehouse roles
  - **Add New Permissions**: Admins can now add new permissions to non-admin roles through intuitive interface
  - **Remove Permissions**: Easy permission removal with confirmation for role management
  - **Interactive UI**: Live updates with proper state management and error handling
  - **API Endpoints**: Complete REST API for permission management (PATCH, POST, DELETE operations)
  - **Role Restrictions**: Only admins can modify permissions, admin role permissions are protected
  - **Component Rewrite**: Complete RBAC component rewrite with proper hook ordering and enhanced functionality
- **June 24, 2025**: Fixed critical Slack notification bug for order status changes
  - **Database Schema**: Added slack_order_picked_template and slack_order_shipped_template columns
  - **Status-Specific Templates**: Order picked notifications use ✅ icon, shipped notifications use 🚚 icon
  - **SlackService Updates**: Enhanced service to use correct templates based on order status
  - **Settings Integration**: Updated UI to support new template fields for better notification customization
- **June 24, 2025**: Added Slack notifications for order status changes
  - **Order Picked Alerts**: Automatic Slack notifications when orders are marked as "picked"
  - **Order Shipped Alerts**: Automatic Slack notifications when orders are marked as "shipped"
  - **Database Schema**: Added slack_notify_order_picked and slack_notify_order_shipped columns to notification_settings table
  - **Settings UI**: Added toggle controls for picked and shipped order notifications in Settings page
  - **Template Support**: Both notifications use existing order template for consistent formatting
  - **Error Handling**: Robust error handling ensures order updates don't fail if Slack notifications fail
- **June 24, 2025**: Enhanced RBAC panel with complete user management system
  - **User Management**: Added comprehensive user creation, editing, and deletion capabilities to RBAC panel
  - **Password Reset**: Added password reset functionality for administrators to reset any user's password
  - **Role Management**: Full role assignment and modification capabilities (admin, front_office, warehouse)
  - **User Status**: User activation/deactivation controls and status display
  - **Enhanced UI**: Professional user interface with confirmation dialogs and detailed user information
  - **API Support**: Added PUT endpoint support alongside existing PATCH for user updates
- **June 24, 2025**: Reset warehouse user password
  - **Password Reset**: Reset password for warehouse user account to enable system access
  - **User Access**: Warehouse user now has working credentials for order picking and inventory management
- **June 23, 2025**: Finalized Settings page with RBAC integration and removed unused Users tab
  - **Production Ready**: Removed placeholder Users tab to clean up Settings interface
  - **RBAC Integration**: Complete role-based access control display now available under dedicated RBAC tab
  - **Streamlined Navigation**: Settings page now focuses on implemented features (Notifications, RBAC, System, Performance, Labels, Images)
  - **Deployment Preparation**: Application optimized and ready for production deployment
- **June 23, 2025**: Added comprehensive RBAC display to Settings page
  - **RBAC Dashboard**: Complete role-based access control visualization showing all system roles and permissions
  - **Role Overview**: Visual cards displaying admin, front_office, and warehouse roles with user counts and permission statistics
  - **Permission Matrix**: Detailed breakdown of permissions by category (Dashboard, Products, Orders, etc.)
  - **Current Users Summary**: Table showing active users per role and their permission levels
  - **Interactive Design**: Accordion-style detailed view with icons and color-coded badges for easy navigation
  - **Security Integration**: Uses existing role permission API endpoints with proper authentication
- **June 23, 2025**: Fixed Settings page validation and webhook testing issues
  - **Settings Save Fix**: Notification settings now save properly with null template value handling
  - **Webhook URL Validation**: Added proper Slack webhook URL format validation with clear error messages
  - **Template Editor Fix**: Resolved null value handling in template editors with proper fallbacks
  - **Finance Webhook**: Enhanced webhook testing with better error messages for invalid URL formats
- **June 23, 2025**: Completed Settings page with full functionality
  - **Route Registration Fix**: Added proper API routes `/api/settings/notifications` to match frontend expectations
  - **User Management System**: Complete user creation, deletion, and role management with proper UI
  - **Webhook Testing**: Working Slack webhook testing with proper error handling and success feedback
  - **Template Customization**: Interactive template editor with variable insertion for notifications
  - **Form Validation**: Comprehensive form validation with proper error handling and success messages
  - **API Integration**: Fixed response parsing issues and improved error handling in mutations
  - **Missing UI Components**: Added Badge, Table, Select, Dialog components for user management functionality
- **June 23, 2025**: Fixed comprehensive notification system issues
  - **Critical Service Fix**: Corrected SlackService instantiation in invoice/payment service with missing storage parameter
  - **Added Missing Method**: Implemented sendNotification method for invoice/payment service compatibility
  - **Schema Cleanup**: Removed non-existent template fields from notification settings insert schema
  - **Simplified Templates**: Replaced complex JSON template parsing with simple string replacement for reliability
  - **Enhanced Error Handling**: Added comprehensive try-catch blocks and validation for webhook URLs
  - **Standardized Messages**: Created consistent text-based format for all notification types (orders, invoices, payments)
  - **HTTP Client Optimization**: Reduced timeouts from 15s to 8s and simplified retry logic for better performance
  - **Robust Validation**: Added webhook URL format validation and graceful error handling
  - **Separate Finance Webhook**: Added optional separate Slack webhook URL for invoice/payment notifications to different channel
  - **Settings UI Fix**: Repaired broken form structure that prevented saving notification settings and caused order alerts to stop working
  - **Complete Integration**: Added slackFinanceWebhookUrl to schema, default values, and UI with clear webhook routing indicators
- **June 23, 2025**: Secured repository against exposed secrets
  - **Enhanced .gitignore**: Added comprehensive security patterns for environment files, keys, logs, and database exports
  - **Removed Sensitive Files**: Cleaned up backup files, database exports, and temporary files containing sensitive data
  - **Security Template**: Created .env.example file with safe configuration template
  - **Production Ready**: Environment configured for secure production deployment
- **June 23, 2025**: Fixed shipping companies dropdown and order status update errors
  - **Database Query Fix**: Corrected table reference from `customersTable` to `customers` resolving silent database failures
  - **Comprehensive Company List**: Dropdown now displays all 112 transport companies from database instead of 7 fallback options
  - **Courier Service Filtering**: Excluded courier services (DHL, FedEx, ACS) to show only transport companies
  - **New Company Storage**: Added API endpoint to save new shipping companies to `custom_shipping_company` field
  - **Order Item Updates**: Fixed SQL syntax error in `updateOrderItem` method preventing 500 errors during order status updates
  - **Enhanced Error Logging**: Added detailed logging to track shipping company discovery and database operations
- **June 23, 2025**: Fixed critical UI and functionality issues
  - **Translation Headers Fix**: Replaced translation keys with actual Greek text in out-of-stock confirmation dialogs
  - **Shipping Company Selection Enhancement**: Added ability to add new shipping companies during label generation
  - **Expanded Shipping Company Database**: Enhanced shipping companies list to include all customer companies from database
  - **Greek UI Localization**: Standardized dialog buttons and messages to Greek language
  - **Label Generation Error Fix**: Resolved async issues in label preview generation
- **June 23, 2025**: Implemented three major features
  - **Out-of-Stock Handling**: Added comprehensive out-of-stock workflow in picking phase
    - Confirmation dialog for 0 quantity items with orange warning icons
    - Automatic unshipped item creation for backorder management
    - Slack notifications for orders with out-of-stock items
    - Warehouse staff can complete orders immediately with mixed fulfillment
  - **Label Generation Performance**: Complete overhaul of multibox labels system
    - Replaced sequential loading with parallel processing for faster performance
    - Implemented robust retry logic with exponential backoff for failed labels
    - Added asset preloading and shipping company modification features
    - Extended auto-print delay and comprehensive progress tracking
  - **Slack Notifications**: Enhanced notification system for invoices and payments
    - Automatic Slack alerts for new supplier invoices and payments
    - Integration with existing webhook configuration system
    - Out-of-stock order notifications with detailed information
- **December 18, 2025**: Fixed critical data loss issue in invoice and payment forms
  - Simplified complex form reset logic that was causing data loss on re-renders
  - Standardized field name handling for snake_case vs camelCase inconsistencies
  - Enhanced notes field persistence across both invoice and payment forms
  - Improved form data flow to prevent field values from disappearing

## Project Architecture

### Frontend (React + TypeScript)
- **Components**: Modular React components with shadcn/ui and Tailwind CSS
- **Forms**: React Hook Form with Zod validation
- **State**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing

### Backend (Express + TypeScript)
- **API**: RESTful endpoints with comprehensive error handling
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based auth with role management
- **Storage**: Unified storage interface with PostgreSQL implementation

### Key Features
- Order management with picking and shipping workflows
- Inventory tracking with barcode scanning
- Supplier invoice and payment management
- Customer management with shipping preferences
- Optimized multibox label printing with parallel loading and retry logic
- Pre-print shipping company modification for labels
- Real-time notifications and logging

## User Preferences
- Language: English and Greek support
- Focus on data integrity and preventing data loss
- Prefer comprehensive solutions over quick fixes
- Value clear documentation and proper error handling

## Technical Decisions
- Use PostgreSQL for all data persistence
- Implement consistent camelCase naming in frontend
- Handle both snake_case and camelCase for backend compatibility
- Maintain comprehensive logging for debugging
- Prioritize form data persistence and user experience

## Known Issues Resolved
- ✅ React Hooks order violation in RBAC component (June 24, 2025)
- ✅ RBAC permission management limitations (June 24, 2025)
- ✅ Admins can now add/remove permissions for front_office and warehouse roles
- ✅ Interactive permission toggles for real-time role management
- ✅ Missing API endpoints for permission CRUD operations
- ✅ Console errors preventing proper RBAC interface functionality
- ✅ Slack notification template handling for order status changes (June 24, 2025)
- ✅ Shipping companies dropdown only showing 7 companies instead of full database list (June 23, 2025)
- ✅ Database table reference error causing silent query failures
- ✅ Order status update 500 errors due to missing updateOrderItem method
- ✅ Incorrect field mapping for customer shipping company storage
- ✅ Multibox labels loading performance and reliability (June 23, 2025)
- ✅ Sequential label loading causing slow performance
- ✅ Missing shipping company modification before printing
- ✅ Poor error handling for failed label generation
- ✅ Insufficient rendering time causing print issues
- ✅ Invoice and payment form data loss (December 18, 2025)
- ✅ Shipping company modification feature
- ✅ Field name inconsistencies between frontend and backend