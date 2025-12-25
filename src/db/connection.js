/**
 * Database Connection Module
 * 
 * Handles SQLite database connection and initialization using sqlite3.
 * Creates tables if they don't exist.
 * Handles schema migrations for backward compatibility.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database instance (singleton)
let db = null;

/**
 * Get the database file path from environment or default
 * @returns {string} Absolute path to database file
 */
function getDatabasePath() {
    const dbPath = process.env.DATABASE_PATH || './data/trackit.db';
    return path.resolve(dbPath);
}

/**
 * Initialize the database connection and create tables
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
    if (db) {
        return;
    }

    const dbPath = getDatabasePath();

    // Ensure the data directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
        // Create database connection
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(err);
                return;
            }

            console.log(`📁 Database path: ${dbPath}`);

            // Enable foreign keys and create tables
            db.run('PRAGMA foreign_keys = ON', async (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                try {
                    await createTables();
                    await runMigrations();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    });
}

/**
 * Create all required database tables
 * Tables: users, tracked_products, subscriptions, price_history
 */
async function createTables() {
    // Users table with plan fields
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE NOT NULL,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            language_code TEXT DEFAULT 'en',
            plan TEXT DEFAULT 'FREE',
            max_products INTEGER DEFAULT 1,
            check_interval TEXT DEFAULT 'WEEKLY',
            plan_activated_at DATETIME,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;

    const createProductsTable = `
        CREATE TABLE IF NOT EXISTS tracked_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amazon_url TEXT NOT NULL,
            title TEXT,
            current_price REAL,
            target_price REAL,
            currency TEXT DEFAULT 'INR',
            last_checked_at DATETIME,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;

    const createSubscriptionsTable = `
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            plan_type TEXT DEFAULT 'free',
            max_products INTEGER DEFAULT 1,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;

    // Price history table for tracking price changes
    const createPriceHistoryTable = `
        CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            price REAL NOT NULL,
            checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES tracked_products(id) ON DELETE CASCADE
        )
    `;

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(createUsersTable, (err) => {
                if (err) console.error('Error creating users table:', err);
            });

            db.run(createProductsTable, (err) => {
                if (err) console.error('Error creating products table:', err);
            });

            db.run(createSubscriptionsTable, (err) => {
                if (err) console.error('Error creating subscriptions table:', err);
            });

            db.run(createPriceHistoryTable, (err) => {
                if (err) console.error('Error creating price_history table:', err);
            });

            // Create indexes
            db.run('CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)', () => { });
            db.run('CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan)', () => { });
            db.run('CREATE INDEX IF NOT EXISTS idx_tracked_products_user_id ON tracked_products(user_id)', () => { });
            db.run('CREATE INDEX IF NOT EXISTS idx_tracked_products_is_active ON tracked_products(is_active)', () => { });
            db.run('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)', () => { });
            db.run('CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id)', () => { });
            db.run('CREATE INDEX IF NOT EXISTS idx_price_history_checked_at ON price_history(checked_at)', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('📊 Database tables created/verified');
                    resolve();
                }
            });
        });
    });
}

/**
 * Run database migrations for backward compatibility
 * Adds new columns to existing tables without dropping data
 */
async function runMigrations() {
    console.log('🔄 Running database migrations...');

    // Get existing columns in users table
    const columns = await getTableColumns('users');
    const columnNames = columns.map(c => c.name);

    const migrations = [];

    // Add plan column if it doesn't exist
    if (!columnNames.includes('plan')) {
        migrations.push({
            name: 'add_plan_column',
            sql: `ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'FREE'`
        });
    }

    // Add max_products column if it doesn't exist
    if (!columnNames.includes('max_products')) {
        migrations.push({
            name: 'add_max_products_column',
            sql: `ALTER TABLE users ADD COLUMN max_products INTEGER DEFAULT 1`
        });
    }

    // Add check_interval column if it doesn't exist
    if (!columnNames.includes('check_interval')) {
        migrations.push({
            name: 'add_check_interval_column',
            sql: `ALTER TABLE users ADD COLUMN check_interval TEXT DEFAULT 'WEEKLY'`
        });
    }

    // Add plan_activated_at column if it doesn't exist
    if (!columnNames.includes('plan_activated_at')) {
        migrations.push({
            name: 'add_plan_activated_at_column',
            sql: `ALTER TABLE users ADD COLUMN plan_activated_at DATETIME`
        });
    }

    // ===== TRACKED PRODUCTS MIGRATIONS =====
    const productColumns = await getTableColumns('tracked_products');
    const productColumnNames = productColumns.map(c => c.name);

    // Add last_alert_price column if it doesn't exist
    if (!productColumnNames.includes('last_alert_price')) {
        migrations.push({
            name: 'add_last_alert_price_column',
            sql: `ALTER TABLE tracked_products ADD COLUMN last_alert_price REAL`
        });
    }

    // Add last_alerted_at column if it doesn't exist
    if (!productColumnNames.includes('last_alerted_at')) {
        migrations.push({
            name: 'add_last_alerted_at_column',
            sql: `ALTER TABLE tracked_products ADD COLUMN last_alerted_at DATETIME`
        });
    }

    // Run migrations
    for (const migration of migrations) {
        try {
            await runMigration(migration.sql);
            console.log(`   ✅ Migration: ${migration.name}`);
        } catch (error) {
            // Ignore "duplicate column" errors
            if (!error.message.includes('duplicate column')) {
                console.error(`   ❌ Migration failed: ${migration.name}`, error.message);
            }
        }
    }

    if (migrations.length === 0) {
        console.log('   ✅ No migrations needed');
    } else {
        console.log(`   ✅ ${migrations.length} migration(s) applied`);
    }
}

/**
 * Get columns of a table
 * @param {string} tableName - Name of the table
 * @returns {Promise<Array>} Array of column info
 */
function getTableColumns(tableName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Run a single migration
 * @param {string} sql - SQL statement to run
 * @returns {Promise<void>}
 */
function runMigration(sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Get the database instance
 * @returns {sqlite3.Database} The database instance
 * @throws {Error} If database is not initialized
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
}

/**
 * Run a query that modifies data (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<{lastID: number, changes: number}>}
 */
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

/**
 * Get a single row from the database
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|undefined>}
 */
function getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

/**
 * Get multiple rows from the database
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>}
 */
function getAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Close the database connection
 */
function closeDatabase() {
    return new Promise((resolve) => {
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                }
                db = null;
                console.log('📁 Database connection closed');
                resolve();
            });
        } else {
            resolve();
        }
    });
}

module.exports = {
    initializeDatabase,
    getDatabase,
    closeDatabase,
    runQuery,
    getOne,
    getAll
};
