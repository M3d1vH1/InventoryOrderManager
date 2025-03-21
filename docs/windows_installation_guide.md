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

## Making the Server Accessible from the Internet

> **IMPORTANT**: Before exposing your application to the internet, carefully review the security guidelines in the following documents:
> - [Internet Access Security Guide](./internet_access_security.md)
> - [HTTPS Setup Guide](./https_setup_guide.md)

To make your application accessible from anywhere on the internet, follow these comprehensive steps:

### 1. Set Up a Static IP or Dynamic DNS

#### Option A: Static IP (if available from your ISP)
1. Contact your Internet Service Provider (ISP)
2. Request a static IP address (may involve additional cost)
3. Configure your router with the provided static IP settings

#### Option B: Dynamic DNS (recommended for home setups)
1. Create an account with a Dynamic DNS service:
   - [No-IP](https://www.noip.com/) (offers free tier)
   - [DuckDNS](https://www.duckdns.org/) (free)
   - [Dynu](https://www.dynu.com/) (free tier available)

2. Download and install the Dynamic DNS client for Windows
3. Configure the client with your account information
4. The client will keep your domain name pointed to your changing IP address

### 2. Configure Port Forwarding on Your Router

1. Find your computer's local IP address:
   ```
   ipconfig
   ```
   Note the "IPv4 Address" (typically like 192.168.1.x)

2. Access your router's admin panel:
   - Open a browser and enter your router's IP (typically `192.168.1.1` or `192.168.0.1`)
   - Log in with your router's admin credentials

3. Locate the Port Forwarding section:
   - May be under "Advanced Settings," "NAT/Gaming," or "Virtual Server"
   - Each router brand has different menu layouts

4. Create a new port forwarding rule:
   - External/Public Port: 5000
   - Internal/Private Port: 5000
   - Internal IP Address: Your computer's local IP address (from step 1)
   - Protocol: TCP (or TCP/UDP)
   - Enable the rule and save changes

5. Test if port forwarding is working:
   - Visit [canyouseeme.org](https://canyouseeme.org/)
   - Enter port 5000 and check if it's open

### 3. Set Up Security Measures (Critical for Internet Access)

#### A. Enable HTTPS with a Reverse Proxy

For secure internet access, install and configure NGINX as a reverse proxy:

1. Download and install [NGINX for Windows](https://nginx.org/en/download.html)

2. Create an SSL certificate:
   - For testing: Create a self-signed certificate using OpenSSL
   - For production: Use [Let's Encrypt](https://letsencrypt.org/) with [Certbot](https://certbot.eff.org/)

3. Configure NGINX (`C:\nginx\conf\nginx.conf`):
   ```nginx
   http {
     server {
       listen 443 ssl;
       server_name your-domain.duckdns.org;  # Your dynamic DNS domain

       ssl_certificate C:/path/to/certificate.crt;
       ssl_certificate_key C:/path/to/private.key;

       location / {
         proxy_pass http://localhost:5000;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection 'upgrade';
         proxy_set_header Host $host;
         proxy_cache_bypass $http_upgrade;
       }
     }

     # Redirect HTTP to HTTPS
     server {
       listen 80;
       server_name your-domain.duckdns.org;
       return 301 https://$host$request_uri;
     }
   }
   ```

4. Start NGINX service and set to auto-start

5. Update port forwarding rules:
   - Forward port 80 → your server's local IP, port 80
   - Forward port 443 → your server's local IP, port 443

#### B. Configure a Firewall

1. Configure Windows Firewall:
   - Allow inbound connections on ports 80 and 443 for NGINX
   - Block direct access to port 5000 from the internet
   - Allow local network access to port 5000

2. Install and configure a security tool like [Fail2Ban](https://www.fail2ban.org/) to prevent brute force attacks

### 4. Access Your Application

Once everything is configured:

1. From anywhere on the internet, access your application using:
   ```
   https://your-domain.duckdns.org
   ```

2. If using a self-signed certificate, you'll need to accept the security warning the first time

### 5. Set Up Regular Backups

Before making your application public, implement a backup strategy:

1. Schedule regular database backups:
   ```
   pg_dump -U postgres warehouse_db > backup_$(date +%Y%m%d).sql
   ```

2. Back up your application code and configuration files

3. Store backups in a separate location from your server

### 6. Strengthen User Authentication

For internet-facing applications, standard authentication is not enough:

1. **Set Strong Password Policies**:
   - Update the authentication system to enforce strong passwords
   - Require minimum length (10+ characters)
   - Require complexity (letters, numbers, special characters)
   - Implement account lockout after failed attempts

2. **Consider Two-Factor Authentication**:
   - Add a second authentication factor for extra security
   - Options include email verification codes, authenticator apps, or SMS

3. **Implement Session Management**:
   - Set reasonable session timeouts (e.g., 30 minutes of inactivity)
   - Allow only one active session per user
   - Provide a "logout from all devices" option for administrators

4. **Review and Limit User Permissions**:
   - Audit all user accounts regularly
   - Remove inactive accounts
   - Ensure each user has only the necessary permissions
   - Limit administrator accounts to absolute minimum

### 7. Monitor and Maintain

1. **Set Up Monitoring**:
   - Install and configure [Prometheus](https://prometheus.io/) and [Grafana](https://grafana.com/) for metrics monitoring
   - Set up email alerts for server issues (high CPU, memory usage, disk space)
   - Monitor application errors and response times

2. **Security Vigilance**:
   - Regularly check logs for suspicious activity
   - Implement a log rotation policy to prevent disk space issues
   - Consider a security information and event management (SIEM) solution

3. **Keep Everything Updated**:
   - Create a regular update schedule for Windows, Node.js, and all dependencies
   - Test updates in a staging environment before applying to production
   - Subscribe to security mailing lists for critical updates

4. **Incident Response Plan**:
   - Create a documented plan for security incidents
   - Include steps for containment, analysis, and recovery
   - Practice the plan periodically

## System Requirements

- Windows 11 (Windows 10 also supported)
- Intel Core i5 or AMD Ryzen 5 processor (or better)
- 8GB RAM recommended (4GB minimum)
- 10GB free disk space
- 1080p display recommended
- Network connection
- USB port for barcode scanner and label printer connectivity