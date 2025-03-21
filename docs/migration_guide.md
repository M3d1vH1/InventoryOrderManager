# Migration Guide: Moving to Self-Hosted Environment

## Deployment Requirements

- Node.js 20.x or later
- PostgreSQL 15.x or later
- 1GB RAM minimum (2GB+ recommended)
- 10GB disk space (more for product images and documents)
- Modern web browser (Chrome, Firefox, Edge, Safari)

## Configuration Steps

### 1. Environment Variables Setup

Create a `.env` file in your project root with these important variables:

```
# Database Connection
DATABASE_URL=postgresql://username:password@localhost:5432/warehouse_db

# Storage Configuration
STORAGE_PATH=/path/to/persistent/storage

# Email Configuration (if using email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
SMTP_COMPANY_NAME=Your Company Name

# Optional: Server Port (defaults to 5000)
PORT=5000
```

### 2. Database Migration

1. Install PostgreSQL and create a new database:
   ```sql
   CREATE DATABASE warehouse_db;
   ```

2. Apply the database schema using Drizzle:
   ```
   npm run db:push
   ```

3. If you're migrating data from your Replit deployment:
   - Export your data using pgAdmin or psql: 
     ```
     pg_dump -h YOUR_REPLIT_DB_HOST -U YOUR_REPLIT_DB_USER -d YOUR_REPLIT_DB_NAME > warehouse_backup.sql
     ```
   - Import to your new database:
     ```
     psql -h localhost -U your_db_user -d warehouse_db < warehouse_backup.sql
     ```

### 3. Storage System Configuration

The system uses a three-tier approach for file storage:

1. First priority: Custom location defined by `STORAGE_PATH` environment variable
2. Second priority: `.data` directory in project root (automatically used in Replit)
3. Third priority: Standard storage directories in project root

To migrate product images and documents:

1. Set the `STORAGE_PATH` environment variable to your desired location
2. Use the built-in migration utility in the Admin Settings page
3. Alternatively, manually copy files from `public/uploads` to your new storage location

### 4. Building for Production

```bash
# Install dependencies
npm install

# Build the frontend
npm run build

# Start the production server
npm start
```

### 5. Reverse Proxy Setup (Optional)

For production deployment, set up Nginx or Apache as a reverse proxy:

**Nginx Example:**
```nginx
server {
    listen 80;
    server_name your-warehouse-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Windows-Specific Considerations

1. **File Paths**: The system uses forward slashes (/) for paths, but in Windows environment variables, use backslashes (\\) or double backslashes (\\\\)

2. **Symbolic Links**: Windows requires administrator privileges to create symbolic links. The system will fall back to file copying if symlink creation fails.

3. **Firewall Configuration**: Allow Node.js in Windows Firewall if you plan to access the system from other computers on your network.

4. **Windows Services**: To run the application as a Windows service, consider using [PM2](https://pm2.keymetrics.io/) or [node-windows](https://github.com/coreybutler/node-windows).

5. **Printer Setup**: For label printing with CAB EOS1 printer, install the printer drivers from the manufacturer website and ensure the printer is set as the default printer or specify the printer name in Settings → Company Settings.

## Troubleshooting Common Issues

### Database Connection Problems

- **Error**: "Could not connect to PostgreSQL database"
  - Verify PostgreSQL is running: In Windows, check Services app
  - Confirm connection string format in .env file
  - Check firewall settings if database is on another machine

### Image Storage Issues

- **Error**: "Cannot write to storage directory"
  - Ensure the STORAGE_PATH directory exists and has write permissions
  - For Windows, run the application with Administrator privileges
  - Check Windows User Account Control (UAC) settings

### Email Configuration Issues

- **Error**: "Failed to send email"
  - Verify SMTP settings in environment variables
  - For Gmail, ensure "Allow less secure apps" is enabled or use App Password
  - Test connection through Settings → Email Settings → Test Connection

### Printer Connection Issues

- **Error**: "Failed to print label"
  - Verify printer is connected and powered on
  - Check printer drivers are installed
  - Ensure JScript is supported by your printer model (CAB printers)

For any additional assistance, please refer to the project documentation or contact support.