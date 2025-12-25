/**
 * Scraper Module - Main Entry Point
 * 
 * Exports the Amazon product scraping functionality.
 */

const { scrapeAmazonProduct, validateAmazonUrl } = require('./amazon');

module.exports = {
    scrapeAmazonProduct,
    validateAmazonUrl
};
