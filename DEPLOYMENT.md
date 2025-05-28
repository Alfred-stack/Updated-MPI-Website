# MPI Strategy - Deployment Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup environment:**
   ```bash
   npm run setup
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

## Production Deployment

### Using PM2 (Recommended)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Using Docker
```bash
docker-compose up -d
```

### Manual Deployment
```bash
chmod +x start.sh
./start.sh
```

## Admin Access
- URL: http://localhost:3000/admin
- Username: mpi_admin
- Password: MPI@Admin2024!Secure

## User Registration
Users can register and login through the web interface at:
- Registration: http://localhost:3000/register
- Login: http://localhost:3000/login

## Bitcoin Wallet
- Address: 1DhLUp1pkeitZremqKu8fA2BdB9zqZ21QC

## Environment Variables
Make sure to set all required environment variables in your .env file.

## Security Notes
- Change default admin password in production
- Use HTTPS in production
- Set strong JWT secrets
- Configure proper firewall rules
- Regular database backups
