/**
 * Price Helper Service
 * 
 * Utilities for price calculations and comparisons.
 */

// Minimum drop percentage to trigger alerts (configurable)
const MIN_DROP_PERCENT = parseFloat(process.env.MIN_DROP_PERCENT) || 2.0;

/**
 * Calculate price change between old and new price
 * @param {number} oldPrice - Previous price
 * @param {number} newPrice - Current price
 * @returns {Object} { 
 *   absoluteChange, percentChange, direction, isMeaningful, 
 *   formattedAbsolute, formattedPercent 
 * }
 */
function calculatePriceChange(oldPrice, newPrice) {
    if (!oldPrice || !newPrice || oldPrice <= 0 || newPrice <= 0) {
        return {
            absoluteChange: 0,
            percentChange: 0,
            direction: 'unchanged',
            isMeaningful: false,
            formattedAbsolute: '0',
            formattedPercent: '0%'
        };
    }

    const absoluteChange = oldPrice - newPrice;
    const percentChange = (absoluteChange / oldPrice) * 100;
    const absPercent = Math.abs(percentChange);

    // Determine direction
    let direction = 'unchanged';
    if (absoluteChange > 0.01) direction = 'down';
    else if (absoluteChange < -0.01) direction = 'up';

    // Check if change is meaningful (above threshold)
    const isMeaningful = direction === 'down' && absPercent >= MIN_DROP_PERCENT;

    return {
        absoluteChange,
        percentChange,
        direction,
        isMeaningful,
        formattedAbsolute: formatPrice(Math.abs(absoluteChange)),
        formattedPercent: `${absPercent.toFixed(1)}%`,
        isDropped: direction === 'down',
        isIncreased: direction === 'up',
        emoji: direction === 'down' ? '📉' : direction === 'up' ? '📈' : '➡️'
    };
}

/**
 * Analyze price trend from history
 * @param {Array} priceHistory - Array of {price, checked_at} entries (newest first)
 * @param {number} currentPrice - Current price
 * @returns {Object} Trend analysis
 */
function analyzePriceTrend(priceHistory, currentPrice) {
    if (!priceHistory || priceHistory.length === 0) {
        return {
            hasData: false,
            summary: 'No price history available',
            trend7d: null,
            trend14d: null
        };
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    // Get prices from different time periods
    const prices7d = priceHistory.filter(h => new Date(h.checked_at) >= sevenDaysAgo);
    const prices14d = priceHistory.filter(h => new Date(h.checked_at) >= fourteenDaysAgo);

    // Calculate trends
    const trend7d = calculateTrendStats(prices7d, currentPrice, '7 days');
    const trend14d = calculateTrendStats(prices14d, currentPrice, '14 days');

    // All-time stats
    const allPrices = priceHistory.map(h => h.price);
    const allTimeHigh = Math.max(...allPrices, currentPrice);
    const allTimeLow = Math.min(...allPrices, currentPrice);
    const avgPrice = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;

    // Generate summary
    let summary = '';
    if (trend7d && trend7d.change) {
        if (trend7d.change.direction === 'down') {
            summary = `📉 Down ${trend7d.change.formattedPercent} in 7 days`;
        } else if (trend7d.change.direction === 'up') {
            summary = `📈 Up ${trend7d.change.formattedPercent} in 7 days`;
        } else {
            summary = `➡️ Stable in 7 days`;
        }
    }

    // Check if at all-time low
    const isAtLow = currentPrice <= allTimeLow;
    if (isAtLow) {
        summary += ' • 🏷️ All-time low!';
    }

    return {
        hasData: true,
        summary,
        trend7d,
        trend14d,
        allTimeHigh,
        allTimeLow,
        avgPrice: avgPrice.toFixed(2),
        isAtLow,
        totalChecks: priceHistory.length
    };
}

/**
 * Calculate trend statistics for a time period
 * @param {Array} prices - Price history entries
 * @param {number} currentPrice - Current price
 * @param {string} period - Period label
 * @returns {Object} Trend stats
 */
function calculateTrendStats(prices, currentPrice, period) {
    if (!prices || prices.length === 0) {
        return null;
    }

    // Get oldest price in period
    const oldestEntry = prices[prices.length - 1];
    const oldestPrice = oldestEntry.price;

    // Calculate change from oldest to current
    const change = calculatePriceChange(oldestPrice, currentPrice);

    // Calculate min/max/avg in period
    const priceValues = prices.map(p => p.price);
    const min = Math.min(...priceValues, currentPrice);
    const max = Math.max(...priceValues, currentPrice);
    const avg = priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;

    return {
        period,
        startPrice: oldestPrice,
        currentPrice,
        change,
        min,
        max,
        avg: avg.toFixed(2),
        dataPoints: prices.length
    };
}

/**
 * Format trend summary for Telegram message
 * @param {Object} trend - Trend analysis object
 * @param {string} currency - Currency code
 * @returns {string} Formatted message
 */
function formatTrendMessage(trend, currency) {
    if (!trend || !trend.hasData) {
        return '';
    }

    const symbol = getCurrencySymbol(currency);
    let message = `\n📊 <b>Price Trend:</b>\n`;

    if (trend.trend7d) {
        const t7 = trend.trend7d;
        message += `• 7 days: ${t7.change.emoji} ${t7.change.formattedPercent}`;
        message += ` (${symbol}${formatPrice(t7.startPrice)} → ${symbol}${formatPrice(t7.currentPrice)})\n`;
    }

    if (trend.trend14d) {
        const t14 = trend.trend14d;
        message += `• 14 days: ${t14.change.emoji} ${t14.change.formattedPercent}`;
        message += ` (${symbol}${formatPrice(t14.startPrice)} → ${symbol}${formatPrice(t14.currentPrice)})\n`;
    }

    message += `• Low: ${symbol}${formatPrice(trend.allTimeLow)} | High: ${symbol}${formatPrice(trend.allTimeHigh)}\n`;

    if (trend.isAtLow) {
        message += `\n🏷️ <b>This is the lowest price we've seen!</b>`;
    }

    return message;
}

/**
 * Determine if an alert should be triggered
 * @param {Object} product - Product from database
 * @param {number} oldPrice - Previous price
 * @param {number} newPrice - Current price
 * @returns {Object} { shouldAlert, reason, priceChange }
 */
function shouldTriggerAlert(product, oldPrice, newPrice) {
    const priceChange = calculatePriceChange(oldPrice, newPrice);

    // Don't alert if price went up or unchanged
    if (!priceChange.isDropped) {
        return { shouldAlert: false, reason: 'Price did not drop', priceChange };
    }

    // Skip if already alerted at this price or lower
    if (product.last_alert_price && newPrice >= product.last_alert_price) {
        return {
            shouldAlert: false,
            reason: `Already alerted at ${product.last_alert_price}`,
            priceChange
        };
    }

    // Target price reached - always alert
    if (product.target_price && newPrice <= product.target_price) {
        return {
            shouldAlert: true,
            reason: `Target price ${product.target_price} reached!`,
            priceChange,
            priority: 'high'
        };
    }

    // Check if drop is meaningful
    if (priceChange.isMeaningful) {
        return {
            shouldAlert: true,
            reason: `Price dropped ${priceChange.formattedPercent}`,
            priceChange,
            priority: 'normal'
        };
    }

    // Drop too small
    return {
        shouldAlert: false,
        reason: `Drop (${priceChange.formattedPercent}) below threshold (${MIN_DROP_PERCENT}%)`,
        priceChange
    };
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get simple trend label from price history
 * @param {Array} priceHistory - Array of {price, checked_at} entries (newest first)
 * @param {number} entries - Number of entries to analyze (default 5)
 * @returns {Object} { label: 'DOWN'|'UP'|'STABLE', emoji, description, percentChange }
 */
function getTrendLabel(priceHistory, entries = 5) {
    if (!priceHistory || priceHistory.length < 2) {
        return {
            label: 'STABLE',
            emoji: '➡️',
            description: 'Not enough data',
            percentChange: 0
        };
    }

    // Take last N entries
    const recentPrices = priceHistory.slice(0, Math.min(entries, priceHistory.length));

    // Get oldest and newest in the subset
    const newestPrice = recentPrices[0].price;
    const oldestPrice = recentPrices[recentPrices.length - 1].price;

    if (!oldestPrice || !newestPrice) {
        return { label: 'STABLE', emoji: '➡️', description: 'Invalid prices', percentChange: 0 };
    }

    const percentChange = ((oldestPrice - newestPrice) / oldestPrice) * 100;
    const threshold = 2; // 2% threshold for trend detection

    if (percentChange > threshold) {
        return {
            label: 'DOWN',
            emoji: '📉',
            description: `Dropping (${percentChange.toFixed(1)}% in last ${recentPrices.length} checks)`,
            percentChange
        };
    } else if (percentChange < -threshold) {
        return {
            label: 'UP',
            emoji: '📈',
            description: `Rising (${Math.abs(percentChange).toFixed(1)}% in last ${recentPrices.length} checks)`,
            percentChange
        };
    } else {
        return {
            label: 'STABLE',
            emoji: '➡️',
            description: `Stable (±${Math.abs(percentChange).toFixed(1)}%)`,
            percentChange
        };
    }
}

function getCurrencySymbol(currency) {
    const symbols = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥' };
    return symbols[currency] || currency;
}

function formatPrice(price) {
    if (price === null || price === undefined) return 'N/A';
    return parseFloat(price).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

module.exports = {
    calculatePriceChange,
    analyzePriceTrend,
    formatTrendMessage,
    shouldTriggerAlert,
    getTrendLabel,
    getCurrencySymbol,
    formatPrice,
    MIN_DROP_PERCENT
};
