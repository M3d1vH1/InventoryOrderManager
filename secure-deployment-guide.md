# Secure Deployment Guide for Warehouse Management System

This guide provides step-by-step instructions for deploying the Warehouse Management System to a production environment with enhanced security measures.

## Prerequisites

- A server or cloud instance with Node.js 18+ installed
- PostgreSQL 14+ database server
- Domain name with SSL certificate
- Node.js, npm and git installed on the deployment server

## Step 1: Prepare the Database

1. **Create a dedicated PostgreSQL database**:
   ```sql
   CREATE DATABASE warehouse_management;
   CREATE USER warehouse_user WITH ENCRYPTED PASSWORD 'strong_unique_password';
   GRANT ALL PRIVILEGES ON DATABASE warehouse_management TO warehouse_user;
   ```

2. **Enable SSL for database connections**:
   - Ensure PostgreSQL is configured with SSL
   - Add `?sslmode=require` to your database connection string

3. **Set up database connection pooling**:
   - The application already uses connection pooling via Drizzle ORM
   - For high-traffic instances, consider using pgBouncer

## Step 2: Clone and Prepare the Application

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/warehouse-management-system.git
   cd warehouse-management-system
   ```

2. **Install dependencies**:
   ```bash
   npm ci --production
   ```

3. **Create a secure .env file**:
   ```
   # Production environment flag
   NODE_ENV=production
   
   # Application URL
   APP_URL=https://your-warehouse-system-domain.com
   
   # Database connection (with SSL)
   DATABASE_URL=postgresql://warehouse_user:strong_unique_password@localhost:5432/warehouse_management?sslmode=require
   
   # Session secret (generate a random string of at least 64 characters)
   SESSION_SECRET=generate_random_string_here
   
   # Email settings (if using email functionality)
   SMTP_HOST=smtp.yourprovider.com
   SMTP_PORT=587
   SMTP_USER=your_email_user
   SMTP_PASS=your_email_password
   SMTP_FROM=noreply@your-warehouse-system-domain.com
   
   # Slack settings (if using Slack notifications)
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
   ```

4. **Build the application**:
   ```bash
   npm run build
   ```

## Step 3: Secure the Server

1. **Update system packages**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Configure the firewall**:
   ```bash
   sudo ufw allow ssh
   sudo ufw allow http
   sudo ufw allow https
   sudo ufw enable
   ```

3. **Install and configure Nginx as a reverse proxy**:
   ```bash
   sudo apt install nginx
   ```

4. **Create Nginx configuration**:
   Create a file at `/etc/nginx/sites-available/warehouse-management`:
   ```nginx
   server {
       listen 80;
       server_name your-warehouse-system-domain.com;
       
       # Redirect HTTP to HTTPS
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name your-warehouse-system-domain.com;
       
       # SSL Configuration
       ssl_certificate /path/to/fullchain.pem;
       ssl_certificate_key /path/to/privkey.pem;
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_prefer_server_ciphers on;
       ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
       ssl_session_cache shared:SSL:10m;
       ssl_session_timeout 1d;
       ssl_session_tickets off;
       
       # HSTS (comment out if you're testing)
       add_header Strict-Transport-Security "max-age=15768000; includeSubDomains; preload" always;
       
       # Security headers
       add_header X-Content-Type-Options "nosniff" always;
       add_header X-Frame-Options "SAMEORIGIN" always;
       add_header X-XSS-Protection "1; mode=block" always;
       add_header Referrer-Policy "strict-origin-when-cross-origin" always;
       
       # Proxy to Node.js application
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
       
       # Limit file upload size
       client_max_body_size 10M;
   }
   ```

5. **Enable the site**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/warehouse-management /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. **Set up SSL with Let's Encrypt**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-warehouse-system-domain.com
   ```

## Step 4: Set Up Process Management

1. **Install PM2**:
   ```bash
   sudo npm install -g pm2
   ```

2. **Create PM2 configuration file** (ecosystem.config.js):
   ```javascript
   module.exports = {
     apps: [{
       name: "warehouse-management",
       script: "server/index.js",
       instances: "max",
       exec_mode: "cluster",
       watch: false,
       max_memory_restart: "1G",
       env: {
         NODE_ENV: "production"
       }
     }]
   };
   ```

3. **Start the application**:
   ```bash
   pm2 start ecosystem.config.js
   ```

4. **Enable startup script**:
   ```bash
   pm2 startup
   pm2 save
   ```

## Step 5: Monitoring and Maintenance

1. **Set up application monitoring**:
   - Consider using PM2 monitoring or a third-party APM service
   - Set up email alerts for high error rates or server issues

2. **Configure log rotation**:
   ```bash
   sudo apt install logrotate
   ```
   Create `/etc/logrotate.d/pm2`:
   ```
   /home/username/.pm2/logs/*.log {
       daily
       missingok
       rotate 7
       compress
       delaycompress
       notifempty
       create 0640 username username
   }
   ```

3. **Set up automated backups**:
   ```bash
   # PostgreSQL backup script
   pg_dump -U warehouse_user warehouse_management | gzip > /path/to/backups/warehouse_$(date +\%Y\%m\%d).sql.gz
   ```

4. **Configure regular security updates**:
   ```bash
   # Add to crontab for weekly updates
   0 0 * * 0 apt update && apt upgrade -y
   ```

## Step 6: Secure Database Maintenance

1. **Create database backup schedule**:
   ```bash
   # Add to crontab for daily backups
   0 1 * * * pg_dump -U warehouse_user warehouse_management | gzip > /path/to/backups/warehouse_$(date +\%Y\%m\%d).sql.gz
   ```

2. **Test database recovery process**:
   ```bash
   gunzip -c /path/to/backups/warehouse_20250401.sql.gz | psql -U warehouse_user warehouse_management
   ```

3. **Set up database health monitoring**:
   - Consider using pgAdmin, pg_stat_statements, or a dedicated monitoring tool

## Step 7: Final Security Checks

1. **Run a security scan** using tools like:
   - OWASP ZAP
   - Nikto
   - Nmap for open ports

2. **Perform penetration testing**:
   - Test authentication bypass
   - Check for SQL injection
   - Test for XSS vulnerabilities

3. **Create and document a security incident response plan**

## Additional Security Recommendations

1. **Consider implementing a Web Application Firewall (WAF)**
   - AWS WAF
   - Cloudflare
   - ModSecurity with Nginx

2. **Regular security audits**:
   - Automated vulnerability scanning
   - Manual code review
   - Dependency checking with `npm audit`

3. **User access management**:
   - Periodic review of user accounts
   - Password rotation policies
   - Two-factor authentication (future enhancement)