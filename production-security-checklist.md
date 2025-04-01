# Production Security Checklist

Use this checklist when preparing to deploy the Warehouse Management System to production.

## Environment Configuration

- [ ] Set `NODE_ENV=production` in your environment
- [ ] Generate a strong, unique `SESSION_SECRET` value (minimum 64 characters)
- [ ] Configure `APP_URL` with your production domain
- [ ] Set up `DATABASE_URL` with SSL enabled (`?sslmode=require`)
- [ ] Remove any testing or development credentials
- [ ] Store all sensitive environment variables securely (not in version control)
- [ ] Set proper file permissions for configuration files (600)

## Server Hardening

- [ ] Update all system packages
- [ ] Configure firewall to only allow necessary ports (80, 443, SSH)
- [ ] Disable root SSH login
- [ ] Enable SSH key authentication only
- [ ] Install and configure fail2ban
- [ ] Set up automatic security updates
- [ ] Use a non-root user to run the application
- [ ] Implement log rotation
- [ ] Run security audit tools (Lynis, OpenVAS)

## Database Security

- [ ] Create a dedicated database user with limited permissions
- [ ] Use a strong, unique database password
- [ ] Enable PostgreSQL SSL connections
- [ ] Configure database backup schedule
- [ ] Test database restore procedure
- [ ] Restrict database network access
- [ ] Set appropriate connection pool limits
- [ ] Implement database monitoring

## Web Server Configuration

- [ ] Use HTTPS with strong TLS configuration
- [ ] Configure TLS v1.2+ only (disable older TLS versions)
- [ ] Implement HTTPS redirects for all HTTP traffic
- [ ] Set up HSTS headers
- [ ] Configure secure cookie settings
- [ ] Set up a Web Application Firewall (WAF)
- [ ] Implement proper Content-Security-Policy headers
- [ ] Configure rate limiting for all endpoints
- [ ] Use Nginx/Apache as a reverse proxy
- [ ] Set appropriate file upload limits
- [ ] Configure compression for static assets
- [ ] Set up Browser-Cache-Control headers

## Application Security

- [ ] Change default admin credentials
- [ ] Remove unnecessary user accounts
- [ ] Verify all security middleware is enabled
- [ ] Test authentication and authorization flows
- [ ] Verify input validation on all forms
- [ ] Check for XSS vulnerabilities
- [ ] Ensure proper CSRF protection
- [ ] Validate file upload security
- [ ] Implement proper error handling
- [ ] Sanitize error messages in production
- [ ] Remove debug/development features
- [ ] Configure appropriate Content-Security-Policy

## Monitoring & Alerts

- [ ] Set up application monitoring
- [ ] Configure error alerting
- [ ] Implement performance monitoring
- [ ] Set up security incident alerting
- [ ] Monitor for unusual access patterns
- [ ] Configure CPU/memory/disk usage alerts
- [ ] Set up uptime monitoring
- [ ] Implement database query monitoring
- [ ] Set up API rate limit monitoring

## Backup & Recovery

- [ ] Set up automated database backups
- [ ] Configure file system backups
- [ ] Test restoration procedures
- [ ] Implement off-site backup storage
- [ ] Document emergency recovery procedures
- [ ] Set up point-in-time recovery capability
- [ ] Configure backup encryption
- [ ] Test disaster recovery plan

## Compliance & Documentation

- [ ] Document all security measures
- [ ] Create a security incident response plan
- [ ] Document user access control policies
- [ ] Verify compliance with relevant regulations (GDPR, etc.)
- [ ] Create data processing documentation
- [ ] Implement privacy policy
- [ ] Document data retention policies
- [ ] Create security update procedures

## Post-Deployment

- [ ] Run security scans on the live application
- [ ] Perform penetration testing
- [ ] Test all critical workflows
- [ ] Monitor error logs post-launch
- [ ] Verify error reporting works correctly
- [ ] Check database performance
- [ ] Test backup and restore procedures
- [ ] Verify all API rate limits work correctly
- [ ] Document any security findings
- [ ] Schedule regular security reviews

## Regular Maintenance

- [ ] Update dependencies monthly
- [ ] Run npm audit weekly
- [ ] Apply security patches promptly
- [ ] Review user accounts quarterly
- [ ] Test backup restoration quarterly
- [ ] Review security logs monthly
- [ ] Update SSL certificates before expiry
- [ ] Review server configurations quarterly
- [ ] Test disaster recovery annually
- [ ] Perform penetration testing annually