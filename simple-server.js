// Unified MPI Strategy Server - Handles both User and Admin Authentication
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3003;

console.log('🚀 Starting MPI Strategy Unified Server...');
console.log('🔍 Environment Variables:');
console.log('PORT:', process.env.PORT || '3003 (default)');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not Set');
console.log('ADMIN_USERNAME:', process.env.ADMIN_USERNAME || '❌ Not Set');
console.log('BITCOIN_WALLET_ADDRESS:', process.env.BITCOIN_WALLET_ADDRESS || '❌ Not Set');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Files
app.use(express.static(__dirname));
app.use('/receipts', express.static(path.join(__dirname, 'receipts')));

// Initialize database and add routes
const { initializeDatabase } = require('./database/init');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

// Initialize database
initializeDatabase().then(() => {
    console.log('✅ Database initialized successfully');
}).catch(err => {
    console.error('❌ Database initialization error:', err.message);
    process.exit(1);
});

// Frontend Routes - Define these BEFORE API routes to avoid conflicts
app.get('/', (req, res) => {
    console.log('📄 Serving index.html');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    console.log('📄 Serving login.html');
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register', (req, res) => {
    console.log('📄 Serving register.html');
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/dashboard', (req, res) => {
    console.log('📄 Serving dashboard.html');
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/admin', (req, res) => {
    console.log('📄 Serving admin.html');
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('🏥 Health check requested');
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        server: 'MPI Strategy Unified Server'
    });
});

// Admin login route (direct route for admin panel)
app.post('/admin/login', async (req, res) => {
    console.log('📄 Admin login attempt via /admin/login');
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Forward to the auth route
        const authRoutes = require('./routes/auth');
        const mockReq = {
            body: { username, password },
            ip: req.ip,
            get: (header) => req.get(header)
        };

        const mockRes = {
            status: (code) => ({
                json: (data) => res.status(code).json(data)
            }),
            json: (data) => res.json(data)
        };

        // Use the existing admin login logic from auth routes
        const bcrypt = require('bcryptjs');
        const jwt = require('jsonwebtoken');
        const { dbHelpers } = require('./database/init');

        // Get admin user
        const admin = await dbHelpers.getAdminByUsername(username);
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Check if admin is active
        if (!admin.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Admin account is deactivated'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Update last login
        const { db } = require('./database/init');
        db.run('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);

        // Log activity
        await dbHelpers.logActivity({
            adminId: admin.id,
            action: 'admin_login',
            description: `Admin logged in: ${username}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Generate JWT token
        const token = jwt.sign(
            { adminId: admin.id, username: admin.username, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            message: 'Admin login successful',
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Admin login failed',
            error: error.message
        });
    }
});

// API Routes - Define these AFTER frontend routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler - This should be the LAST middleware
app.use((req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.url}`
    });
});

// Start Server
const server = app.listen(PORT, () => {
    console.log('');
    console.log('🎉 MPI Strategy Server Successfully Started!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🌐 Main Website:     http://localhost:${PORT}`);
    console.log(`👤 User Login:       http://localhost:${PORT}/login`);
    console.log(`📝 User Registration: http://localhost:${PORT}/register`);
    console.log(`📊 User Dashboard:   http://localhost:${PORT}/dashboard`);
    console.log(`👨‍💼 Admin Panel:      http://localhost:${PORT}/admin`);
    console.log(`🏥 Health Check:     http://localhost:${PORT}/health`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📋 Login Credentials:');
    console.log('👤 Users: Register new accounts or use existing credentials');
    console.log('👨‍💼 Admin: Username: mpi_admin | Password: MPI@Admin2024!Secure');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
