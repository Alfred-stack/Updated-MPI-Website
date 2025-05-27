const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './database/mpi_database.db';

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
    }
});

// Initialize database tables
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Users table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    phone TEXT,
                    address TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    email_verified BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Admin users table
            db.run(`
                CREATE TABLE IF NOT EXISTS admin_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    role TEXT DEFAULT 'admin',
                    is_active BOOLEAN DEFAULT 1,
                    last_login DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // User investments table
            db.run(`
                CREATE TABLE IF NOT EXISTS user_investments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    initial_deposit DECIMAL(15,2) DEFAULT 0.00,
                    monthly_topup DECIMAL(15,2) DEFAULT 0.00,
                    total_deposited DECIMAL(15,2) DEFAULT 0.00,
                    current_profit DECIMAL(15,2) DEFAULT 0.00,
                    target_cash DECIMAL(15,2) DEFAULT 0.00,
                    current_balance DECIMAL(15,2) DEFAULT 0.00,
                    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
                    investment_start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `);

            // Transactions table
            db.run(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    transaction_type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'profit', 'topup'
                    amount DECIMAL(15,2) NOT NULL,
                    bitcoin_address TEXT,
                    transaction_hash TEXT,
                    status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
                    description TEXT,
                    receipt_url TEXT,
                    processed_by INTEGER, -- admin user id
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    processed_at DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (processed_by) REFERENCES admin_users (id)
                )
            `);

            // Withdrawal requests table
            db.run(`
                CREATE TABLE IF NOT EXISTS withdrawal_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    amount DECIMAL(15,2) NOT NULL,
                    withdrawal_address TEXT NOT NULL,
                    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
                    reason TEXT,
                    receipt_url TEXT,
                    processed_by INTEGER,
                    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    processed_at DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (processed_by) REFERENCES admin_users (id)
                )
            `);

            // System settings table
            db.run(`
                CREATE TABLE IF NOT EXISTS system_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    setting_key TEXT UNIQUE NOT NULL,
                    setting_value TEXT NOT NULL,
                    description TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Activity logs table
            db.run(`
                CREATE TABLE IF NOT EXISTS activity_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    admin_id INTEGER,
                    action TEXT NOT NULL,
                    description TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
                    FOREIGN KEY (admin_id) REFERENCES admin_users (id) ON DELETE SET NULL
                )
            `);

            // Create default admin user
            createDefaultAdmin();

            // Insert default system settings
            insertDefaultSettings();

            console.log('✅ Database tables initialized successfully');
            resolve();
        });
    });
}

// Create default admin user
function createDefaultAdmin() {
    const adminUsername = process.env.ADMIN_USERNAME || 'mpi_admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'MPI@Admin2024!Secure';
    const adminEmail = process.env.ADMIN_EMAIL || 'Mpisecuredcomparedinterest@gmail.com';

    bcrypt.hash(adminPassword, 12, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing admin password:', err);
            return;
        }

        db.run(`
            INSERT OR IGNORE INTO admin_users (username, email, password, role)
            VALUES (?, ?, ?, 'super_admin')
        `, [adminUsername, adminEmail, hashedPassword], function(err) {
            if (err) {
                console.error('Error creating admin user:', err);
            } else if (this.changes > 0) {
                console.log('✅ Default admin user created');
                console.log(`👨‍💼 Admin Username: ${adminUsername}`);
                console.log(`🔑 Admin Password: ${adminPassword}`);
            }
        });
    });
}

// Insert default system settings
function insertDefaultSettings() {
    const defaultSettings = [
        ['bitcoin_wallet_address', process.env.BITCOIN_WALLET_ADDRESS, 'Main Bitcoin wallet address for deposits'],
        ['minimum_deposit', '100.00', 'Minimum deposit amount in USD'],
        ['minimum_withdrawal', '50.00', 'Minimum withdrawal amount in USD'],
        ['default_profit_rate', '2.5', 'Default monthly profit rate percentage'],
        ['withdrawal_fee', '5.00', 'Withdrawal processing fee in USD'],
        ['app_maintenance', 'false', 'Application maintenance mode'],
        ['registration_enabled', 'true', 'Allow new user registrations']
    ];

    defaultSettings.forEach(([key, value, description]) => {
        db.run(`
            INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description)
            VALUES (?, ?, ?)
        `, [key, value, description]);
    });
}

// Database helper functions
const dbHelpers = {
    // Get user by email
    getUserByEmail: (email) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // Get user by ID
    getUserById: (id) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // Create new user
    createUser: (userData) => {
        return new Promise((resolve, reject) => {
            const { firstName, lastName, email, password } = userData;
            db.run(`
                INSERT INTO users (first_name, last_name, email, password)
                VALUES (?, ?, ?, ?)
            `, [firstName, lastName, email, password], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    },

    // Get admin by username
    getAdminByUsername: (username) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // Log activity
    logActivity: (data) => {
        return new Promise((resolve, reject) => {
            const { userId, adminId, action, description, ipAddress, userAgent } = data;
            db.run(`
                INSERT INTO activity_logs (user_id, admin_id, action, description, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [userId, adminId, action, description, ipAddress, userAgent], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }
};

module.exports = {
    db,
    initializeDatabase,
    dbHelpers
};
