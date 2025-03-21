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
3. Access the application locally at http://localhost:5000
4. If you've configured network access (see section below), other devices can access it at http://YOUR_IP_ADDRESS:5000

#### Running as a Windows Service (for 24/7 operation)

To make the application run automatically at system startup:

1. Install PM2 (Process Manager for Node.js):
   ```
   npm install -g pm2
   ```

2. Create a startup script file (e.g., `start-wms.bat`) with:
   ```batch
   @echo off
   cd C:\warehouse-management
   npm start
   ```

3. Install PM2-Windows-Service:
   ```
   npm install -g pm2-windows-service
   ```

4. Install and configure the service:
   ```
   pm2-service-install
   ```

5. Start the application with PM2:
   ```
   pm2 start start-wms.bat --name "Warehouse Management System"
   ```

6. Save the PM2 configuration:
   ```
   pm2 save
   ```

Now the application will run automatically when the computer starts, even without logging in.

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

## Making the Server Accessible on Your Network

By default, the application only listens on `localhost` (127.0.0.1), which means it's only accessible from the same computer. To make it accessible from other devices on your network, follow these steps:

### 1. Configure the Server to Listen on All Network Interfaces

1. Open the `server/index.ts` file and locate the following line:
   ```typescript
   app.listen(PORT, () => {
   ```

2. Change it to listen on all interfaces by adding the IP address `0.0.0.0`:
   ```typescript
   app.listen(PORT, "0.0.0.0", () => {
   ```

3. Save the file and restart the application.

### 2. Find Your Computer's IP Address

1. Open Command Prompt and type:
   ```
   ipconfig
   ```

2. Look for the "IPv4 Address" under your active network connection (usually Ethernet or Wi-Fi).
   Example: `192.168.1.100`

### 3. Configure Windows Firewall

1. Open "Windows Defender Firewall with Advanced Security" from the Start menu.
2. Click on "Inbound Rules" in the left panel.
3. Click "New Rule..." in the right panel.
4. Select "Port" and click "Next".
5. Select "TCP" and enter "5000" as the port number, then click "Next".
6. Select "Allow the connection" and click "Next".
7. Select all network types (Domain, Private, Public) and click "Next".
8. Give the rule a name like "Warehouse Management System" and click "Finish".

### 4. Access the Application from Other Devices

1. On other devices in your network, open a web browser and enter:
   ```
   http://YOUR_IP_ADDRESS:5000
   ```
   Replace `YOUR_IP_ADDRESS` with the IP address you found in step 2.
   Example: `http://192.168.1.100:5000`

### 5. Making the Server Accessible from Outside Your Network (Optional)

To access your application from the internet:

1. **Static IP or Dynamic DNS**: Set up a static IP address or use a Dynamic DNS service like No-IP, DynDNS, or Duck DNS.

2. **Port Forwarding**:
   - Access your router's admin panel (typically at `192.168.1.1` or `192.168.0.1`)
   - Find the port forwarding section
   - Create a new rule that forwards port 5000 to your computer's local IP address
   - Save the settings

3. **Domain Name (Optional)**:
   - Register a domain name
   - Point it to your public IP address

4. **Security Considerations**:
   - Use HTTPS for public access
   - Set up a reverse proxy like NGINX
   - Consider using a VPN instead of direct internet access

## System Requirements

- Windows 11 (Windows 10 also supported)
- Intel Core i5 or AMD Ryzen 5 processor (or better)
- 8GB RAM recommended (4GB minimum)
- 10GB free disk space
- 1080p display recommended
- Network connection
- USB port for barcode scanner and label printer connectivity