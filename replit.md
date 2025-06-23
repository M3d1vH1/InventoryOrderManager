# Warehouse Management System

## Overview
A comprehensive warehouse management system with order management, inventory tracking, supplier invoice/payment management, and shipping functionality. Built with React frontend and Express backend using PostgreSQL database.

## Recent Changes
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