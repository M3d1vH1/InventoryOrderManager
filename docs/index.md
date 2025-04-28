# Warehouse Management System Documentation

## System Overview

The Warehouse Management System (WMS) is a comprehensive application designed for an olive oil business to manage inventory, orders, production, and shipping. This documentation provides detailed information about the system architecture, components, and functionality.

## Documentation Index

### System Architecture
- [System Architecture Overview](system-architecture.md) - Complete end-to-end system architecture and data flow

### Core Modules
- [Order Management System](order-management-system.md) - Order lifecycle, status tracking, and fulfillment
- [PDF Generation System](pdf-generation-system.md) - Order form PDF creation for warehouse staff
- [Image Handling System](image-handling-system.md) - Product image management with fallbacks

### Development Guides
- [Extending the System](extending-the-system.md) - Comprehensive guide for developers to add new features

### Security & Deployment
- [Production Security Checklist](../production-security-checklist.md) - Security considerations for production deployment
- [Secure Deployment Guide](../secure-deployment-guide.md) - Step-by-step guide for secure deployment
- [Deployment Guide](../deployment-guide.md) - General deployment instructions

### Integration Guides
- [Wix Integration Guide](../wix-integration-guide.md) - Instructions for integrating with Wix websites

## Key Features

- **Order Management**: Complete order lifecycle tracking from creation to delivery
- **Inventory Control**: Real-time inventory tracking with adjustment history
- **Production Tracking**: Recipe management and production batch monitoring
- **Customer Management**: Customer information storage with shipping preferences
- **PDF Generation**: Printable order forms for warehouse staff
- **Internationalization**: Full support for Greek and English languages
- **Product Management**: Product catalog with image management
- **Reporting**: Comprehensive reporting and analytics capabilities

## Technical Stack

- **Frontend**: React, Shadcn UI, Tailwind CSS, React Query
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy
- **PDF Generation**: Puppeteer (headless Chrome)
- **Internationalization**: i18next
- **Routing**: Wouter
- **Form Handling**: React Hook Form with Zod validation

## Getting Started

To start the application:

```bash
npm run dev
```

This will launch both the frontend and backend servers. The application will be available at `http://localhost:5000`.

## Development Guidelines

When extending the application:

1. Define new data models in `shared/schema.ts`
2. Update storage methods in `server/storage.ts`
3. Add API endpoints in appropriate files under `server/api/`
4. Create React components in `client/src/components/`
5. Add new pages in `client/src/pages/`
6. Update translations in `client/src/i18n/translations/`

## Troubleshooting

Common issues and their solutions:

- **PDF Generation Errors**: Check Chromium installation and dependencies
- **Image Upload Issues**: Verify storage directory permissions
- **Database Connection Problems**: Check PostgreSQL connection parameters
- **Missing Translations**: Update the translation files for new UI elements

## Contact

For questions or support regarding this documentation, please contact the system administrator.