/**
 * TrackIt - Amazon Price Tracker Telegram Bot
 * 
 * Main entry point for the application.
 * Initializes all components: database, bot, scheduler, and optional Express server.
 */

require('dotenv').config();

const express = require('express');
const { initializeDatabase } = require('./src/db');
const { initializeBot, stopBot } = require('./src/bot');
const { initializeScheduler, stopScheduler, triggerManualPriceCheck } = require('./src/scheduler');

// Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Main application bootstrap function
 * Initializes all application components in the correct order
 */
async function bootstrap() {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Starting TrackIt...');
    console.log(`📍 Environment: ${NODE_ENV}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        // Step 1: Initialize database
        console.log('\n📦 Initializing database...');
        await initializeDatabase();
        console.log('✅ Database initialized successfully');

        // Step 2: Initialize Telegram bot
        console.log('\n🤖 Initializing Telegram bot...');
        await initializeBot();

        // Step 3: Initialize scheduler for weekly price checks
        console.log('\n⏰ Initializing scheduler...');
        initializeScheduler();

        const dashboardRoutes = require('./src/api/dashboard.routes');

        // Step 4: Start Express server (for health checks and manual triggers)
        const app = express();
        app.use(express.json());

        // Enable CORS for frontend development
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });

        // Mount API routes
        app.use('/api', dashboardRoutes);

        // Health check endpoint
        app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                service: 'TrackIt',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // Root endpoint
        app.get('/', (req, res) => {
            res.json({
                service: 'TrackIt - Amazon Price Tracker',
                status: 'running',
                endpoints: {
                    health: '/health',
                    dashboard: '/api/dashboard/:userId',
                    triggerCheck: 'POST /trigger-check'
                }
            });
        });

        // Manual trigger endpoint (for testing)
        app.post('/trigger-check', async (req, res) => {
            console.log('📡 Manual price check triggered via API');
            try {
                // Run in background, don't wait
                triggerManualPriceCheck().catch(err => {
                    console.error('Price check error:', err);
                });
                res.json({
                    status: 'started',
                    message: 'Price check triggered. Check console for progress.'
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        app.listen(PORT, () => {
            console.log(`\n🌐 Health server running on http://localhost:${PORT}`);
            console.log('');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✨ TrackIt is ready!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('');
            console.log('📋 Available bot commands:');
            console.log('   /start  - Register and see welcome message');
            console.log('   /track  - Track an Amazon product');
            console.log('   /status - View tracked products');
            console.log('   /check  - Manually trigger price check');
            console.log('');
        });

    } catch (error) {
        console.error('❌ Failed to start TrackIt:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down TrackIt...');
    stopBot();
    stopScheduler();
    console.log('✅ Shutdown complete');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down TrackIt...');
    stopBot();
    stopScheduler();
    console.log('✅ Shutdown complete');
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    console.error(error.stack);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});

// Start the application
bootstrap();
