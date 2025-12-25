/**
 * Database Module - Main Entry Point
 * 
 * Exports database utilities and query functions.
 * Uses better-sqlite3 for synchronous SQLite operations.
 */

const { initializeDatabase, getDatabase, closeDatabase } = require('./connection');
const queries = require('./queries');

module.exports = {
    initializeDatabase,
    getDatabase,
    closeDatabase,
    queries
};
