const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db, dbHelpers } = require('../database/init');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Email transporter setup
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Admin access token required'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.adminId) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin token'
            });
        }
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired admin token'
        });
    }
};

// Get admin dashboard data
router.get('/dashboard', verifyAdminToken, async (req, res) => {
    try {
        // Get total users
        const totalUsers = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // Get total investments
        const totalInvestments = await new Promise((resolve, reject) => {
            db.get(`
                SELECT
                    SUM(total_deposited) as total_deposited,
                    SUM(current_balance) as total_balance,
                    SUM(current_profit) as total_profit
                FROM user_investments
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Get pending withdrawals
        const pendingWithdrawals = await new Promise((resolve, reject) => {
            db.all(`
                SELECT wr.*, u.first_name, u.last_name, u.email
                FROM withdrawal_requests wr
                JOIN users u ON wr.user_id = u.id
                WHERE wr.status = 'pending'
                ORDER BY wr.requested_at DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Get recent transactions
        const recentTransactions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT t.*, u.first_name, u.last_name, u.email
                FROM transactions t
                JOIN users u ON t.user_id = u.id
                ORDER BY t.created_at DESC
                LIMIT 10
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json({
            success: true,
            data: {
                stats: {
                    totalUsers,
                    totalDeposited: totalInvestments?.total_deposited || 0,
                    totalBalance: totalInvestments?.total_balance || 0,
                    totalProfit: totalInvestments?.total_profit || 0,
                    pendingWithdrawalsCount: pendingWithdrawals.length
                },
                pendingWithdrawals,
                recentTransactions
            }
        });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load admin dashboard',
            error: error.message
        });
    }
});

// Get all users with pagination
router.get('/users', verifyAdminToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        let whereClause = '';
        let params = [];

        if (search) {
            whereClause = `WHERE u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?`;
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }

        const users = await new Promise((resolve, reject) => {
            db.all(`
                SELECT
                    u.*,
                    ui.initial_deposit,
                    ui.monthly_topup,
                    ui.total_deposited,
                    ui.current_profit,
                    ui.target_cash,
                    ui.current_balance,
                    ui.progress_percentage
                FROM users u
                LEFT JOIN user_investments ui ON u.id = ui.user_id
                ${whereClause}
                ORDER BY u.created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Get total count
        const totalCount = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as count FROM users u ${whereClause}
            `, params, (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load users',
            error: error.message
        });
    }
});

// Update user investment details
router.put('/users/:userId/investment', [
    verifyAdminToken,
    body('initialDeposit').optional().isFloat({ min: 0 }),
    body('monthlyTopup').optional().isFloat({ min: 0 }),
    body('currentProfit').optional().isFloat({ min: 0 }),
    body('targetCash').optional().isFloat({ min: 0 }),
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

        const userId = req.params.userId;
        const { initialDeposit, monthlyTopup, currentProfit, targetCash } = req.body;

        // Check if user exists
        const user = await dbHelpers.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get current investment data
        const currentInvestment = await new Promise((resolve, reject) => {
            db.get(`
                SELECT * FROM user_investments WHERE user_id = ?
            `, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Calculate new values
        const newInitialDeposit = initialDeposit !== undefined ? initialDeposit : (currentInvestment?.initial_deposit || 0);
        const newMonthlyTopup = monthlyTopup !== undefined ? monthlyTopup : (currentInvestment?.monthly_topup || 0);
        const newCurrentProfit = currentProfit !== undefined ? currentProfit : (currentInvestment?.current_profit || 0);
        const newTargetCash = targetCash !== undefined ? targetCash : (currentInvestment?.target_cash || 500000);

        const totalDeposited = newInitialDeposit + newMonthlyTopup;
        const currentBalance = totalDeposited + newCurrentProfit;
        const progressPercentage = newTargetCash > 0 ? Math.min((currentBalance / newTargetCash) * 100, 100) : 0;

        // Update or insert investment record
        if (currentInvestment) {
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE user_investments
                    SET initial_deposit = ?, monthly_topup = ?, total_deposited = ?,
                        current_profit = ?, target_cash = ?, current_balance = ?,
                        progress_percentage = ?, last_updated = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                `, [newInitialDeposit, newMonthlyTopup, totalDeposited, newCurrentProfit,
                    newTargetCash, currentBalance, progressPercentage, userId], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } else {
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO user_investments
                    (user_id, initial_deposit, monthly_topup, total_deposited,
                     current_profit, target_cash, current_balance, progress_percentage)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [userId, newInitialDeposit, newMonthlyTopup, totalDeposited,
                    newCurrentProfit, newTargetCash, currentBalance, progressPercentage], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        // Log activity
        await dbHelpers.logActivity({
            adminId: req.admin.adminId,
            userId: parseInt(userId),
            action: 'investment_update',
            description: `Admin updated investment details for user ${user.email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: 'Investment details updated successfully',
            data: {
                initialDeposit: newInitialDeposit,
                monthlyTopup: newMonthlyTopup,
                totalDeposited,
                currentProfit: newCurrentProfit,
                targetCash: newTargetCash,
                currentBalance,
                progressPercentage: Math.round(progressPercentage * 100) / 100
            }
        });

    } catch (error) {
        console.error('Update investment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update investment details',
            error: error.message
        });
    }
});

// Add transaction for user
router.post('/users/:userId/transactions', [
    verifyAdminToken,
    body('type').isIn(['deposit', 'withdrawal', 'profit', 'topup']).withMessage('Invalid transaction type'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('description').optional().trim(),
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

        const userId = req.params.userId;
        const { type, amount, description, transactionHash } = req.body;

        // Check if user exists
        const user = await dbHelpers.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Add transaction
        const transactionId = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO transactions
                (user_id, transaction_type, amount, description, transaction_hash,
                 status, processed_by, processed_at)
                VALUES (?, ?, ?, ?, ?, 'confirmed', ?, CURRENT_TIMESTAMP)
            `, [userId, type, amount, description || `Admin added ${type}`,
                transactionHash || null, req.admin.adminId], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });

        // Log activity
        await dbHelpers.logActivity({
            adminId: req.admin.adminId,
            userId: parseInt(userId),
            action: 'transaction_added',
            description: `Admin added ${type} transaction: $${amount} for user ${user.email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: 'Transaction added successfully',
            transactionId
        });

    } catch (error) {
        console.error('Add transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add transaction',
            error: error.message
        });
    }
});

// Process withdrawal request
router.put('/withdrawals/:requestId', [
    verifyAdminToken,
    body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
    body('reason').optional().trim(),
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

        const requestId = req.params.requestId;
        const { action, reason, transactionHash } = req.body;

        // Get withdrawal request
        const withdrawal = await new Promise((resolve, reject) => {
            db.get(`
                SELECT wr.*, u.first_name, u.last_name, u.email
                FROM withdrawal_requests wr
                JOIN users u ON wr.user_id = u.id
                WHERE wr.id = ?
            `, [requestId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!withdrawal) {
            return res.status(404).json({
                success: false,
                message: 'Withdrawal request not found'
            });
        }

        if (withdrawal.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Withdrawal request has already been processed'
            });
        }

        let receiptUrl = null;

        if (action === 'approve') {
            // Generate withdrawal receipt
            receiptUrl = await generateWithdrawalReceipt(withdrawal, transactionHash);

            // Update user balance
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE user_investments
                    SET current_balance = current_balance - ?,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                `, [withdrawal.amount, withdrawal.user_id], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Add withdrawal transaction
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO transactions
                    (user_id, transaction_type, amount, description, transaction_hash,
                     status, processed_by, processed_at, receipt_url)
                    VALUES (?, 'withdrawal', ?, ?, ?, 'confirmed', ?, CURRENT_TIMESTAMP, ?)
                `, [withdrawal.user_id, withdrawal.amount,
                    `Withdrawal to ${withdrawal.withdrawal_address}`,
                    transactionHash || null, req.admin.adminId, receiptUrl], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        // Update withdrawal request
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE withdrawal_requests
                SET status = ?, reason = ?, receipt_url = ?,
                    processed_by = ?, processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [action === 'approve' ? 'completed' : 'rejected',
                reason || null, receiptUrl, req.admin.adminId, requestId], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        // Log activity
        await dbHelpers.logActivity({
            adminId: req.admin.adminId,
            userId: withdrawal.user_id,
            action: `withdrawal_${action}`,
            description: `Admin ${action}d withdrawal request: $${withdrawal.amount} for user ${withdrawal.email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: `Withdrawal request ${action}d successfully`,
            receiptUrl
        });

    } catch (error) {
        console.error('Process withdrawal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process withdrawal request',
            error: error.message
        });
    }
});

// Generate withdrawal receipt
async function generateWithdrawalReceipt(withdrawal, transactionHash) {
    try {
        const receiptData = {
            receiptId: `WR-${withdrawal.id}-${Date.now()}`,
            date: new Date().toISOString(),
            userEmail: withdrawal.email,
            userName: `${withdrawal.first_name} ${withdrawal.last_name}`,
            amount: withdrawal.amount,
            withdrawalAddress: withdrawal.withdrawal_address,
            transactionHash: transactionHash || 'N/A',
            status: 'Completed'
        };

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '..', 'uploads', 'receipts');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Generate simple text receipt (in production, use PDF generation)
        const receiptContent = `
MPI® STRATEGY - WITHDRAWAL RECEIPT
================================

Receipt ID: ${receiptData.receiptId}
Date: ${new Date(receiptData.date).toLocaleString()}
User: ${receiptData.userName}
Email: ${receiptData.userEmail}

WITHDRAWAL DETAILS:
Amount: $${receiptData.amount}
Withdrawal Address: ${receiptData.withdrawalAddress}
Transaction Hash: ${receiptData.transactionHash}
Status: ${receiptData.status}

This receipt confirms that your withdrawal request has been processed successfully.

Thank you for using MPI® Strategy.
        `;

        const fileName = `receipt_${receiptData.receiptId}.txt`;
        const filePath = path.join(uploadsDir, fileName);

        fs.writeFileSync(filePath, receiptContent);

        return `/uploads/receipts/${fileName}`;

    } catch (error) {
        console.error('Receipt generation error:', error);
        return null;
    }
}

// Get system statistics
router.get('/stats', verifyAdminToken, async (req, res) => {
    try {
        const stats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM users WHERE created_at >= date('now', '-30 days')) as new_users_month,
                    (SELECT SUM(total_deposited) FROM user_investments) as total_deposited,
                    (SELECT SUM(current_balance) FROM user_investments) as total_balance,
                    (SELECT SUM(current_profit) FROM user_investments) as total_profit,
                    (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending') as pending_withdrawals,
                    (SELECT COUNT(*) FROM transactions WHERE created_at >= date('now', '-7 days')) as transactions_week
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load statistics',
            error: error.message
        });
    }
});

// Send deposit slip to user
router.post('/users/:userId/send-deposit-slip', [
    verifyAdminToken,
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('transactionType').isIn(['deposit', 'topup']).withMessage('Invalid transaction type'),
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

        const userId = req.params.userId;
        const { amount, transactionType, description } = req.body;

        // Get user data
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

        // Generate deposit slip
        const depositSlip = await generateDepositSlip(user, investment, amount, transactionType);

        // Send email with deposit slip
        const emailSent = await sendDepositSlipEmail(user, depositSlip, amount, transactionType);

        if (emailSent) {
            // Log activity
            await dbHelpers.logActivity({
                adminId: req.admin.adminId,
                userId: parseInt(userId),
                action: 'deposit_slip_sent',
                description: `Admin sent deposit slip for ${transactionType}: $${amount} to user ${user.email}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.json({
                success: true,
                message: 'Deposit slip sent successfully to user email'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send deposit slip email'
            });
        }

    } catch (error) {
        console.error('Send deposit slip error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send deposit slip',
            error: error.message
        });
    }
});

// Send investment summary to user
router.post('/users/:userId/send-summary', verifyAdminToken, async (req, res) => {
    try {
        const userId = req.params.userId;

        // Get user data
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

        // Send investment summary email
        const emailSent = await sendInvestmentSummaryEmail(user, investment, transactions);

        if (emailSent) {
            // Log activity
            await dbHelpers.logActivity({
                adminId: req.admin.adminId,
                userId: parseInt(userId),
                action: 'summary_sent',
                description: `Admin sent investment summary to user ${user.email}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.json({
                success: true,
                message: 'Investment summary sent successfully to user email'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send investment summary email'
            });
        }

    } catch (error) {
        console.error('Send summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send investment summary',
            error: error.message
        });
    }
});

// Generate deposit slip
async function generateDepositSlip(user, investment, amount, transactionType) {
    const currentDate = new Date().toLocaleDateString();
    const slipId = `DS-${Date.now()}`;

    // Calculate new totals
    const currentDeposited = investment?.total_deposited || 0;
    const newTotalDeposited = currentDeposited + parseFloat(amount);
    const currentProfit = investment?.current_profit || 0;
    const newBalance = newTotalDeposited + currentProfit;
    const targetCash = investment?.target_cash || 500000;
    const progressPercentage = (newBalance / targetCash) * 100;

    return {
        slipId,
        date: currentDate,
        userName: `${user.first_name} ${user.last_name}`,
        userEmail: user.email,
        transactionType: transactionType.toUpperCase(),
        amount: parseFloat(amount),
        previousDeposited: currentDeposited,
        newTotalDeposited,
        currentProfit,
        newBalance,
        targetCash,
        progressPercentage: Math.min(progressPercentage, 100)
    };
}

// Send deposit slip email
async function sendDepositSlipEmail(user, depositSlip, amount, transactionType) {
    try {
        const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #ffcc00 0%, #ffd700 100%); padding: 20px; text-align: center; color: #333; }
        .content { padding: 30px; background: #fff; }
        .slip-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .amount { font-size: 2rem; font-weight: bold; color: #ffcc00; text-align: center; margin: 20px 0; }
        .footer { background: #333; color: #fff; padding: 20px; text-align: center; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>MPI® Strategy Deposit Slip</h1>
        <p>Secure Compound Interest Account™</p>
    </div>

    <div class="content">
        <h2>Dear ${depositSlip.userName},</h2>
        <p>Your ${depositSlip.transactionType.toLowerCase()} has been processed successfully.</p>

        <div class="slip-details">
            <h3>Transaction Details</h3>
            <table class="table">
                <tr><th>Slip ID:</th><td>${depositSlip.slipId}</td></tr>
                <tr><th>Date:</th><td>${depositSlip.date}</td></tr>
                <tr><th>Transaction Type:</th><td>${depositSlip.transactionType}</td></tr>
                <tr><th>Amount:</th><td>$${depositSlip.amount.toLocaleString()}</td></tr>
            </table>
        </div>

        <div class="amount">$${depositSlip.amount.toLocaleString()}</div>

        <div class="slip-details">
            <h3>Account Summary</h3>
            <table class="table">
                <tr><th>Previous Total Deposited:</th><td>$${depositSlip.previousDeposited.toLocaleString()}</td></tr>
                <tr><th>New Total Deposited:</th><td>$${depositSlip.newTotalDeposited.toLocaleString()}</td></tr>
                <tr><th>Current Profit:</th><td>$${depositSlip.currentProfit.toLocaleString()}</td></tr>
                <tr><th>New Account Balance:</th><td><strong>$${depositSlip.newBalance.toLocaleString()}</strong></td></tr>
                <tr><th>Target Goal:</th><td>$${depositSlip.targetCash.toLocaleString()}</td></tr>
                <tr><th>Progress:</th><td><strong>${depositSlip.progressPercentage.toFixed(2)}%</strong></td></tr>
            </table>
        </div>

        <p>Thank you for choosing MPI® Strategy for your financial future. Your investment is working hard to build your secure compound interest growth.</p>

        <p>If you have any questions, please contact us at:</p>
        <ul>
            <li>Email: ${process.env.CONTACT_EMAIL}</li>
            <li>Phone: ${process.env.CONTACT_PHONE}</li>
        </ul>
    </div>

    <div class="footer">
        <p>&copy; 2024 MPI® UNLIMITED LLC. All Rights Reserved.</p>
        <p>This is an automated message. Please do not reply to this email.</p>
    </div>
</body>
</html>
        `;

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: user.email,
            subject: `MPI® Strategy - ${transactionType.toUpperCase()} Confirmation - $${amount.toLocaleString()}`,
            html: emailContent
        };

        await emailTransporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
}

// Send investment summary email
async function sendInvestmentSummaryEmail(user, investment, transactions) {
    try {
        const currentDate = new Date().toLocaleDateString();

        const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #ffcc00 0%, #ffd700 100%); padding: 20px; text-align: center; color: #333; }
        .content { padding: 30px; background: #fff; }
        .summary-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .balance { font-size: 2.5rem; font-weight: bold; color: #ffcc00; text-align: center; margin: 20px 0; }
        .footer { background: #333; color: #fff; padding: 20px; text-align: center; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background: #f8f9fa; }
        .progress-bar { background: #e0e0e0; height: 20px; border-radius: 10px; margin: 10px 0; }
        .progress-fill { background: linear-gradient(90deg, #ffcc00, #ffd700); height: 100%; border-radius: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>MPI® Strategy Investment Summary</h1>
        <p>Your Secure Compound Interest Account™ Report</p>
    </div>

    <div class="content">
        <h2>Dear ${user.first_name} ${user.last_name},</h2>
        <p>Here's your current investment summary as of ${currentDate}:</p>

        <div class="balance">$${(investment?.current_balance || 0).toLocaleString()}</div>
        <p style="text-align: center; font-size: 1.2rem; color: #666;">Current Account Balance</p>

        <div class="summary-box">
            <h3>Investment Overview</h3>
            <table class="table">
                <tr><th>Initial Deposit:</th><td>$${(investment?.initial_deposit || 0).toLocaleString()}</td></tr>
                <tr><th>Monthly Top-ups:</th><td>$${(investment?.monthly_topup || 0).toLocaleString()}</td></tr>
                <tr><th>Total Deposited:</th><td>$${(investment?.total_deposited || 0).toLocaleString()}</td></tr>
                <tr><th>Current Profit:</th><td style="color: #28a745;"><strong>$${(investment?.current_profit || 0).toLocaleString()}</strong></td></tr>
                <tr><th>Target Goal:</th><td>$${(investment?.target_cash || 500000).toLocaleString()}</td></tr>
            </table>
        </div>

        <div class="summary-box">
            <h3>Progress to Goal</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(investment?.progress_percentage || 0, 100)}%;"></div>
            </div>
            <p style="text-align: center; font-weight: bold;">${(investment?.progress_percentage || 0).toFixed(2)}% Complete</p>
        </div>

        ${transactions.length > 0 ? `
        <div class="summary-box">
            <h3>Recent Transactions</h3>
            <table class="table">
                <tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr>
                ${transactions.slice(0, 5).map(tx => `
                    <tr>
                        <td>${new Date(tx.created_at).toLocaleDateString()}</td>
                        <td>${tx.transaction_type.toUpperCase()}</td>
                        <td>$${parseFloat(tx.amount).toLocaleString()}</td>
                        <td>${tx.status.toUpperCase()}</td>
                    </tr>
                `).join('')}
            </table>
        </div>
        ` : ''}

        <p>Your MPI® Strategy is working to build your financial future through secure compound interest growth. Keep up the great work!</p>

        <p>For questions or to schedule a consultation:</p>
        <ul>
            <li>Email: ${process.env.CONTACT_EMAIL}</li>
            <li>Phone: ${process.env.CONTACT_PHONE}</li>
        </ul>
    </div>

    <div class="footer">
        <p>&copy; 2024 MPI® UNLIMITED LLC. All Rights Reserved.</p>
        <p>This is an automated message. Please do not reply to this email.</p>
    </div>
</body>
</html>
        `;

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: user.email,
            subject: `MPI® Strategy - Investment Summary - ${currentDate}`,
            html: emailContent
        };

        await emailTransporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
}

module.exports = router;
