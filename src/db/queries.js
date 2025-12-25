/**
 * Database Queries Module
 * 
 * Contains all database query functions organized by entity.
 * Uses async/await pattern with sqlite3.
 */

const { runQuery, getOne, getAll } = require('./connection');

// ===========================================
// USER QUERIES
// ===========================================

/**
 * Create a new user or update existing user
 * @param {Object} userData - User data from Telegram
 * @returns {Promise<Object>} The created/updated user
 */
async function upsertUser({ telegramId, username, firstName, lastName, languageCode }) {
    // First try to find existing user
    const existing = await getOne('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);

    if (existing) {
        // Update existing user
        await runQuery(`
            UPDATE users SET 
                username = ?, 
                first_name = ?, 
                last_name = ?, 
                language_code = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE telegram_id = ?
        `, [username, firstName, lastName, languageCode, telegramId]);

        return await getOne('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
    } else {
        // Insert new user
        const result = await runQuery(`
            INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
            VALUES (?, ?, ?, ?, ?)
        `, [telegramId, username, firstName, lastName, languageCode]);

        return await getOne('SELECT * FROM users WHERE id = ?', [result.lastID]);
    }
}

/**
 * Find user by Telegram ID
 * @param {number} telegramId - Telegram user ID
 * @returns {Promise<Object|undefined>} User object or undefined
 */
async function findUserByTelegramId(telegramId) {
    return await getOne('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
}

/**
 * Get all active users
 * @returns {Promise<Array>} List of active users
 */
async function getAllActiveUsers() {
    return await getAll('SELECT * FROM users WHERE is_active = 1');
}

// ===========================================
// TRACKED PRODUCTS QUERIES
// ===========================================

/**
 * Add a new product to track
 * @param {Object} productData - Product data
 * @returns {Promise<Object>} The created product
 */
async function createTrackedProduct({ userId, amazonUrl, title, currentPrice, currency }) {
    const result = await runQuery(`
        INSERT INTO tracked_products (user_id, amazon_url, title, current_price, currency, last_checked_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [userId, amazonUrl, title, currentPrice, currency || 'INR']);

    return await getOne('SELECT * FROM tracked_products WHERE id = ?', [result.lastID]);
}

/**
 * Get all tracked products for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} List of tracked products
 */
async function getTrackedProductsByUserId(userId) {
    return await getAll(`
        SELECT * FROM tracked_products 
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC
    `, [userId]);
}

/**
 * Update target price for a product
 * @param {number} productId - Product ID
 * @param {number} targetPrice - New target price
 * @returns {Promise<Object>} Updated product
 */
async function updateTargetPrice(productId, targetPrice) {
    await runQuery(`
        UPDATE tracked_products 
        SET target_price = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [targetPrice, productId]);

    return await getOne('SELECT * FROM tracked_products WHERE id = ?', [productId]);
}

/**
 * Update current price after scraping
 * @param {number} productId - Product ID
 * @param {number} currentPrice - New current price
 * @param {string} title - Product title (may have changed)
 * @returns {Promise<Object>} Updated product
 */
async function updateProductPrice(productId, currentPrice, title) {
    await runQuery(`
        UPDATE tracked_products 
        SET current_price = ?, title = ?, last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [currentPrice, title, productId]);

    return await getOne('SELECT * FROM tracked_products WHERE id = ?', [productId]);
}

/**
 * Update alert status after sending notification
 * Records the price at which alert was sent to avoid duplicate alerts
 * @param {number} productId - Product ID
 * @param {number} alertPrice - Price at which alert was sent
 * @returns {Promise<Object>} Updated product
 */
async function updateAlertStatus(productId, alertPrice) {
    await runQuery(`
        UPDATE tracked_products 
        SET last_alert_price = ?, last_alerted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [alertPrice, productId]);

    return await getOne('SELECT * FROM tracked_products WHERE id = ?', [productId]);
}


/**
 * Get all active tracked products (for scheduled price checks)
 * Includes user plan info for eligibility checking
 * @returns {Promise<Array>} List of all active tracked products with user info
 */
async function getAllActiveTrackedProducts() {
    return await getAll(`
        SELECT 
            tp.*, 
            u.telegram_id,
            u.plan,
            u.max_products,
            u.check_interval
        FROM tracked_products tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.is_active = 1 AND u.is_active = 1
        ORDER BY u.plan DESC, tp.last_checked_at ASC
    `);
}

/**
 * Get active tracked products filtered by check interval
 * @param {string} interval - Check interval (DAILY, WEEKLY)
 * @returns {Promise<Array>} List of products
 */
async function getActiveTrackedProductsByInterval(interval) {
    return await getAll(`
        SELECT 
            tp.*, 
            u.telegram_id,
            u.plan,
            u.max_products,
            u.check_interval
        FROM tracked_products tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.is_active = 1 
          AND u.is_active = 1
          AND u.check_interval = ?
        ORDER BY tp.last_checked_at ASC
    `, [interval]);
}

/**
 * Delete/deactivate a tracked product
 * @param {number} productId - Product ID
 * @param {number} userId - User ID (for authorization)
 * @returns {Promise<boolean>} Success status
 */
async function deleteTrackedProduct(productId, userId) {
    const result = await runQuery(`
        UPDATE tracked_products 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    `, [productId, userId]);

    return result.changes > 0;
}

/**
 * Count tracked products for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>} Count of active tracked products
 */
async function countUserTrackedProducts(userId) {
    const result = await getOne(`
        SELECT COUNT(*) as count 
        FROM tracked_products 
        WHERE user_id = ? AND is_active = 1
    `, [userId]);

    return result ? result.count : 0;
}

/**
 * Find product by ID
 * @param {number} productId - Product ID
 * @returns {Promise<Object|undefined>} Product object or undefined
 */
async function findProductById(productId) {
    return await getOne('SELECT * FROM tracked_products WHERE id = ? AND is_active = 1', [productId]);
}

/**
 * Check if user already tracks a specific URL
 * @param {number} userId - User ID
 * @param {string} amazonUrl - Amazon URL
 * @returns {Promise<Object|undefined>} Existing product or undefined
 */
async function findTrackedProductByUrl(userId, amazonUrl) {
    return await getOne(`
        SELECT * FROM tracked_products 
        WHERE user_id = ? AND amazon_url = ? AND is_active = 1
    `, [userId, amazonUrl]);
}

// ===========================================
// SUBSCRIPTION QUERIES
// ===========================================

/**
 * Create or update user subscription
 * @param {Object} subscriptionData - Subscription data
 * @returns {Promise<Object>} The subscription
 */
async function upsertSubscription({ userId, planType, maxProducts, expiresAt }) {
    const existing = await getOne('SELECT * FROM subscriptions WHERE user_id = ?', [userId]);

    if (existing) {
        await runQuery(`
            UPDATE subscriptions SET
                plan_type = ?,
                max_products = ?,
                expires_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `, [planType || 'free', maxProducts || 1, expiresAt, userId]);
    } else {
        await runQuery(`
            INSERT INTO subscriptions (user_id, plan_type, max_products, expires_at)
            VALUES (?, ?, ?, ?)
        `, [userId, planType || 'free', maxProducts || 1, expiresAt]);
    }

    return await getOne('SELECT * FROM subscriptions WHERE user_id = ?', [userId]);
}

/**
 * Get user subscription
 * @param {number} userId - User ID
 * @returns {Promise<Object|undefined>} Subscription or undefined
 */
async function getSubscriptionByUserId(userId) {
    return await getOne('SELECT * FROM subscriptions WHERE user_id = ? AND is_active = 1', [userId]);
}

/**
 * Check if user can track more products based on subscription
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} Whether user can track more products
 */
async function canUserTrackMoreProducts(userId) {
    const subscription = await getSubscriptionByUserId(userId);
    const currentCount = await countUserTrackedProducts(userId);

    // Free tier default = 1 product
    const maxProducts = subscription ? subscription.max_products : 1;

    return currentCount < maxProducts;
}

/**
 * Upgrade user's plan
 * @param {number} userId - User ID
 * @param {string} plan - New plan (FREE, PRO)
 * @param {number} maxProducts - Max products for the plan
 * @param {string} checkInterval - Check interval (WEEKLY, DAILY, HOURLY)
 * @returns {Promise<Object>} Updated user
 */
async function upgradeUserPlan(userId, plan, maxProducts, checkInterval) {
    await runQuery(`
        UPDATE users SET 
            plan = ?,
            max_products = ?,
            check_interval = ?,
            plan_activated_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [plan, maxProducts, checkInterval, userId]);

    return await getOne('SELECT * FROM users WHERE id = ?', [userId]);
}

/**
 * Downgrade user to free plan
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Updated user
 */
async function downgradeUserPlan(userId) {
    return await upgradeUserPlan(userId, 'FREE', 1, 'WEEKLY');
}

// ===========================================
// PRICE HISTORY QUERIES
// ===========================================

/**
 * Add a price history entry
 * @param {number} productId - Product ID
 * @param {number} price - Price at check time
 * @returns {Promise<Object>} Created history entry
 */
async function addPriceHistory(productId, price) {
    const result = await runQuery(`
        INSERT INTO price_history (product_id, price)
        VALUES (?, ?)
    `, [productId, price]);

    return await getOne('SELECT * FROM price_history WHERE id = ?', [result.lastID]);
}

/**
 * Get price history for a product
 * @param {number} productId - Product ID
 * @param {number} limit - Maximum number of entries (default 30)
 * @returns {Promise<Array>} List of price history entries
 */
async function getPriceHistory(productId, limit = 30) {
    return await getAll(`
        SELECT * FROM price_history 
        WHERE product_id = ?
        ORDER BY checked_at DESC
        LIMIT ?
    `, [productId, limit]);
}

/**
 * Get price statistics for a product
 * @param {number} productId - Product ID
 * @returns {Promise<Object>} Price stats (min, max, avg, count)
 */
async function getPriceStats(productId) {
    return await getOne(`
        SELECT 
            MIN(price) as min_price,
            MAX(price) as max_price,
            AVG(price) as avg_price,
            COUNT(*) as check_count,
            MIN(checked_at) as first_check,
            MAX(checked_at) as last_check
        FROM price_history 
        WHERE product_id = ?
    `, [productId]);
}

/**
 * Delete old price history entries (keep last N entries per product)
 * @param {number} keepCount - Number of entries to keep per product
 * @returns {Promise<number>} Number of deleted entries
 */
async function cleanupPriceHistory(keepCount = 90) {
    const result = await runQuery(`
        DELETE FROM price_history 
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id, product_id,
                ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY checked_at DESC) as rn
                FROM price_history
            ) WHERE rn <= ?
        )
    `, [keepCount]);

    return result.changes;
}

module.exports = {
    // User queries
    upsertUser,
    findUserByTelegramId,
    getAllActiveUsers,
    upgradeUserPlan,
    downgradeUserPlan,

    // Tracked products queries
    createTrackedProduct,
    getTrackedProductsByUserId,
    updateTargetPrice,
    updateProductPrice,
    updateAlertStatus,
    getAllActiveTrackedProducts,
    getActiveTrackedProductsByInterval,
    deleteTrackedProduct,
    countUserTrackedProducts,
    findProductById,
    findTrackedProductByUrl,

    // Price history queries
    addPriceHistory,
    getPriceHistory,
    getPriceStats,
    cleanupPriceHistory,

    // Subscription queries
    upsertSubscription,
    getSubscriptionByUserId,
    canUserTrackMoreProducts
};
