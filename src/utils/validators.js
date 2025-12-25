/**
 * Validators Module
 * 
 * Contains validation functions for user input, URLs, and data.
 */

// Amazon URL patterns for different marketplaces
const AMAZON_URL_PATTERNS = [
    /^https?:\/\/(www\.)?amazon\.(com|co\.uk|de|fr|es|it|co\.jp|in|ca|com\.au|com\.br|com\.mx|nl|sg|ae|sa|se|pl|eg|tr)\/.*$/i,
    /^https?:\/\/(www\.)?amzn\.(to|com)\/.*$/i  // Short URLs
];

// ASIN pattern (10 alphanumeric characters, typically B followed by 9 chars)
const ASIN_PATTERN = /^[A-Z0-9]{10}$/i;

/**
 * Validate Amazon product URL
 * 
 * @param {string} url - URL to validate
 * @returns {Object} { isValid, error, normalizedUrl }
 */
function validateAmazonUrl(url) {
    // TODO: Implement full validation

    if (!url || typeof url !== 'string') {
        return { isValid: false, error: 'URL is required' };
    }

    const trimmedUrl = url.trim();

    // Check if URL matches Amazon pattern
    const isAmazonUrl = AMAZON_URL_PATTERNS.some(pattern => pattern.test(trimmedUrl));

    if (!isAmazonUrl) {
        return {
            isValid: false,
            error: 'Invalid Amazon URL. Please provide a valid Amazon product link.'
        };
    }

    // TODO: Extract and validate ASIN
    // const asin = extractAsin(trimmedUrl);
    // if (!asin) {
    //     return { isValid: false, error: 'Could not find product ID in URL' };
    // }

    // TODO: Normalize URL (remove tracking parameters, etc.)
    // const normalizedUrl = normalizeAmazonUrl(trimmedUrl);

    return {
        isValid: true,
        normalizedUrl: trimmedUrl
    };
}

/**
 * Validate price input
 * 
 * @param {string|number} price - Price to validate
 * @returns {Object} { isValid, error, value }
 */
function validatePrice(price) {
    if (price === null || price === undefined || price === '') {
        return { isValid: false, error: 'Price is required' };
    }

    const numericPrice = parseFloat(price);

    if (isNaN(numericPrice)) {
        return { isValid: false, error: 'Invalid price format' };
    }

    if (numericPrice <= 0) {
        return { isValid: false, error: 'Price must be greater than 0' };
    }

    if (numericPrice > 1000000) {
        return { isValid: false, error: 'Price seems unreasonably high' };
    }

    // Round to 2 decimal places
    const roundedPrice = Math.round(numericPrice * 100) / 100;

    return { isValid: true, value: roundedPrice };
}

/**
 * Validate product ID
 * 
 * @param {string|number} productId - Product ID to validate
 * @returns {Object} { isValid, error, value }
 */
function validateProductId(productId) {
    if (productId === null || productId === undefined || productId === '') {
        return { isValid: false, error: 'Product ID is required' };
    }

    const numericId = parseInt(productId, 10);

    if (isNaN(numericId) || numericId <= 0) {
        return { isValid: false, error: 'Invalid product ID' };
    }

    return { isValid: true, value: numericId };
}

/**
 * Validate Telegram user ID
 * 
 * @param {number} telegramId - Telegram user ID
 * @returns {Object} { isValid, error }
 */
function validateTelegramId(telegramId) {
    if (!telegramId || typeof telegramId !== 'number') {
        return { isValid: false, error: 'Invalid Telegram ID' };
    }

    if (telegramId <= 0) {
        return { isValid: false, error: 'Telegram ID must be positive' };
    }

    return { isValid: true };
}

/**
 * Validate ASIN (Amazon Standard Identification Number)
 * 
 * @param {string} asin - ASIN to validate
 * @returns {boolean} Whether ASIN is valid
 */
function validateAsin(asin) {
    if (!asin || typeof asin !== 'string') {
        return false;
    }

    return ASIN_PATTERN.test(asin.trim());
}

/**
 * Sanitize user input to prevent injection attacks
 * 
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }

    return input
        .trim()
        .replace(/[<>]/g, '') // Remove angle brackets
        .substring(0, 1000); // Limit length
}

module.exports = {
    validateAmazonUrl,
    validatePrice,
    validateProductId,
    validateTelegramId,
    validateAsin,
    sanitizeInput,
    AMAZON_URL_PATTERNS,
    ASIN_PATTERN
};
