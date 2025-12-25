/**
 * Cron Jobs Module
 * 
 * Defines and manages scheduled tasks using node-cron.
 * Scheduler runs daily and checks eligibility based on user's plan.
 */

const cron = require('node-cron');
const queries = require('../db/queries');
const { scrapeAmazonProduct } = require('../scraper');
const { sendMessage } = require('../bot');
const { getUserPlan, getCheckInterval } = require('../services/plans');

// Store cron job references for cleanup
const scheduledJobs = {};

// Statistics for the current run
let runStats = {
    lastRun: null,
    productsChecked: 0,
    productsSkipped: 0,
    priceDrops: 0,
    notificationsSent: 0,
    errors: 0
};

/**
 * Initialize all scheduled jobs
 * Separate jobs for DAILY and WEEKLY check intervals
 */
function initializeScheduler() {
    console.log('📅 Initializing scheduler...');

    // DAILY job - runs every day at 9 AM IST for PRO users
    const dailyCron = '0 9 * * *';
    scheduledJobs.dailyCheck = cron.schedule(dailyCron, async () => {
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⏰ Running DAILY price check (PRO users)...');
        console.log(`📅 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        await runPriceCheckByInterval('DAILY');
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });

    // WEEKLY job - runs every Sunday at 9 AM IST for FREE users
    const weeklyCron = '0 9 * * 0';
    scheduledJobs.weeklyCheck = cron.schedule(weeklyCron, async () => {
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⏰ Running WEEKLY price check (FREE users)...');
        console.log(`📅 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        await runPriceCheckByInterval('WEEKLY');
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });

    console.log('✅ Scheduler initialized:');
    console.log('   📅 DAILY job: Every day at 9 AM IST (PRO users)');
    console.log('   📅 WEEKLY job: Every Sunday at 9 AM IST (FREE users)');
}

/**
 * Check if a product is eligible for price check based on user's plan
 * @param {Object} user - User object with plan and check_interval
 * @param {Object} product - Product object with last_checked_at
 * @returns {Object} { eligible: boolean, reason: string }
 */
function isEligibleForCheck(user, product) {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Get user's plan configuration
    const plan = getUserPlan(user);
    const checkInterval = user?.check_interval || plan.checkInterval;

    // Get last check time
    const lastChecked = product.last_checked_at ? new Date(product.last_checked_at) : null;

    // Check based on interval
    switch (checkInterval.toUpperCase()) {
        case 'HOURLY':
            // Check if at least 1 hour has passed since last check
            if (lastChecked) {
                const hoursSinceCheck = (now - lastChecked) / (1000 * 60 * 60);
                if (hoursSinceCheck < 1) {
                    return { eligible: false, reason: 'Checked less than 1 hour ago' };
                }
            }
            return { eligible: true, reason: 'Hourly check eligible' };

        case 'DAILY':
            // Check if at least 20 hours have passed (to handle timing variations)
            if (lastChecked) {
                const hoursSinceCheck = (now - lastChecked) / (1000 * 60 * 60);
                if (hoursSinceCheck < 20) {
                    return { eligible: false, reason: 'Already checked today' };
                }
            }
            return { eligible: true, reason: 'Daily check eligible' };

        case 'WEEKLY':
        default:
            // Only check on Sundays (day 0)
            if (dayOfWeek !== 0) {
                return { eligible: false, reason: `Weekly check - waiting for Sunday (today is ${getDayName(dayOfWeek)})` };
            }

            // Check if already checked this week
            if (lastChecked) {
                const daysSinceCheck = (now - lastChecked) / (1000 * 60 * 60 * 24);
                if (daysSinceCheck < 6) {
                    return { eligible: false, reason: 'Already checked this week' };
                }
            }
            return { eligible: true, reason: 'Weekly check eligible (Sunday)' };
    }
}

/**
 * Get day name from day number
 * @param {number} day - Day of week (0-6)
 * @returns {string} Day name
 */
function getDayName(day) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
}

/**
 * Run price check for all active tracked products
 * Checks eligibility based on each user's plan before processing
 */
/**
 * Run price check for active tracked products
 * @param {string} [interval] - Optional: Filter by check interval (DAILY, WEEKLY)
 */
async function runPriceCheckByInterval(interval) {
    if (interval) {
        console.log(`🔍 Starting ${interval} price check...`);
    } else {
        console.log('🔍 Starting price check for ALL eligible products...');
    }

    // Reset stats
    runStats = {
        lastRun: new Date().toISOString(),
        productsChecked: 0,
        productsSkipped: 0,
        priceDrops: 0,
        notificationsSent: 0,
        errors: 0
    };

    try {
        // Get active tracked products (filtered by interval if provided)
        let products;
        if (interval) {
            products = await queries.getActiveTrackedProductsByInterval(interval);
        } else {
            products = await queries.getAllActiveTrackedProducts();
        }

        console.log(`📦 Found ${products.length} products to check`);
        console.log(`📦 Found ${products.length} total tracked products`);

        if (products.length === 0) {
            console.log('ℹ️ No products to check. Exiting.');
            return;
        }

        // Group products by user for efficient processing
        const productsByUser = {};
        for (const product of products) {
            if (!productsByUser[product.user_id]) {
                productsByUser[product.user_id] = {
                    user: {
                        id: product.user_id,
                        telegram_id: product.telegram_id,
                        plan: product.plan || 'FREE',
                        check_interval: product.check_interval || 'WEEKLY',
                        max_products: product.max_products || 1
                    },
                    products: []
                };
            }
            productsByUser[product.user_id].products.push(product);
        }

        console.log(`👥 Processing ${Object.keys(productsByUser).length} users`);

        // Process each user's products
        let productIndex = 0;
        for (const userId of Object.keys(productsByUser)) {
            const { user, products: userProducts } = productsByUser[userId];

            console.log(`\n👤 User ${user.telegram_id} (${user.plan} plan):`);

            for (const product of userProducts) {
                productIndex++;

                // Check eligibility
                const eligibility = isEligibleForCheck(user, product);

                if (!eligibility.eligible) {
                    console.log(`   ⏭️ #${product.id}: Skipped - ${eligibility.reason}`);
                    runStats.productsSkipped++;
                    continue;
                }

                console.log(`   🔍 #${product.id}: ${truncateTitle(product.title, 35)}`);

                try {
                    // Add delay between requests (3-5 seconds)
                    if (runStats.productsChecked > 0) {
                        const delayMs = 3000 + Math.random() * 2000;
                        await delay(delayMs);
                    }

                    // Scrape current price with retry
                    const scrapedData = await scrapeWithRetry(product.amazon_url, 1);

                    if (!scrapedData || !scrapedData.price) {
                        console.log(`      ⚠️ Could not get price, skipping...`);
                        runStats.errors++;
                        continue;
                    }

                    const newPrice = scrapedData.price;
                    const oldPrice = product.current_price;

                    console.log(`      💰 ${formatCurrency(oldPrice, product.currency)} → ${formatCurrency(newPrice, product.currency)}`);

                    // Update database with new price
                    await queries.updateProductPrice(product.id, newPrice, scrapedData.title);

                    // Record price history
                    await queries.addPriceHistory(product.id, newPrice);

                    runStats.productsChecked++;

                    // Determine if we should send a notification
                    const shouldNotify = shouldSendNotification(product, oldPrice, newPrice);

                    if (shouldNotify.notify) {
                        runStats.priceDrops++;
                        console.log(`      🎉 ${shouldNotify.reason}`);

                        // Send notification to user
                        try {
                            await sendPriceDropNotification(product, oldPrice, newPrice, shouldNotify.reason);

                            // Record alert status to avoid duplicate notifications
                            await queries.updateAlertStatus(product.id, newPrice);

                            runStats.notificationsSent++;
                        } catch (notifyError) {
                            // Log but don't expose to user
                            console.error(`      ⚠️ Notification failed (logged): ${notifyError.message}`);
                        }
                    }

                } catch (error) {
                    // Log error but continue with next product - never halt the loop
                    runStats.errors++;
                    console.error(`      ⚠️ Error (continuing): ${error.message}`);
                    // Don't throw - continue to next product
                }
            }
        }

        // Log summary
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Price check completed!');
        console.log(`   📊 Products checked: ${runStats.productsChecked}`);
        console.log(`   ⏭️ Products skipped: ${runStats.productsSkipped}`);
        console.log(`   📉 Price drops found: ${runStats.priceDrops}`);
        console.log(`   📨 Notifications sent: ${runStats.notificationsSent}`);
        console.log(`   ❌ Errors: ${runStats.errors}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (error) {
        console.error('❌ Price check failed:', error.message);
    }
}

/**
 * Determine if a notification should be sent
 * Skips alerts if already notified at same or lower price
 * @param {Object} product - Product from database
 * @param {number} oldPrice - Previous price
 * @param {number} newPrice - Current scraped price
 * @returns {Object} { notify: boolean, reason: string }
 */
function shouldSendNotification(product, oldPrice, newPrice) {
    if (!newPrice || !oldPrice) {
        return { notify: false, reason: '' };
    }

    // Skip if already alerted at this price or lower
    if (product.last_alert_price && newPrice >= product.last_alert_price) {
        return {
            notify: false,
            reason: `Already alerted at ${formatCurrency(product.last_alert_price, product.currency)}`
        };
    }

    // Case 1: Target price is set and current price is at or below target
    if (product.target_price && newPrice <= product.target_price) {
        return {
            notify: true,
            reason: `Target price reached! (Target: ${formatCurrency(product.target_price, product.currency)})`
        };
    }

    // Case 2: No target price, but price dropped compared to last known price
    if (!product.target_price && newPrice < oldPrice) {
        const dropPercentage = ((oldPrice - newPrice) / oldPrice * 100).toFixed(1);
        return {
            notify: true,
            reason: `Price dropped by ${dropPercentage}%`
        };
    }

    // Case 3: Target price set but not reached, but price still dropped significantly
    if (product.target_price && newPrice < oldPrice) {
        const dropPercentage = ((oldPrice - newPrice) / oldPrice * 100).toFixed(1);
        if (parseFloat(dropPercentage) >= 5) {
            return {
                notify: true,
                reason: `Price dropped by ${dropPercentage}% (still above target)`
            };
        }
    }

    return { notify: false, reason: '' };
}

/**
 * Send price drop notification to user via Telegram
 */
async function sendPriceDropNotification(product, oldPrice, newPrice, reason) {
    const currencySymbol = getCurrencySymbol(product.currency);
    const savings = oldPrice - newPrice;
    const savingsPercent = ((savings / oldPrice) * 100).toFixed(1);

    const message = `
🎉 <b>Price Drop Alert!</b>

📦 <b>${truncateTitle(product.title, 100)}</b>

💰 <b>Was:</b> <s>${currencySymbol}${formatPrice(oldPrice)}</s>
💰 <b>Now:</b> <b>${currencySymbol}${formatPrice(newPrice)}</b>
💵 <b>You Save:</b> ${currencySymbol}${formatPrice(savings)} (${savingsPercent}% off)

${product.target_price ? `🎯 <b>Your Target:</b> ${currencySymbol}${formatPrice(product.target_price)}` : ''}

📌 <i>${reason}</i>

🛒 <a href="${product.amazon_url}">Buy Now on Amazon</a>
    `.trim();

    await sendMessage(product.telegram_id, message);
    console.log(`      📨 Notification sent to user ${product.telegram_id}`);
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function getCurrencySymbol(currency) {
    const symbols = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥' };
    return symbols[currency] || currency;
}

function formatCurrency(price, currency) {
    if (price === null || price === undefined) return 'N/A';
    return `${getCurrencySymbol(currency)}${formatPrice(price)}`;
}

function formatPrice(price) {
    if (price === null || price === undefined) return 'N/A';
    return price.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function truncateTitle(title, maxLength = 50) {
    if (!title) return 'Unknown Product';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + '...';
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scrape with retry logic
 * @param {string} url - Amazon URL to scrape
 * @param {number} retries - Number of retries (default 1)
 * @returns {Object|null} Scraped data or null on failure
 */
async function scrapeWithRetry(url, retries = 1) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            if (attempt > 0) {
                console.log(`      🔄 Retry attempt ${attempt}...`);
                await delay(2000 + Math.random() * 1000); // Wait before retry
            }

            const result = await scrapeAmazonProduct(url);

            if (result && result.price) {
                return result;
            }

            lastError = new Error('No price found in scraped data');

        } catch (error) {
            lastError = error;
            console.log(`      ⚠️ Scrape attempt ${attempt + 1} failed: ${error.message}`);
        }
    }

    // All retries exhausted
    console.log(`      ❌ All scrape attempts failed`);
    return null;
}

function stopScheduler() {
    console.log('⏹️ Stopping scheduler...');
    for (const [name, job] of Object.entries(scheduledJobs)) {
        if (job) {
            job.stop();
            console.log(`   Stopped job: ${name}`);
        }
    }
}

async function triggerManualPriceCheck() {
    console.log('🔧 Manual price check triggered');
    await runPriceCheckByInterval();
}

function getLastRunStats() {
    return { ...runStats };
}

module.exports = {
    initializeScheduler,
    stopScheduler,
    triggerManualPriceCheck,
    getLastRunStats,
    runPriceCheck: runPriceCheckByInterval,
    isEligibleForCheck
};
