/**
 * Scheduler Module - Main Entry Point
 * 
 * Initializes and manages cron jobs for scheduled tasks.
 */

const { initializeScheduler, stopScheduler } = require('./cronJobs');

module.exports = {
    initializeScheduler,
    stopScheduler
};
