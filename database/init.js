const Database = require('better-sqlite3');
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
const db = new Database(DB_PATH);
console.log('✅ Connected to SQLite database');

// Initialize database tables
function initializeDatabase() {
    try {
        // Users table
        db.exec(`
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
        db.exec(`
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
        db.exec(`
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
        db.exec(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                transaction_type TEXT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                bitcoin_address TEXT,
                transaction_hash TEXT,
                status TEXT DEFAULT 'pending',
                description TEXT,
                receipt_url TEXT,
                processed_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (processed_by) REFERENCES admin_users (id)
            )
        `);

        // Withdrawal requests table
        db.exec(`
            CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                withdrawal_address TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
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
        db.exec(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setting_key TEXT UNIQUE NOT NULL,
                setting_value TEXT NOT NULL,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Activity logs table
        db.exec(`
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
        return Promise.resolve();
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        return Promise.reject(error);
    }
}

// Create default admin user
function createDefaultAdmin() {
    const adminUsername = process.env.ADMIN_USERNAME || 'mpi_admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'MPI@Admin2024!Secure';
    const adminEmail = process.env.ADMIN_EMAIL || 'Mpisecuredcomparedinterest@gmail.com';

    try {
        const hashedPassword = bcrypt.hashSync(adminPassword, 12);

        const stmt = db.prepare(`
            INSERT OR IGNORE INTO admin_users (username, email, password, role)
            VALUES (?, ?, ?, 'super_admin')
        `);

        const result = stmt.run(adminUsername, adminEmail, hashedPassword);

        if (result.changes > 0) {
            console.log('✅ Default admin user created');
            console.log(`👨‍💼 Admin Username: ${adminUsername}`);
            console.log(`🔑 Admin Password: ${adminPassword}`);
        }
    } catch (err) {
        console.error('Error creating admin user:', err);
    }
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

    const stmt = db.prepare(`
        INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description)
        VALUES (?, ?, ?)
    `);

    defaultSettings.forEach(([key, value, description]) => {
        stmt.run(key, value, description);
    });
}

// Database helper functions
const dbHelpers = {
    // Get user by email
    getUserByEmail: (email) => {
        try {
            const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
            return Promise.resolve(stmt.get(email));
        } catch (err) {
            return Promise.reject(err);
        }
    },

    // Get user by ID
    getUserById: (id) => {
        try {
            const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
            return Promise.resolve(stmt.get(id));
        } catch (err) {
            return Promise.reject(err);
        }
    },

    // Create new user
    createUser: (userData) => {
        try {
            const { firstName, lastName, email, password } = userData;
            const stmt = db.prepare(`
                INSERT INTO users (first_name, last_name, email, password)
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(firstName, lastName, email, password);
            return Promise.resolve(result.lastInsertRowid);
        } catch (err) {
            return Promise.reject(err);
        }
    },

    // Get admin by username
    getAdminByUsername: (username) => {
        try {
            const stmt = db.prepare('SELECT * FROM admin_users WHERE username = ?');
            return Promise.resolve(stmt.get(username));
        } catch (err) {
            return Promise.reject(err);
        }
    },

    // Log activity
    logActivity: (data) => {
        try {
            const { userId, adminId, action, description, ipAddress, userAgent } = data;
            const stmt = db.prepare(`
                INSERT INTO activity_logs (user_id, admin_id, action, description, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(userId, adminId, action, description, ipAddress, userAgent);
            return Promise.resolve(result.lastInsertRowid);
        } catch (err) {
            return Promise.reject(err);
        }
    }
};

module.exports = {
    db,
    initializeDatabase,
    dbHelpers
};
