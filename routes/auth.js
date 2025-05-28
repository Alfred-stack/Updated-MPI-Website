const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { dbHelpers } = require('../database/init');
const router = express.Router();

// Register endpoint
router.post('/register', [
    body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
    body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { firstName, lastName, email, password } = req.body;

        // Check if user already exists
        const existingUser = await dbHelpers.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const userId = await dbHelpers.createUser({
            firstName,
            lastName,
            email,
            password: hashedPassword
        });

        // Create initial investment record
        const { db } = require('../database/init');
        db.run(`
            INSERT INTO user_investments (user_id, target_cash)
            VALUES (?, 500000.00)
        `, [userId]);

        // Log activity
        await dbHelpers.logActivity({
            userId,
            action: 'user_registration',
            description: `New user registered: ${email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Generate JWT token
        const token = jwt.sign(
            { userId, email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: userId,
                firstName,
                lastName,
                email
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: error.message
        });
    }
});

// Login endpoint
router.post('/login', [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // Get user
        const user = await dbHelpers.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if user is active
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact support.'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Log activity
        await dbHelpers.logActivity({
            userId: user.id,
            action: 'user_login',
            description: `User logged in: ${email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
});

// Admin login endpoint (alternative route)
router.post('/admin-login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { username, password } = req.body;

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
        const { db } = require('../database/init');
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

// Admin login endpoint (original route)
router.post('/admin/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { username, password } = req.body;

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
        const { db } = require('../database/init');
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

// Verify token endpoint
router.get('/verify', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'No token provided'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ensure the decoded token contains admin-specific fields
        if (decoded.adminId) {
            res.json({
                success: true,
                message: 'Token is valid',
                user: {
                    adminId: decoded.adminId,
                    username: decoded.username,
                    role: decoded.role
                }
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Invalid admin token'
            });
        }
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    // In a production app, you might want to blacklist the token
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

module.exports = router;
