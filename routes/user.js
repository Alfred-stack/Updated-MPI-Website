const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db, dbHelpers } = require('../database/init');
const QRCode = require('qrcode');
const router = express.Router();

// Middleware to verify user token
const verifyUserToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.userId) {
            return res.status(401).json({
                success: false,
                message: 'Invalid user token'
            });
        }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

// Get user dashboard data
router.get('/dashboard', verifyUserToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get user info
        const user = await dbHelpers.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get investment data
        const investment = await new Promise((resolve, reject) => {
            db.get(`
                SELECT * FROM user_investments WHERE user_id = ?
            `, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Get recent transactions
        const transactions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM transactions 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 10
            `, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Calculate progress percentage
        let progressPercentage = 0;
        if (investment && investment.target_cash > 0) {
            progressPercentage = Math.min(
                (investment.current_balance / investment.target_cash) * 100,
                100
            );
        }

        // Update progress percentage in database
        if (investment) {
            db.run(`
                UPDATE user_investments 
                SET progress_percentage = ?, last_updated = CURRENT_TIMESTAMP 
                WHERE user_id = ?
            `, [progressPercentage, userId]);
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    email: user.email,
                    memberSince: user.created_at
                },
                investment: investment || {
                    initial_deposit: 0,
                    monthly_topup: 0,
                    total_deposited: 0,
                    current_profit: 0,
                    target_cash: 500000,
                    current_balance: 0,
                    progress_percentage: 0
                },
                transactions,
                progressPercentage: Math.round(progressPercentage * 100) / 100
            }
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load dashboard data',
            error: error.message
        });
    }
});

// Get Bitcoin deposit address and QR code
router.get('/deposit-info', verifyUserToken, async (req, res) => {
    try {
        const bitcoinAddress = process.env.BITCOIN_WALLET_ADDRESS;
        
        // Generate QR code for the Bitcoin address
        const qrCodeDataURL = await QRCode.toDataURL(bitcoinAddress, {
            width: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        res.json({
            success: true,
            data: {
                bitcoinAddress,
                qrCode: qrCodeDataURL,
                instructions: [
                    'Send your Bitcoin deposit to the address above',
                    'Minimum deposit: $100 USD equivalent',
                    'Deposits are processed within 24 hours',
                    'Contact support if you need assistance'
                ]
            }
        });

    } catch (error) {
        console.error('Deposit info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate deposit information',
            error: error.message
        });
    }
});

// Submit withdrawal request
router.post('/withdraw', [
    verifyUserToken,
    body('amount').isFloat({ min: 50 }).withMessage('Minimum withdrawal amount is $50'),
    body('withdrawalAddress').notEmpty().withMessage('Withdrawal address is required'),
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

        const userId = req.user.userId;
        const { amount, withdrawalAddress, reason } = req.body;

        // Get user's current balance
        const investment = await new Promise((resolve, reject) => {
            db.get(`
                SELECT current_balance FROM user_investments WHERE user_id = ?
            `, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!investment || investment.current_balance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance for withdrawal'
            });
        }

        // Create withdrawal request
        const requestId = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO withdrawal_requests 
                (user_id, amount, withdrawal_address, reason)
                VALUES (?, ?, ?, ?)
            `, [userId, amount, withdrawalAddress, reason || 'User withdrawal request'], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });

        // Log activity
        await dbHelpers.logActivity({
            userId,
            action: 'withdrawal_request',
            description: `Withdrawal request submitted: $${amount}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            requestId,
            data: {
                amount,
                withdrawalAddress,
                status: 'pending',
                submittedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit withdrawal request',
            error: error.message
        });
    }
});

// Get user's withdrawal requests
router.get('/withdrawals', verifyUserToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const withdrawals = await new Promise((resolve, reject) => {
            db.all(`
                SELECT wr.*, au.username as processed_by_username
                FROM withdrawal_requests wr
                LEFT JOIN admin_users au ON wr.processed_by = au.id
                WHERE wr.user_id = ?
                ORDER BY wr.requested_at DESC
            `, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json({
            success: true,
            data: withdrawals
        });

    } catch (error) {
        console.error('Get withdrawals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load withdrawal requests',
            error: error.message
        });
    }
});

// Get user's transaction history
router.get('/transactions', verifyUserToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const transactions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT t.*, au.username as processed_by_username
                FROM transactions t
                LEFT JOIN admin_users au ON t.processed_by = au.id
                WHERE t.user_id = ?
                ORDER BY t.created_at DESC
                LIMIT ? OFFSET ?
            `, [userId, limit, offset], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Get total count
        const totalCount = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as count FROM transactions WHERE user_id = ?
            `, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        res.json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load transaction history',
            error: error.message
        });
    }
});

// Update user profile
router.put('/profile', [
    verifyUserToken,
    body('firstName').optional().trim().isLength({ min: 2 }),
    body('lastName').optional().trim().isLength({ min: 2 }),
    body('phone').optional().trim(),
    body('address').optional().trim(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const userId = req.user.userId;
        const { firstName, lastName, phone, address } = req.body;

        // Update user profile
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE users 
                SET first_name = COALESCE(?, first_name),
                    last_name = COALESCE(?, last_name),
                    phone = COALESCE(?, phone),
                    address = COALESCE(?, address),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [firstName, lastName, phone, address, userId], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        // Log activity
        await dbHelpers.logActivity({
            userId,
            action: 'profile_update',
            description: 'User updated profile information',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
});

module.exports = router;
