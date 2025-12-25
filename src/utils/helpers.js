/**
 * Helper Functions Module
 * 
 * Contains utility helper functions used across the application.
 */

/**
 * Format price for display
 * 
 * @param {number} price - Price value
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted price string
 */
function formatPrice(price, currency = 'USD') {
    if (price === null || price === undefined) {
        return 'N/A';
    }

    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    });

    return formatter.format(price);
}

/**
 * Format date for display
 * 
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type: 'short', 'long', 'relative'
 * @returns {string} Formatted date string
 */
function formatDate(date, format = 'short') {
    if (!date) {
        return 'N/A';
    }

    const dateObj = new Date(date);

    if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
    }

    switch (format) {
        case 'short':
            return dateObj.toLocaleDateString('en-US');
        case 'long':
            return dateObj.toLocaleString('en-US');
        case 'relative':
            return getRelativeTime(dateObj);
        default:
            return dateObj.toISOString();
    }
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * 
 * @param {Date} date - Date to convert
 * @returns {string} Relative time string
 */
function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
        return 'just now';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString('en-US');
    }
}

/**
 * Calculate price change percentage
 * 
 * @param {number} oldPrice - Previous price
 * @param {number} newPrice - Current price
 * @returns {Object} { change, percentage, direction }
 */
function calculatePriceChange(oldPrice, newPrice) {
    if (!oldPrice || !newPrice) {
        return { change: 0, percentage: 0, direction: 'unchanged' };
    }

    const change = newPrice - oldPrice;
    const percentage = ((change / oldPrice) * 100).toFixed(2);

    let direction = 'unchanged';
    if (change < 0) direction = 'down';
    if (change > 0) direction = 'up';

    return {
        change: Math.abs(change),
        percentage: Math.abs(parseFloat(percentage)),
        direction
    };
}

/**
 * Delay execution for specified milliseconds
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * 
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries - 1) {
                const delayMs = baseDelay * Math.pow(2, attempt);
                console.log(`Retry attempt ${attempt + 1} after ${delayMs}ms`);
                await delay(delayMs);
            }
        }
    }

    throw lastError;
}

/**
 * Truncate string to specified length with ellipsis
 * 
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, maxLength = 50) {
    if (!str || str.length <= maxLength) {
        return str || '';
    }

    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Generate a random ID string
 * 
 * @param {number} length - Length of ID
 * @returns {string} Random ID
 */
function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array)
 * 
 * @param {*} value - Value to check
 * @returns {boolean} Whether value is empty
 */
function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
}

/**
 * Safe JSON parse with default value
 * 
 * @param {string} json - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed value or default
 */
function safeJsonParse(json, defaultValue = null) {
    try {
        return JSON.parse(json);
    } catch {
        return defaultValue;
    }
}

/**
 * Create a rate limiter
 * 
 * @param {number} maxRequests - Maximum requests
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} Rate limiter object with check() method
 */
function createRateLimiter(maxRequests = 10, windowMs = 60000) {
    const requests = [];

    return {
        check() {
            const now = Date.now();

            // Remove old requests outside the window
            while (requests.length > 0 && requests[0] < now - windowMs) {
                requests.shift();
            }

            if (requests.length >= maxRequests) {
                return { allowed: false, retryAfter: requests[0] + windowMs - now };
            }

            requests.push(now);
            return { allowed: true };
        },
        reset() {
            requests.length = 0;
        }
    };
}

module.exports = {
    formatPrice,
    formatDate,
    getRelativeTime,
    calculatePriceChange,
    delay,
    retryWithBackoff,
    truncate,
    generateId,
    isEmpty,
    safeJsonParse,
    createRateLimiter
};
