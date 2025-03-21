# Windows 11 Installation Guide

This guide provides step-by-step instructions for installing and running the Warehouse Management System on a Windows 11 machine.

## Prerequisites

1. **Node.js 20.x LTS** - [Download from nodejs.org](https://nodejs.org/)
2. **PostgreSQL 15.x** - [Download from postgresql.org](https://www.postgresql.org/download/windows/)
3. **Git** (optional) - [Download from git-scm.com](https://git-scm.com/download/win)

## Step-by-Step Installation

### 1. Install Node.js

1. Download the Node.js 20.x LTS installer
2. Run the installer and follow the installation wizard
3. Ensure "Add to PATH" is checked during installation
4. Verify installation by opening a Command Prompt and typing:
   ```
   node --version
   npm --version
   ```

### 2. Install PostgreSQL

1. Download the PostgreSQL installer for Windows
2. Run the installer and follow the setup wizard
3. Remember the password you set for the 'postgres' user
4. Keep the default port (5432) unless you have a specific reason to change it
5. After installation, launch pgAdmin 4 (installed with PostgreSQL)
6. Create a new database named 'warehouse_db'

### 3. Download and Configure the Application

1. Download the application source code
2. Extract the ZIP file to a folder (e.g., C:\warehouse-management)
3. Open Command Prompt as Administrator
4. Navigate to the application folder:
   ```
   cd C:\warehouse-management
   ```
5. Create a `.env` file in the root directory with the following content:
   ```
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/warehouse_db
   STORAGE_PATH=C:\warehouse-management\storage
   ```
   Replace 'your_password' with your PostgreSQL password

### 4. Install Dependencies and Initialize the Database

1. In Command Prompt, still in the application directory, run:
   ```
   npm install
   ```
2. Create the storage directory:
   ```
   mkdir storage
   mkdir storage\products
   mkdir storage\documents
   ```
3. Initialize the database schema:
   ```
   npm run db:push
   ```

### 5. Start the Application

1. For development mode:
   ```
   npm run dev
   ```
2. For production mode:
   ```
   npm run build
   npm start
   ```
3. Access the application at http://localhost:5000

## Windows-Specific Considerations

### File Paths
The system uses forward slashes (/) for paths internally, but in Windows environment variables, use backslashes (\\) or double backslashes (\\\\).

### Symbolic Links
Windows requires administrator privileges to create symbolic links. The system will fall back to file copying if symlink creation fails.

### Firewall Configuration
Allow Node.js in Windows Firewall if you plan to access the system from other computers on your network:
1. Open Windows Defender Firewall with Advanced Security
2. Select "Inbound Rules" and click "New Rule..."
3. Select "Program" and specify the Node.js executable (typically in C:\Program Files\nodejs\node.exe)
4. Allow the connection and name the rule (e.g., "Node.js Application")

### Running as a Windows Service
To run the application as a Windows service, consider using [PM2](https://pm2.keymetrics.io/) or [node-windows](https://github.com/coreybutler/node-windows):

Using PM2:
```
npm install -g pm2
pm2 start npm --name "warehouse-management" -- start
pm2 save
pm2 startup
```

### Printer Setup for CAB EOS1
1. Download and install the printer drivers from the CAB website
2. Connect the printer via USB
3. Set as default printer or specify the printer name in Settings → Company Settings
4. Test printing with a small label before production use

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL service is running in Windows Services
- Check that the connection string in .env has the correct password and port
- Ensure no firewall is blocking PostgreSQL connections

### Permission Issues
- Run Command Prompt or PowerShell as Administrator when needed
- Check Windows User Account Control (UAC) settings
- Verify that your Windows user has full control over the application directory

### Network Access Issues
- If accessing from other computers, ensure the Windows Firewall allows connections on port 5000
- Check your router settings if accessing from outside your local network

## System Requirements

- Windows 11 (Windows 10 also supported)
- Intel Core i5 or AMD Ryzen 5 processor (or better)
- 8GB RAM recommended (4GB minimum)
- 10GB free disk space
- 1080p display recommended
- Network connection
- USB port for barcode scanner and label printer connectivity