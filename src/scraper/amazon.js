/**
 * Amazon Product Scraper
 * 
 * Scrapes product information from Amazon product pages.
 * Uses Axios for HTTP requests and Cheerio for HTML parsing.
 * 
 * Supports amazon.in and amazon.com
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Configuration
const DEFAULT_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 10000;
const USER_AGENT = process.env.USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Scrape product information from an Amazon URL
 * 
 * @param {string} url - Amazon product URL
 * @returns {Promise<Object>} Product data { title, price, currency }
 * @throws {Error} If scraping fails
 */
async function scrapeAmazonProduct(url) {
    console.log(`🔍 Scraping URL: ${url}`);

    try {
        // Fetch the page HTML
        const response = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0',
            },
            timeout: DEFAULT_TIMEOUT
        });

        // Parse HTML with Cheerio
        const $ = cheerio.load(response.data);

        // Extract title
        const title = extractTitle($);
        if (!title) {
            throw new Error('Could not find product title. The page structure may have changed.');
        }

        // Extract price
        const priceData = extractPrice($);
        if (!priceData.price) {
            throw new Error('Could not find product price. The product may be unavailable or the page structure changed.');
        }

        console.log(`✅ Scraped: "${title.substring(0, 50)}..." - ${priceData.currency}${priceData.price}`);

        return {
            title: title,
            price: priceData.price,
            currency: priceData.currency,
            scrapedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Scraping error:', error.message);

        // Handle specific error types
        if (error.code === 'ECONNABORTED') {
            throw new Error('Request timed out. Amazon may be slow or blocking the request.');
        }
        if (error.response?.status === 503) {
            throw new Error('Amazon is blocking automated requests. Please try again later.');
        }
        if (error.response?.status === 404) {
            throw new Error('Product not found. Please check the URL.');
        }

        throw error;
    }
}

/**
 * Extract product title from the page
 * @param {CheerioAPI} $ - Cheerio instance
 * @returns {string|null} Product title or null
 */
function extractTitle($) {
    // Try multiple selectors for title
    const titleSelectors = [
        '#productTitle',
        '#title span',
        'h1.a-size-large',
        'h1#title'
    ];

    for (const selector of titleSelectors) {
        const element = $(selector).first();
        if (element.length) {
            const title = element.text().trim();
            if (title) return title;
        }
    }

    return null;
}

/**
 * Extract price from the page
 * @param {CheerioAPI} $ - Cheerio instance
 * @returns {Object} { price: number, currency: string }
 */
function extractPrice($) {
    // Price selectors for different Amazon layouts
    const priceSelectors = [
        // Indian Amazon selectors
        '.a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '#priceblock_saleprice',
        '.a-price-whole',
        '#corePrice_feature_div .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-offscreen',
        // Deal price
        '#apex_offerDisplay_desktop .a-offscreen',
        // Kindle/Book prices
        '#kindle-price',
        '#price',
        // Mobile selectors
        '.a-color-price',
    ];

    let priceText = '';

    for (const selector of priceSelectors) {
        const element = $(selector).first();
        if (element.length) {
            priceText = element.text().trim();
            if (priceText && priceText.match(/[\d.,]+/)) {
                break;
            }
        }
    }

    if (!priceText) {
        return { price: null, currency: 'INR' };
    }

    // Parse the price
    const parsed = parsePrice(priceText);

    return parsed;
}

/**
 * Parse price string to number and detect currency
 * Handles formats: ₹1,299.00, $29.99, €29,99
 * 
 * @param {string} priceText - Price string from page
 * @returns {Object} { price: number, currency: string }
 */
function parsePrice(priceText) {
    if (!priceText) return { price: null, currency: 'INR' };

    // Detect currency
    let currency = 'INR'; // Default for amazon.in
    if (priceText.includes('$')) currency = 'USD';
    else if (priceText.includes('€')) currency = 'EUR';
    else if (priceText.includes('£')) currency = 'GBP';
    else if (priceText.includes('¥')) currency = 'JPY';
    else if (priceText.includes('₹')) currency = 'INR';

    // Remove currency symbols and clean up
    let cleaned = priceText
        .replace(/[₹$€£¥]/g, '')
        .replace(/\s/g, '')
        .trim();

    // Handle Indian number format (1,23,456.00) and Western format (123,456.00)
    // Remove all commas first, then parse
    cleaned = cleaned.replace(/,/g, '');

    // Extract the first valid number
    const match = cleaned.match(/[\d.]+/);
    if (!match) return { price: null, currency };

    const price = parseFloat(match[0]);

    return {
        price: isNaN(price) ? null : price,
        currency
    };
}

/**
 * Validate Amazon URL
 * @param {string} url - URL to validate
 * @returns {Object} { isValid: boolean, error?: string }
 */
function validateAmazonUrl(url) {
    if (!url || typeof url !== 'string') {
        return { isValid: false, error: 'URL is required' };
    }

    const trimmedUrl = url.trim();

    // Check if it's an Amazon URL
    const amazonPattern = /^https?:\/\/(www\.)?(amazon\.(in|com|co\.uk|de|fr|es|it|ca|com\.au)|amzn\.(to|in|com))\//i;

    if (!amazonPattern.test(trimmedUrl)) {
        return {
            isValid: false,
            error: 'Please provide a valid Amazon URL (amazon.in or amazon.com)'
        };
    }

    return { isValid: true };
}

module.exports = {
    scrapeAmazonProduct,
    validateAmazonUrl,
    parsePrice,
    extractTitle,
    extractPrice
};
