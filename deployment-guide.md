# Warehouse Management System: Deployment Guide

This guide will help you deploy your Warehouse Management System (WMS) to your own server or hosting provider.

## System Requirements

- Node.js (v16 or later)
- PostgreSQL database (v13 or later)
- npm package manager
- 1GB RAM minimum (2GB+ recommended)
- 20GB disk space recommended

## Deployment Options

### Option 1: Traditional Server Deployment

#### Step 1: Prepare Your Server
1. Install Node.js and npm
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. Install PostgreSQL
   ```bash
   sudo apt install postgresql postgresql-contrib
   ```

3. Create a database for your application
   ```bash
   sudo -u postgres psql
   CREATE DATABASE wms;
   CREATE USER wmsuser WITH ENCRYPTED PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE wms TO wmsuser;
   \q
   ```

4. Clone or upload your application files to the server

#### Step 2: Configure Your Application
1. Create a `.env` file in the root directory with your database connection details:
   ```
   DATABASE_URL=postgresql://wmsuser:your_password@localhost:5432/wms
   SESSION_SECRET=your_secure_session_secret
   PORT=5000
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Push the database schema
   ```bash
   npm run db:push
   ```

4. Build the application
   ```bash
   npm run build
   ```

#### Step 3: Run the Application
1. Start the application
   ```bash
   npm start
   ```

2. For production deployment, use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name wms
   pm2 save
   pm2 startup
   ```

### Option 2: Docker Deployment

#### Step 1: Create Docker Files
1. Create a `Dockerfile` in your project root:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

2. Create a `docker-compose.yml` file:
```yaml
version: '3'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://wmsuser:your_password@db:5432/wms
      - SESSION_SECRET=your_secure_session_secret
      - PORT=5000
    depends_on:
      - db
    restart: always

  db:
    image: postgres:14-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=your_password
      - POSTGRES_USER=wmsuser
      - POSTGRES_DB=wms
    restart: always

volumes:
  postgres_data:
```

#### Step 2: Build and Run with Docker
1. Install Docker and Docker Compose on your server

2. Build and start the services:
   ```bash
   docker-compose up -d
   ```

3. Initialize the database schema:
   ```bash
   docker-compose exec app npm run db:push
   ```

### Option 3: Cloud Platform Deployment

#### Heroku Deployment
1. Install the Heroku CLI and login:
   ```bash
   npm install -g heroku
   heroku login
   ```

2. Create a new Heroku app:
   ```bash
   heroku create your-wms-app
   ```

3. Add a PostgreSQL database:
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```

4. Set environment variables:
   ```bash
   heroku config:set SESSION_SECRET=your_secure_session_secret
   ```

5. Deploy your application:
   ```bash
   git push heroku main
   ```

6. Apply database schema:
   ```bash
   heroku run npm run db:push
   ```

#### Railway Deployment
1. Create a new project on [Railway](https://railway.app/)
2. Connect your GitHub repository
3. Add a PostgreSQL database from the Railway dashboard
4. Set the environment variables in the Railway dashboard
5. Deploy your application

## Post-Deployment Steps

1. **Create admin user**: The system automatically creates an admin user with:
   - Username: `admin`
   - Password: `admin123`
   - You should change this password immediately after first login

2. **Set up backups**: Configure regular database backups

3. **Set up SSL**: Configure SSL for secure connections:
   - With nginx, use Let's Encrypt for free SSL certificates
   - For cloud platforms, SSL is often provided automatically

4. **Configure monitoring**: Set up monitoring for your application:
   - Use services like New Relic, Datadog, or Sentry
   - Monitor server resources and application performance

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check if PostgreSQL is running
   - Verify DATABASE_URL is correct
   - Ensure database user has correct permissions

2. **Application Won't Start**
   - Check logs for errors: `npm run dev` or `docker-compose logs app`
   - Verify all dependencies are installed
   - Check if required ports are available

3. **Frontend Not Loading**
   - Verify the build process completed successfully
   - Check for JavaScript console errors in the browser
   - Ensure API endpoints are accessible

### Accessing Logs
- Standard deployment: Check stdout or configured log files
- PM2: `pm2 logs wms`
- Docker: `docker-compose logs -f app`
- Heroku: `heroku logs --tail`

## Updating the Application

1. **Pull the latest code**:
   ```bash
   git pull
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Apply database schema changes**:
   ```bash
   npm run db:push
   ```

4. **Rebuild and restart**:
   ```bash
   npm run build
   pm2 restart wms
   ```

## Security Recommendations

1. **Change default credentials**: Immediately change the default admin password
2. **Use strong passwords**: For all user accounts and database access
3. **Update regularly**: Keep Node.js, PostgreSQL, and npm packages updated
4. **Configure firewall**: Restrict access to your server
5. **Set up rate limiting**: To prevent brute-force attacks
6. **Enable HTTPS**: Never run in production without SSL/TLS

## Need Help?

If you encounter any issues with deployment that aren't covered in this guide, please contact our support team.