#!/usr/bin/env node

require('dotenv').config(); // <-- Ensure .env is loaded

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up MPI Strategy Web Application...\n');

// Check if .env file exists BEFORE initializing database
if (!fs.existsSync('.env')) {
    console.log('❌ .env file not found. Please create it with the required environment variables.');
    console.log('📝 Example .env file:');
    console.log(`
PORT=3000
NODE_ENV=production
DB_PATH=./database/mpi_database.db
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
ADMIN_USERNAME=mpi_admin
ADMIN_PASSWORD=MPI@Admin2024!Secure
BITCOIN_WALLET_ADDRESS=1DhLUp1pkeitZremqKu8fA2BdB9zqZ21QC
    `);
    process.exit(1);
}

// Create necessary directories
const directories = [
    'database',
    'uploads',
    'uploads/receipts',
    'logs'
];

directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
    }
});

// Initialize database
console.log('\n📊 Initializing database...');
try {
    const { initializeDatabase } = require('./database/init');
    initializeDatabase();
    console.log('✅ Database initialized successfully');
} catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
}

// Database initialization completed - no demo data created
console.log('\n✅ Database setup completed successfully!');

// Create production scripts
console.log('\n📜 Creating production scripts...');

// Create start script
const startScript = `#!/bin/bash
echo "🚀 Starting MPI Strategy Web Application..."
export NODE_ENV=production
node server.js
`;

fs.writeFileSync('start.sh', startScript);
fs.chmodSync('start.sh', '755');
console.log('✅ Created start.sh script');

// Create PM2 ecosystem file
const pm2Config = {
    apps: [{
        name: 'mpi-strategy',
        script: 'server.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        time: true
    }]
};

fs.writeFileSync('ecosystem.config.js', `module.exports = ${JSON.stringify(pm2Config, null, 2)};`);
console.log('✅ Created PM2 ecosystem.config.js');

// Create Docker files
console.log('\n🐳 Creating Docker configuration...');

const dockerfile = `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p database uploads logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/ || exit 1

# Start application
CMD ["npm", "start"]
`;

fs.writeFileSync('Dockerfile', dockerfile);
console.log('✅ Created Dockerfile');

const dockerCompose = `version: '3.8'

services:
  mpi-strategy:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./database:/app/database
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - mpi-strategy
    restart: unless-stopped
`;

fs.writeFileSync('docker-compose.yml', dockerCompose);
console.log('✅ Created docker-compose.yml');

// Create nginx configuration
const nginxConfig = `events {
    worker_connections 1024;
}

http {
    upstream mpi_backend {
        server mpi-strategy:3000;
    }

    server {
        listen 80;
        server_name localhost;

        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name localhost;

        # SSL Configuration (add your SSL certificates)
        # ssl_certificate /etc/nginx/ssl/cert.pem;
        # ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # Proxy to Node.js application
        location / {
            proxy_pass http://mpi_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Static files caching
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            proxy_pass http://mpi_backend;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
`;

fs.writeFileSync('nginx.conf', nginxConfig);
console.log('✅ Created nginx.conf');

// Create README for deployment
const deploymentReadme = `# MPI Strategy - Deployment Guide

## Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Setup environment:**
   \`\`\`bash
   npm run setup
   \`\`\`

3. **Start the application:**
   \`\`\`bash
   npm start
   \`\`\`

## Production Deployment

### Using PM2 (Recommended)
\`\`\`bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
\`\`\`

### Using Docker
\`\`\`bash
docker-compose up -d
\`\`\`

### Manual Deployment
\`\`\`bash
chmod +x start.sh
./start.sh
\`\`\`

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
`;

fs.writeFileSync('DEPLOYMENT.md', deploymentReadme);
console.log('✅ Created DEPLOYMENT.md');

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Install dependencies: npm install');
console.log('2. Start the application: npm start');
console.log('3. Access the application: http://localhost:3000');
console.log('4. Admin panel: http://localhost:3000/admin');
console.log('5. Register new users at: http://localhost:3000/register');
console.log('\n💰 Bitcoin Wallet: 1DhLUp1pkeitZremqKu8fA2BdB9zqZ21QC');
console.log('\n🔐 Admin Credentials:');
console.log('   Username: mpi_admin');
console.log('   Password: MPI@Admin2024!Secure');
console.log('\n✨ Your MPI Strategy Web Application is ready for production!');
