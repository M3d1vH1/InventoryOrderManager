# Warehouse Management System

## Overview
A comprehensive warehouse management system with order management, inventory tracking, supplier invoice/payment management, and shipping functionality. Built with React frontend and Express backend using PostgreSQL database.

## Recent Changes
- **June 23, 2025**: Complete overhaul of multibox labels loading system
  - Replaced sequential label loading with parallel processing for faster performance
  - Implemented robust retry logic with exponential backoff for failed labels
  - Added asset preloading to prevent repeated logo/image requests
  - Created shipping company modification feature allowing pre-print editing
  - Extended auto-print delay from 1s to 3s for better rendering reliability
  - Added comprehensive progress tracking with visual indicators
  - Implemented partial success handling - show available labels even if some fail
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
- ✅ Multibox labels loading performance and reliability (June 23, 2025)
- ✅ Sequential label loading causing slow performance
- ✅ Missing shipping company modification before printing
- ✅ Poor error handling for failed label generation
- ✅ Insufficient rendering time causing print issues
- ✅ Invoice and payment form data loss (December 18, 2025)
- ✅ Shipping company modification feature
- ✅ Field name inconsistencies between frontend and backend