# Setting Up HTTPS with Let's Encrypt on Windows

This guide provides detailed instructions for securing your Warehouse Management System with HTTPS using free SSL certificates from Let's Encrypt.

## Prerequisites

- Windows 10 or Windows 11
- Administrator access
- Your application running correctly on HTTP
- A domain name pointed to your server's IP address
- Port 80 and 443 forwarded to your server

## Installing NGINX

1. Download NGINX for Windows from [nginx.org](https://nginx.org/en/download.html)

2. Extract the ZIP file to `C:\nginx`

3. Open a Command Prompt as Administrator and start NGINX:
   ```
   cd C:\nginx
   start nginx
   ```

4. Verify NGINX is running by visiting http://localhost in your browser

## Installing Certbot for Windows

Let's Encrypt provides free SSL certificates via the Certbot client. On Windows, we'll use Certbot with the NGINX plugin.

1. Install Chocolatey (Windows package manager) if you don't have it:
   - Open PowerShell as Administrator
   - Run the following command:
     ```powershell
     Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
     ```

2. Install Certbot:
   ```
   choco install certbot
   ```

## Obtaining SSL Certificate

1. Stop NGINX if it's running:
   ```
   cd C:\nginx
   nginx -s stop
   ```

2. Run Certbot to obtain certificate and automatically configure NGINX:
   ```
   certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```
   - Replace `yourdomain.com` with your actual domain name
   - Follow the prompts to provide your email and agree to terms

3. Certbot will automatically modify your NGINX configuration to use the new certificates

4. Restart NGINX:
   ```
   cd C:\nginx
   start nginx
   ```

5. Test your site by visiting https://yourdomain.com

## Setting Up NGINX as a Reverse Proxy

Now configure NGINX to proxy requests to your Node.js application:

1. Edit the NGINX configuration file (`C:\nginx\conf\nginx.conf`):
   ```nginx
   worker_processes  1;

   events {
       worker_connections  1024;
   }

   http {
       include       mime.types;
       default_type  application/octet-stream;
       sendfile      on;
       keepalive_timeout  65;

       server {
           listen 80;
           server_name yourdomain.com www.yourdomain.com;
           
           # Redirect all HTTP traffic to HTTPS
           location / {
               return 301 https://$host$request_uri;
           }
       }

       server {
           listen 443 ssl;
           server_name yourdomain.com www.yourdomain.com;
           
           # SSL certificates added by Certbot
           ssl_certificate     C:/Certbot/live/yourdomain.com/fullchain.pem;
           ssl_certificate_key C:/Certbot/live/yourdomain.com/privkey.pem;
           
           # SSL protocols and ciphers
           ssl_protocols TLSv1.2 TLSv1.3;
           ssl_prefer_server_ciphers on;
           ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
           
           # HSTS (optional but recommended)
           add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
           
           # Other security headers
           add_header X-Content-Type-Options nosniff;
           add_header X-Frame-Options SAMEORIGIN;
           add_header X-XSS-Protection "1; mode=block";
           
           # Proxy to Node.js application
           location / {
               proxy_pass http://localhost:5000;
               proxy_http_version 1.1;
               proxy_set_header Upgrade $http_upgrade;
               proxy_set_header Connection 'upgrade';
               proxy_set_header Host $host;
               proxy_cache_bypass $http_upgrade;
               proxy_set_header X-Real-IP $remote_addr;
               proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
               proxy_set_header X-Forwarded-Proto $scheme;
           }
       }
   }
   ```

2. Replace `yourdomain.com` with your actual domain name throughout the file

3. Check NGINX configuration for errors:
   ```
   cd C:\nginx
   nginx -t
   ```

4. If the test is successful, reload NGINX:
   ```
   nginx -s reload
   ```

## Certificate Auto-Renewal

Let's Encrypt certificates expire after 90 days. Set up automatic renewal:

1. Create a batch file (`C:\scripts\renew-cert.bat`) with the following content:
   ```batch
   @echo off
   certbot renew
   cd C:\nginx
   nginx -s reload
   ```

2. Open Task Scheduler:
   - Click Start, type "Task Scheduler" and open it
   - Click "Create Basic Task"
   - Name: "Let's Encrypt Certificate Renewal"
   - Trigger: Weekly (select a day and time)
   - Action: Start a program
   - Program/script: `C:\scripts\renew-cert.bat`
   - Click Finish

## Troubleshooting

### Certificate Issues

- **Certificate not found**: Check the paths in your NGINX configuration match where Certbot stored them

- **Certificate renewal fails**: Ensure port 80 is accessible from the internet for domain verification

- **Verification fails**: Verify your domain points to your server's IP address

### NGINX Issues

- **502 Bad Gateway**: Your Node.js application may not be running. Check it's running on port 5000.

- **Connection refused**: Check your firewall settings allow NGINX to access port 5000

- **WebSocket issues**: Make sure the proxy_set_header Upgrade and Connection directives are configured correctly

## Additional Security Considerations

- Consider implementing rate limiting for sensitive endpoints:
  ```nginx
  http {
      limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;
      
      server {
          location /api/login {
              limit_req zone=login burst=5;
              proxy_pass http://localhost:5000/api/login;
              # other proxy settings...
          }
      }
  }
  ```

- Consider setting up a basic authentication for administrative areas:
  ```nginx
  location /admin {
      auth_basic "Administrator Area";
      auth_basic_user_file /path/to/.htpasswd;
      proxy_pass http://localhost:5000/admin;
      # other proxy settings...
  }
  ```

## Resources

- [NGINX Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/docs/)
- [SSL Configuration Generator](https://ssl-config.mozilla.org/)