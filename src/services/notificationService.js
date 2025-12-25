/**
 * Notification Service
 * 
 * Handles sending notifications to users.
 * Uses price history for trend analysis.
 */

const { sendMessage } = require('../bot');
const queries = require('../db/queries');
const {
    calculatePriceChange,
    analyzePriceTrend,
    formatTrendMessage,
    getCurrencySymbol,
    formatPrice
} = require('./priceHelper');

/**
 * Build price drop notification message with trend analysis
 * @param {Object} product - Product object
 * @param {number} oldPrice - Previous price
 * @param {number} newPrice - Current price
 * @param {Object} trend - Price trend analysis
 * @param {string} alertReason - Reason for alert
 * @returns {string} Formatted message
 */
function buildPriceDropMessage(product, oldPrice, newPrice, trend, alertReason) {
    const symbol = getCurrencySymbol(product.currency);
    const priceChange = calculatePriceChange(oldPrice, newPrice);
    const savings = oldPrice - newPrice;

    let message = `🎉 <b>Price Drop Alert!</b>\n\n`;
    message += `📦 <b>${truncateTitle(product.title, 100)}</b>\n\n`;

    // Price info
    message += `💰 <b>Was:</b> <s>${symbol}${formatPrice(oldPrice)}</s>\n`;
    message += `💰 <b>Now:</b> <b>${symbol}${formatPrice(newPrice)}</b>\n`;
    message += `💵 <b>You Save:</b> ${symbol}${formatPrice(savings)} (${priceChange.formattedPercent} off)\n`;

    // Target price if set
    if (product.target_price) {
        message += `\n🎯 <b>Your Target:</b> ${symbol}${formatPrice(product.target_price)}`;
        if (newPrice <= product.target_price) {
            message += ` ✅ <b>REACHED!</b>`;
        }
        message += '\n';
    }

    // Add trend summary if available
    if (trend && trend.hasData) {
        message += formatTrendMessage(trend, product.currency);
    }

    // Alert reason
    message += `\n📌 <i>${alertReason}</i>\n`;

    // Buy link
    message += `\n🛒 <a href="${product.amazon_url}">Buy Now on Amazon</a>`;

    return message;
}

/**
 * Send price drop notification with trend analysis
 * @param {number} telegramId - User's Telegram ID
 * @param {Object} product - Product object
 * @param {number} oldPrice - Previous price
 * @param {number} newPrice - New price
 * @param {string} alertReason - Reason for alert
 */
async function notifyPriceDrop(telegramId, product, oldPrice, newPrice, alertReason = 'Price dropped') {
    console.log(`📢 Notifying user ${telegramId} about price drop`);

    try {
        // Get price history for trend analysis
        const priceHistory = await queries.getPriceHistory(product.id, 30);
        const trend = analyzePriceTrend(priceHistory, newPrice);

        // Build message
        const message = buildPriceDropMessage(product, oldPrice, newPrice, trend, alertReason);

        // Send via Telegram
        await sendMessage(telegramId, message);

        console.log(`   ✅ Notification sent to ${telegramId}`);
        return true;

    } catch (error) {
        console.error('Error sending price drop notification:', error.message);
        throw error;
    }
}

/**
 * Send target price reached notification
 * @param {number} telegramId - User's Telegram ID
 * @param {Object} product - Product object
 * @param {number} currentPrice - Current price
 */
async function notifyTargetReached(telegramId, product, currentPrice) {
    console.log(`📢 Notifying user ${telegramId} about target price reached`);

    try {
        const symbol = getCurrencySymbol(product.currency);
        const priceHistory = await queries.getPriceHistory(product.id, 30);
        const trend = analyzePriceTrend(priceHistory, currentPrice);

        let message = `🎯 <b>Target Price Reached!</b>\n\n`;
        message += `📦 <b>${truncateTitle(product.title, 100)}</b>\n\n`;
        message += `💰 <b>Current Price:</b> <b>${symbol}${formatPrice(currentPrice)}</b>\n`;
        message += `🎯 <b>Your Target:</b> ${symbol}${formatPrice(product.target_price)} ✅\n`;

        if (trend && trend.hasData) {
            message += formatTrendMessage(trend, product.currency);
        }

        message += `\n🛒 <b>Time to buy!</b>\n`;
        message += `\n🔗 <a href="${product.amazon_url}">Buy Now on Amazon</a>`;

        await sendMessage(telegramId, message);
        console.log(`   ✅ Target notification sent to ${telegramId}`);
        return true;

    } catch (error) {
        console.error('Error sending target reached notification:', error.message);
        throw error;
    }
}

/**
 * Send weekly digest to a user
 * @param {number} telegramId - User's Telegram ID
 * @param {Array} products - User's tracked products
 */
async function sendWeeklyDigest(telegramId, products) {
    console.log(`📢 Sending weekly digest to user ${telegramId}`);

    try {
        if (!products || products.length === 0) {
            return false;
        }

        let message = `📊 <b>Weekly Price Update</b>\n\n`;
        message += `You're tracking ${products.length} product(s):\n\n`;

        for (let i = 0; i < products.length; i++) {
            const p = products[i];
            const symbol = getCurrencySymbol(p.currency);

            // Get 7-day trend
            const priceHistory = await queries.getPriceHistory(p.id, 14);
            const trend = analyzePriceTrend(priceHistory, p.current_price);

            message += `<b>${i + 1}. ${truncateTitle(p.title, 50)}</b>\n`;
            message += `   💰 ${symbol}${formatPrice(p.current_price)}`;

            if (trend && trend.trend7d && trend.trend7d.change) {
                message += ` ${trend.trend7d.change.emoji} ${trend.trend7d.change.formattedPercent}`;
            }

            if (p.target_price) {
                message += ` | 🎯 ${symbol}${formatPrice(p.target_price)}`;
            }
            message += '\n\n';
        }

        message += `Use /status for more details.`;

        await sendMessage(telegramId, message);
        console.log(`   ✅ Weekly digest sent to ${telegramId}`);
        return true;

    } catch (error) {
        console.error('Error sending weekly digest:', error.message);
        throw error;
    }
}

/**
 * Send product unavailable notification
 * @param {number} telegramId - User's Telegram ID
 * @param {Object} product - Product object
 */
async function notifyProductUnavailable(telegramId, product) {
    console.log(`📢 Notifying user ${telegramId} about unavailable product`);

    try {
        let message = `⚠️ <b>Product Unavailable</b>\n\n`;
        message += `📦 ${truncateTitle(product.title, 100)}\n\n`;
        message += `This product is currently unavailable or out of stock.\n`;
        message += `We'll keep checking and notify you when it's back!\n\n`;
        message += `🔗 <a href="${product.amazon_url}">View on Amazon</a>`;

        await sendMessage(telegramId, message);
        console.log(`   ✅ Unavailable notification sent to ${telegramId}`);
        return true;

    } catch (error) {
        console.error('Error sending unavailable notification:', error.message);
        throw error;
    }
}

/**
 * Send a custom notification
 * @param {number} telegramId - User's Telegram ID
 * @param {string} message - Custom message
 */
async function sendCustomNotification(telegramId, message) {
    console.log(`📢 Sending custom notification to user ${telegramId}`);

    try {
        await sendMessage(telegramId, message);
        return true;
    } catch (error) {
        console.error('Error sending custom notification:', error.message);
        throw error;
    }
}

/**
 * Truncate title to specified length
 */
function truncateTitle(title, maxLength = 50) {
    if (!title) return 'Unknown Product';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + '...';
}

module.exports = {
    notifyPriceDrop,
    notifyTargetReached,
    sendWeeklyDigest,
    notifyProductUnavailable,
    sendCustomNotification,
    buildPriceDropMessage
};
