/**
 * Telegram Bot Commands
 * 
 * Contains all command handler implementations.
 * Each handler processes a specific bot command.
 */

const queries = require('../db/queries');
const { scrapeAmazonProduct, validateAmazonUrl } = require('../scraper/amazon');
const { getUserPlan, canUserTrackMore, PLANS } = require('../services/plans');
const { validateAction, formatValidationMessage } = require('../services/planGuard');

const { mainMenuKeyboard, withNavigation, productListKeyboard } = require('./keyboards');

// ... (rest of imports)

// ===========================================
// /start COMMAND
// ===========================================

/**
 * Handle /start command
 * Registers new user and shows welcome message
 * @param {TelegramBot} bot - Bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleStart(bot, msg) {
    const chatId = msg.chat.id;
    const user = msg.from;

    try {
        // Register/update user in database
        const dbUser = await queries.upsertUser({
            telegramId: user.id,
            username: user.username || null,
            firstName: user.first_name || null,
            lastName: user.last_name || null,
            languageCode: user.language_code || 'en'
        });

        console.log(`👤 User registered/updated: ${user.username || user.id} (DB ID: ${dbUser.id})`);

        const welcomeMessage = `
🎉 <b>Welcome to TrackIt!</b>

I help you track Amazon product prices and notify you when they drop.

<b>🔍 What I do:</b>
• Monitor Amazon product prices
• Alert you when prices drop
• Save you money on your purchases!

<b>📝 How to use:</b>
1️⃣ Click <b>➕ Track Product</b> below
   OR send an Amazon link directly

2️⃣ I'll fetch the current price and start tracking

3️⃣ Get notified when the price drops!

<b>⚡ Your Plan:</b>
🆓 Free - Track <b>${PLANS.FREE.maxProducts} product</b>
⭐ Pro - Track up to <b>${PLANS.PRO.maxProducts} products</b> with daily checks
        `.trim();

        // Check if we can edit the message (for Back navigation)
        if (msg.message_id && msg.from.is_bot === false) {
            try {
                await bot.editMessageText(welcomeMessage, {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    parse_mode: 'HTML',
                    ...mainMenuKeyboard
                });
                return;
            } catch (err) {
                // Ignore edit error, fall back to send
            }
        }

        await bot.sendMessage(chatId, welcomeMessage, {
            parse_mode: 'HTML',
            ...mainMenuKeyboard
        });

    } catch (error) {

        console.error('Error in /start command:', error);
        await bot.sendMessage(chatId, '❌ Something went wrong. Please try again later.');
    }
}

// ===========================================
// /track COMMAND
// ===========================================

/**
 * Handle /track command
 * Adds a new Amazon product to tracking list
 * @param {TelegramBot} bot - Bot instance
 * @param {Object} msg - Telegram message object
 * @param {Array} match - Regex match result
 */
async function handleTrack(bot, msg, match) {
    const chatId = msg.chat.id;
    const user = msg.from;
    const url = match[1]?.trim();

    try {
        // Validate URL is provided
        if (!url) {
            await bot.sendMessage(chatId,
                '⚠️ Please provide an Amazon URL.\n\n' +
                '<b>Usage:</b> <code>/track &lt;amazon-url&gt;</code>\n\n' +
                '<b>Example:</b>\n<code>/track https://amazon.in/dp/B08N5WRWNW</code>',
                { parse_mode: 'HTML' }
            );
            return;
        }

        // Validate Amazon URL format
        const validation = validateAmazonUrl(url);
        if (!validation.isValid) {
            await bot.sendMessage(chatId,
                `⚠️ ${validation.error}\n\n` +
                'Please provide a valid Amazon.in or Amazon.com product link.',
                { parse_mode: 'HTML' }
            );
            return;
        }

        // Get or create user
        let dbUser = await queries.findUserByTelegramId(user.id);
        if (!dbUser) {
            dbUser = await queries.upsertUser({
                telegramId: user.id,
                username: user.username || null,
                firstName: user.first_name || null,
                lastName: user.last_name || null,
                languageCode: user.language_code || 'en'
            });
        }

        // Check product limit based on user's plan
        const currentCount = await queries.countUserTrackedProducts(dbUser.id);
        const planValidation = validateAction(dbUser, 'TRACK_PRODUCT', { currentProductCount: currentCount });

        if (!planValidation.allowed) {
            const message = formatValidationMessage(planValidation);
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            return;
        }

        // Send "processing" message
        const processingMsg = await bot.sendMessage(chatId,
            '🔍 <b>Fetching product details...</b>\n\nPlease wait while I scrape the Amazon page.',
            { parse_mode: 'HTML' }
        );

        // Scrape product details
        let productData;
        try {
            productData = await scrapeAmazonProduct(url);
        } catch (scrapeError) {
            await bot.editMessageText(
                `❌ <b>Failed to fetch product</b>\n\n${scrapeError.message}\n\n` +
                `Please make sure:\n` +
                `• The URL is a valid Amazon product page\n` +
                `• The product is in stock\n` +
                `• Try again in a few minutes`,
                { chat_id: chatId, message_id: processingMsg.message_id, parse_mode: 'HTML' }
            );
            return;
        }

        // Determine currency symbol
        const currencySymbol = productData.currency === 'INR' ? '₹' :
            productData.currency === 'USD' ? '$' :
                productData.currency === 'EUR' ? '€' :
                    productData.currency === 'GBP' ? '£' : productData.currency;

        // Save to database
        const savedProduct = await queries.createTrackedProduct({
            userId: dbUser.id,
            amazonUrl: url,
            title: productData.title,
            currentPrice: productData.price,
            currency: productData.currency
        });

        console.log(`📦 Product tracked: "${productData.title.substring(0, 30)}..." by ${user.username || user.id}`);

        // Send success message
        const successMessage = `
✅ <b>Product Added to Tracking!</b>

📦 <b>Product:</b>
${truncateTitle(productData.title, 100)}

💰 <b>Current Price:</b> ${currencySymbol}${formatPrice(productData.price)}

🎯 <b>Target Price:</b> Not set
<i>Use /setprice ${savedProduct.id} &lt;price&gt; to set alert price</i>

📊 <b>Product ID:</b> #${savedProduct.id}

⏰ <b>Auto-check:</b> Every Sunday at 9 AM IST
<i>Use /check to manually check prices anytime</i>

<i>I'll notify you when the price drops!</i>
        `;

        await bot.editMessageText(successMessage, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'HTML'
        });

    } catch (error) {
        console.error('Error in /track command:', error);
        await bot.sendMessage(chatId, '❌ Failed to track product. Please try again.');
    }
}

// ===========================================
// /setprice COMMAND
// ===========================================

/**
 * Handle /setprice command
 * Sets target price for a tracked product
 * @param {TelegramBot} bot - Bot instance
 * @param {Object} msg - Telegram message object
 * @param {Array} match - Regex match result
 */
async function handleSetPrice(bot, msg, match) {
    const chatId = msg.chat.id;
    const user = msg.from;
    const args = match[1]?.trim().split(/\s+/);

    try {
        // Validate arguments
        if (!args || args.length < 2 || !args[0] || !args[1]) {
            await bot.sendMessage(chatId,
                '⚠️ Please provide product ID and target price.\n\n' +
                '<b>Usage:</b> <code>/setprice &lt;id&gt; &lt;price&gt;</code>\n\n' +
                '<b>Example:</b> <code>/setprice 1 999</code>\n\n' +
                'Use /status to see your product IDs.',
                { parse_mode: 'HTML' }
            );
            return;
        }

        const productId = parseInt(args[0]);
        const targetPrice = parseFloat(args[1]);

        // Validate inputs
        if (isNaN(productId) || productId <= 0) {
            await bot.sendMessage(chatId, '⚠️ Invalid product ID. Use /status to see your products.');
            return;
        }

        if (isNaN(targetPrice) || targetPrice <= 0) {
            await bot.sendMessage(chatId, '⚠️ Invalid price. Please enter a positive number.');
            return;
        }

        // Get user
        const dbUser = await queries.findUserByTelegramId(user.id);
        if (!dbUser) {
            await bot.sendMessage(chatId, '⚠️ Please use /start first to register.');
            return;
        }

        // Get user's products to verify ownership
        const products = await queries.getTrackedProductsByUserId(dbUser.id);
        const product = products.find(p => p.id === productId);

        if (!product) {
            await bot.sendMessage(chatId,
                '⚠️ Product not found or you don\'t have permission to modify it.\n\n' +
                'Use /status to see your tracked products.'
            );
            return;
        }

        // Update target price
        await queries.updateTargetPrice(productId, targetPrice);

        const currencySymbol = product.currency === 'INR' ? '₹' :
            product.currency === 'USD' ? '$' : product.currency;

        await bot.sendMessage(chatId,
            `✅ <b>Target Price Set!</b>\n\n` +
            `📦 ${truncateTitle(product.title, 60)}\n\n` +
            `💰 Current: ${currencySymbol}${formatPrice(product.current_price)}\n` +
            `🎯 Target: ${currencySymbol}${formatPrice(targetPrice)}\n\n` +
            `<i>You'll be notified when the price drops to ${currencySymbol}${formatPrice(targetPrice)} or below!</i>`,
            { parse_mode: 'HTML' }
        );

        console.log(`🎯 Target price set: Product #${productId} -> ${currencySymbol}${targetPrice}`);

    } catch (error) {
        console.error('Error in /setprice command:', error);
        await bot.sendMessage(chatId, '❌ Failed to set price. Please try again.');
    }
}

// ===========================================
// /status COMMAND
// ===========================================

/**
 * Handle /status command
 * Shows all tracked products for the user
 * @param {TelegramBot} bot - Bot instance
 * @param {Object} msg - Telegram message object
 */
/**
 * Handle /status command
 * Shows all tracked products for the user (paginated)
 * @param {TelegramBot} bot - Bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleStatus(bot, msg) {
    const chatId = msg.chat.id;
    const user = msg.from;

    // Call helper with page 1
    await showProductList(bot, chatId, user.id, 1, null, user);
}

/**
 * Show product list with pagination
 * @param {TelegramBot} bot - Bot instance
 * @param {number} chatId - Chat ID
 * @param {number} userId - Telegram User ID
 * @param {number} page - Page number
 * @param {number} messageId - Message ID to edit (optional)
 * @param {Object} userObj - User object for logging (optional)
 */
async function showProductList(bot, chatId, userId, page = 1, messageId = null, userObj = {}) {
    try {
        // Get user
        const dbUser = await queries.findUserByTelegramId(userId);
        if (!dbUser) {
            await bot.sendMessage(chatId,
                '⚠️ You haven\'t registered yet.\n\nUse /start to begin!'
            );
            return;
        }

        // Get user's plan info
        const plan = getUserPlan(dbUser);
        const products = await queries.getTrackedProductsByUserId(dbUser.id);
        const trackCheck = canUserTrackMore(dbUser, products.length);

        if (products.length === 0) {
            await bot.sendMessage(chatId,
                `📋 <b>Your Tracked Products</b>\n\n` +
                `${plan.displayName} • ${trackCheck.current}/${trackCheck.limit} products\n\n` +
                `<i>You're not tracking any products yet.</i>\n\n` +
                `Use <code>/track &lt;amazon-url&gt;</code> to add your first product!`,
                {
                    parse_mode: 'HTML',
                    ...withNavigation(null, true, true)
                }
            );
            return;
        }

        // Pagination basics
        const pageSize = 3;
        const totalPages = Math.ceil(products.length / pageSize);

        // Ensure valid page
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pageProducts = products.slice(start, end);

        // Format product list
        let message = `📋 <b>Your Tracked Products</b> (Page ${page}/${totalPages})\n\n`;
        message += `${plan.displayName} • ${trackCheck.current}/${trackCheck.limit} products\n`;
        message += `⏰ Check frequency: ${plan.checkInterval.toLowerCase()}\n\n`;

        for (const product of pageProducts) {
            const currencySymbol = product.currency === 'INR' ? '₹' :
                product.currency === 'USD' ? '$' : product.currency;

            message += `<b>#${product.id}</b> ${truncateTitle(product.title, 40)}\n`;
            message += `💰 Price: ${currencySymbol}${formatPrice(product.current_price)}`;

            if (product.target_price) {
                message += ` | 🎯 Target: ${currencySymbol}${formatPrice(product.target_price)}`;
            }
            message += '\n';
        }

        message += `\n<i>Use buttons below to manage products</i>`;

        // Add upgrade hint for free users (only on last page)
        if (plan.id === 'FREE' && !trackCheck.canTrack && page === totalPages) {
            message += `\n\n⭐ <b>Upgrade to Pro</b> for more products & daily checks!`;
        }

        const keyboard = productListKeyboard(products, page, pageSize);

        if (messageId) {
            try {
                await bot.editMessageText(message, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    ...keyboard
                });
                return;
            } catch (err) {
                // Ignore edit error
            }
        }

        // Send new message if no ID or edit failed
        if (!messageId) {
            await bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                ...keyboard
            });
        }

        if (userObj.username || userObj.id) {
            console.log(`📊 Status shown for: ${userObj.username || userObj.id} (Page ${page})`);
        }

    } catch (error) {
        console.error('Error in showProductList:', error);
        await bot.sendMessage(chatId, '❌ Failed to fetch status. Please try again.');
    }
}

// ===========================================
// /help COMMAND
// ===========================================

/**
 * Handle /help command
 * Shows help information
 * @param {TelegramBot} bot - Bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleHelp(bot, msg) {
    const chatId = msg.chat.id;

    const helpMessage = `
📚 <b>TrackIt Help</b>

<b>🔹 Commands:</b>

/start - Initialize the bot & register
/track <code>&lt;url&gt;</code> - Track an Amazon product
/setprice <code>&lt;id&gt; &lt;price&gt;</code> - Set target price alert
/status - View your tracked products
/check - Manually check prices now
/delete <code>&lt;id&gt;</code> - Remove a tracked product
/help - Show this message

<b>🔹 How it works:</b>
1. Send me an Amazon product URL with /track
2. I'll fetch the current price and start monitoring
3. Set your target price with /setprice
4. Get notified when the price drops!

<b>🔹 Automatic Checks:</b>
• Prices are checked weekly (every Sunday at 9 AM IST)
• Use /check to trigger a manual check anytime

<b>🔹 Supported Sites:</b>
• Amazon.in 🇮🇳
• Amazon.com 🇺🇸

<b>🔹 Free Plan Limits:</b>
• Track up to ${FREE_PRODUCT_LIMIT} product
• Weekly price checks

<i>💡 Tip: Track products before sales for maximum savings!</i>
    `;

    const helpKeyboard = withNavigation(mainMenuKeyboard, true, true);

    if (msg.message_id && msg.from.is_bot === false) {
        try {
            await bot.editMessageText(helpMessage, {
                chat_id: chatId,
                message_id: msg.message_id,
                parse_mode: 'HTML',
                ...helpKeyboard
            });
            return;
        } catch (err) {
            // Ignore edit error
        }
    }

    await bot.sendMessage(chatId, helpMessage, {
        parse_mode: 'HTML',
        ...helpKeyboard
    });
}

// ===========================================
// /delete COMMAND
// ===========================================

/**
 * Handle /delete command
 * Removes a product from tracking
 * @param {TelegramBot} bot - Bot instance
 * @param {Object} msg - Telegram message object
 * @param {Array} match - Regex match result
 */
async function handleDelete(bot, msg, match) {
    const chatId = msg.chat.id;
    const user = msg.from;
    const productIdStr = match[1]?.trim();

    try {
        if (!productIdStr) {
            await bot.sendMessage(chatId,
                '⚠️ Please provide the product ID to delete.\n\n' +
                '<b>Usage:</b> <code>/delete &lt;id&gt;</code>\n\n' +
                'Use /status to see your product IDs.',
                { parse_mode: 'HTML' }
            );
            return;
        }

        const productId = parseInt(productIdStr);

        if (isNaN(productId) || productId <= 0) {
            await bot.sendMessage(chatId, '⚠️ Invalid product ID.');
            return;
        }

        // Get user
        const dbUser = await queries.findUserByTelegramId(user.id);
        if (!dbUser) {
            await bot.sendMessage(chatId, '⚠️ Please use /start first to register.');
            return;
        }

        // Delete product
        const deleted = await queries.deleteTrackedProduct(productId, dbUser.id);

        if (deleted) {
            await bot.sendMessage(chatId,
                `✅ <b>Product #${productId} removed from tracking.</b>\n\n` +
                `You can now track a new product with /track`,
                { parse_mode: 'HTML' }
            );
            console.log(`🗑️ Product #${productId} deleted by ${user.username || user.id}`);
        } else {
            await bot.sendMessage(chatId,
                '⚠️ Product not found or you don\'t have permission to delete it.\n\n' +
                'Use /status to see your tracked products.'
            );
        }

    } catch (error) {
        console.error('Error in /delete command:', error);
        await bot.sendMessage(chatId, '❌ Failed to delete product. Please try again.');
    }
}

// ===========================================
// /check COMMAND
// ===========================================

/**
 * Handle /check command
 * Manually triggers price check for user's products
 * @param {TelegramBot} bot - Bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleCheck(bot, msg) {
    const chatId = msg.chat.id;
    const user = msg.from;

    try {
        // Get user
        const dbUser = await queries.findUserByTelegramId(user.id);
        if (!dbUser) {
            await bot.sendMessage(chatId, '⚠️ Please use /start first to register.');
            return;
        }

        // Get tracked products
        const products = await queries.getTrackedProductsByUserId(dbUser.id);

        if (products.length === 0) {
            await bot.sendMessage(chatId,
                '📋 You\'re not tracking any products yet.\n\n' +
                'Use /track to add a product first!',
                {
                    parse_mode: 'HTML',
                    ...mainMenuKeyboard
                }
            );
            return;
        }

        // Send processing message
        const processingMsg = await bot.sendMessage(chatId,
            `🔍 <b>Checking prices for ${products.length} product(s)...</b>\n\nThis may take a moment.`,
            { parse_mode: 'HTML' }
        );

        let results = [];

        for (const product of products) {
            try {
                // Add delay between requests
                if (results.length > 0) {
                    await new Promise(r => setTimeout(r, 2000));
                }

                // Scrape current price
                const scraped = await scrapeAmazonProduct(product.amazon_url);
                const oldPrice = product.current_price;
                const newPrice = scraped.price;

                // Update database
                await queries.updateProductPrice(product.id, newPrice, scraped.title);

                // Record price history
                await queries.addPriceHistory(product.id, newPrice);

                const currencySymbol = product.currency === 'INR' ? '₹' :
                    product.currency === 'USD' ? '$' : product.currency;

                // Determine price change
                let priceChange = '';
                if (newPrice < oldPrice) {
                    const drop = ((oldPrice - newPrice) / oldPrice * 100).toFixed(1);
                    priceChange = `📉 -${drop}%`;
                } else if (newPrice > oldPrice) {
                    const increase = ((newPrice - oldPrice) / oldPrice * 100).toFixed(1);
                    priceChange = `📈 +${increase}%`;
                } else {
                    priceChange = '➡️ No change';
                }

                results.push({
                    success: true,
                    product: product,
                    oldPrice,
                    newPrice,
                    priceChange,
                    currencySymbol
                });

            } catch (error) {
                results.push({
                    success: false,
                    product: product,
                    error: error.message
                });
            }
        }

        // Build results message
        let message = `✅ <b>Price Check Complete!</b>\n\n`;

        for (const result of results) {
            if (result.success) {
                message += `<b>#${result.product.id}</b> ${truncateTitle(result.product.title, 40)}\n`;
                message += `${result.currencySymbol}${formatPrice(result.oldPrice)} → ${result.currencySymbol}${formatPrice(result.newPrice)} ${result.priceChange}\n\n`;
            } else {
                message += `<b>#${result.product.id}</b> ❌ Failed\n${result.error}\n\n`;
            }
        }

        // Check for price drops that hit target
        const drops = results.filter(r =>
            r.success &&
            r.product.target_price &&
            r.newPrice <= r.product.target_price
        );

        if (drops.length > 0) {
            message += `🎉 <b>${drops.length} product(s) hit your target price!</b>\n`;
        }

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'HTML',
            ...mainMenuKeyboard
        });

        console.log(`🔍 Manual check by ${user.username || user.id}: ${results.filter(r => r.success).length}/${products.length} successful`);

    } catch (error) {
        console.error('Error in /check command:', error);
        await bot.sendMessage(chatId, '❌ Failed to check prices. Please try again.');
    }
}

// ===========================================
// /plans COMMAND
// ===========================================

/**
 * Handle /plans command
 * Shows plan comparison
 * @param {TelegramBot} bot - Bot instance
 * @param {Object} msg - Telegram message object
 */
async function handlePlans(bot, msg) {
    const chatId = msg.chat.id;
    const user = msg.from;

    try {
        // Get user's current plan
        const dbUser = await queries.findUserByTelegramId(user.id);
        const currentPlan = dbUser?.plan || 'FREE';

        const plansMessage = `
📋 <b>TrackIt Plans</b>

${currentPlan === 'FREE' ? '👉 ' : ''}🆓 <b>FREE Plan</b> ${currentPlan === 'FREE' ? '(Current)' : ''}
━━━━━━━━━━━━━━━━━━
📦 Track <b>1 product</b>
⏰ Weekly price checks (Sundays)
🔔 Price drop alerts
💰 Price: <b>Free forever</b>

${currentPlan === 'PRO' ? '👉 ' : ''}⭐ <b>PRO Plan</b> ${currentPlan === 'PRO' ? '(Current)' : ''}
━━━━━━━━━━━━━━━━━━
📦 Track up to <b>10 products</b>
⏰ <b>Daily</b> price checks
🔔 Priority notifications
📊 Price history tracking
🎯 Target price alerts
💰 Price: <b>₹99/month</b>

${currentPlan === 'FREE' ? `\n⭐ <b>Ready to upgrade?</b>\nUse /upgrade to switch to PRO!\n\n<i>🎁 Demo mode: Upgrade is free for testing!</i>` : `\n✅ You're on the PRO plan!\n<i>Enjoy daily price checks and 10 product slots.</i>`}
        `.trim();

        await bot.sendMessage(chatId, plansMessage, {
            parse_mode: 'HTML',
            ...mainMenuKeyboard
        });

    } catch (error) {
        console.error('Error in /plans command:', error);
        await bot.sendMessage(chatId, '❌ Failed to fetch plans. Please try again.');
    }
}

// ===========================================
// /upgrade COMMAND
// ===========================================

/**
 * Handle /upgrade command
 * Switches user to PRO plan (demo mode - no payment)
 * @param {TelegramBot} bot - Bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleUpgrade(bot, msg) {
    const chatId = msg.chat.id;
    const user = msg.from;

    try {
        // Get user
        let dbUser = await queries.findUserByTelegramId(user.id);
        if (!dbUser) {
            await bot.sendMessage(chatId, '⚠️ Please use /start first to register.');
            return;
        }

        // Check if already PRO
        if (dbUser.plan === 'PRO') {
            await bot.sendMessage(chatId,
                '⭐ <b>You\'re already on the PRO plan!</b>\n\n' +
                '📦 Track up to 10 products\n' +
                '⏰ Daily price checks\n\n' +
                'Use /status to see your tracked products.',
                {
                    parse_mode: 'HTML',
                    ...mainMenuKeyboard
                }
            );
            return;
        }

        // Upgrade to PRO (demo mode)
        await queries.upgradeUserPlan(dbUser.id, 'PRO', 10, 'DAILY');

        console.log(`⭐ User upgraded to PRO: ${user.username || user.id}`);

        const successMessage = `
🎉 <b>Welcome to PRO!</b>

Your account has been upgraded successfully.

✅ <b>Your new benefits:</b>
📦 Track up to <b>10 products</b> (was 1)
⏰ <b>Daily</b> price checks (was weekly)
🔔 Priority notifications
📊 Price history tracking

<i>🎁 Demo mode: This upgrade is free for testing purposes.</i>

<b>What's next?</b>
• Use /track to add more products
• Use /status to see your dashboard
• Use /check to test daily price checking
        `.trim();

        const upgradeKeyboard = withNavigation(null, true, true);

        if (msg.message_id && msg.from.is_bot === false) {
            try {
                await bot.editMessageText(successMessage, {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    parse_mode: 'HTML',
                    ...upgradeKeyboard
                });
                return;
            } catch (err) { }
        }

        await bot.sendMessage(chatId, successMessage, {
            parse_mode: 'HTML',
            ...upgradeKeyboard
        });

    } catch (error) {
        console.error('Error in /upgrade command:', error);
        await bot.sendMessage(chatId, '❌ Failed to upgrade. Please try again.');
    }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Truncate title to specified length
 * @param {string} title - Product title
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated title
 */
function truncateTitle(title, maxLength = 50) {
    if (!title) return 'Unknown Product';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength - 3) + '...';
}

/**
 * Format price with proper decimals
 * @param {number} price - Price value
 * @returns {string} Formatted price
 */
function formatPrice(price) {
    if (price === null || price === undefined) return 'N/A';
    return price.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ===========================================
// /downgrade COMMAND
// ===========================================

/**
 * Handle /downgrade command
 * Resets user to FREE plan and enforces product limits
 * @param {TelegramBot} bot - Bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleDowngrade(bot, msg) {
    const chatId = msg.chat.id;
    const user = msg.from;

    try {
        // Get user
        const dbUser = await queries.findUserByTelegramId(user.id);
        if (!dbUser) {
            await bot.sendMessage(chatId, '⚠️ Please use /start first to register.');
            return;
        }

        // Check if already FREE
        if (dbUser.plan === 'FREE' || !dbUser.plan) {
            await bot.sendMessage(chatId,
                '🆓 <b>You\'re already on the FREE plan!</b>\n\n' +
                'Use /plans to see available plans.',
                {
                    parse_mode: 'HTML',
                    ...mainMenuKeyboard
                }
            );
            return;
        }

        // Get current tracked products
        const products = await queries.getTrackedProductsByUserId(dbUser.id);
        const freeLimit = PLANS.FREE.maxProducts;

        // Check if user has more products than FREE limit allows
        if (products.length > freeLimit) {
            // Warn user about product deletion
            const toDelete = products.length - freeLimit;
            const keepProducts = products.slice(0, freeLimit); // Keep oldest (first in list by created_at DESC means newest, so we keep from end)
            const deleteProducts = products.slice(freeLimit);

            // Actually, products are ordered by created_at DESC, so oldest are at the end
            // Let's keep the oldest ones (last in the array)
            const sortedByAge = [...products].sort((a, b) =>
                new Date(a.created_at) - new Date(b.created_at)
            );
            const productsToKeep = sortedByAge.slice(0, freeLimit);
            const productsToDelete = sortedByAge.slice(freeLimit);

            // Delete excess products
            for (const p of productsToDelete) {
                await queries.deleteTrackedProduct(p.id, dbUser.id);
            }

            // Downgrade plan
            await queries.downgradeUserPlan(dbUser.id);

            let message = `⬇️ <b>Downgraded to FREE Plan</b>\n\n`;
            message += `Your account has been downgraded.\n\n`;
            message += `⚠️ <b>Products Removed:</b>\n`;

            for (const p of productsToDelete) {
                message += `• #${p.id} ${truncateTitle(p.title, 40)}\n`;
            }

            message += `\n✅ <b>Products Kept (oldest ${freeLimit}):</b>\n`;
            for (const p of productsToKeep) {
                message += `• #${p.id} ${truncateTitle(p.title, 40)}\n`;
            }

            message += `\n📋 <b>FREE Plan Limits:</b>\n`;
            message += `• Track ${freeLimit} product\n`;
            message += `• Weekly price checks\n\n`;
            message += `<i>Use /upgrade anytime to get PRO features back!</i>`;

            const downgradeKeyboard = withNavigation(null, true, true);

            // Edit if callback
            if (msg.message_id && msg.from.is_bot === false) {
                try {
                    await bot.editMessageText(message, {
                        chat_id: chatId,
                        message_id: msg.message_id,
                        parse_mode: 'HTML',
                        ...downgradeKeyboard
                    });
                    console.log(`⬇️ User downgraded: ${user.username || user.id}, deleted ${productsToDelete.length} products`);
                    return;
                } catch (err) { }
            }

            await bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                ...downgradeKeyboard
            });

            console.log(`⬇️ User downgraded: ${user.username || user.id}, deleted ${productsToDelete.length} products`);

        } else {
            // No products to delete, just downgrade
            await queries.downgradeUserPlan(dbUser.id);

            const message = `
⬇️ <b>Downgraded to FREE Plan</b>

Your account has been downgraded successfully.

📋 <b>FREE Plan Limits:</b>
• Track ${freeLimit} product
• Weekly price checks (Sundays)

Your ${products.length} tracked product(s) have been kept.

<i>Use /upgrade anytime to get PRO features back!</i>
            `.trim();

            const downgradeKeyboard = withNavigation(null, true, true);

            if (msg.message_id && msg.from.is_bot === false) {
                try {
                    await bot.editMessageText(message, {
                        chat_id: chatId,
                        message_id: msg.message_id,
                        parse_mode: 'HTML',
                        ...downgradeKeyboard
                    });
                    console.log(`⬇️ User downgraded: ${user.username || user.id}`);
                    return;
                } catch (err) { }
            }

            await bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                ...downgradeKeyboard
            });

            console.log(`⬇️ User downgraded: ${user.username || user.id}`);
        }

    } catch (error) {
        console.error('Error in /downgrade command:', error);
        await bot.sendMessage(chatId, '❌ Failed to downgrade. Please try again.');
    }
}

/**
 * Handle CHECK callback
 * Checks price for a specific product and refreshes list
 * @param {TelegramBot} bot 
 * @param {Object} msg 
 * @param {number} productId 
 * @param {number} page 
 */
async function handleCheckCallback(bot, msg, productId, page) {
    const chatId = msg.chat.id;
    const user = msg.from;

    try {
        const dbUser = await queries.findUserByTelegramId(user.id);
        if (!dbUser) return;

        // Verify ownership
        const products = await queries.getTrackedProductsByUserId(dbUser.id);
        const product = products.find(p => p.id === productId);

        if (!product) {
            await bot.answerCallbackQuery(msg.id, { text: '❌ Product not found', show_alert: true });
            return;
        }

        // Notify processing
        await bot.answerCallbackQuery(msg.id, { text: '🔍 Checking price...', show_alert: false });

        // Check price
        try {
            const scraped = await scrapeAmazonProduct(product.amazon_url);
            await queries.updateProductPrice(productId, scraped.price, scraped.title);
            await queries.addPriceHistory(productId, scraped.price);

            // Notify result
            const oldPrice = product.current_price;
            const newPrice = scraped.price;
            let changeText = 'No change';

            if (newPrice < oldPrice) changeText = `📉 Drop: ${((oldPrice - newPrice) / oldPrice * 100).toFixed(1)}%`;
            if (newPrice > oldPrice) changeText = `📈 Rise: ${((newPrice - oldPrice) / oldPrice * 100).toFixed(1)}%`;

            const currencySymbol = product.currency === 'INR' ? '₹' : '$';

            await bot.answerCallbackQuery(msg.id, {
                text: `✅ Checked!\nPrice: ${currencySymbol}${formatPrice(newPrice)}\n${changeText}`,
                show_alert: true
            });

        } catch (err) {
            await bot.answerCallbackQuery(msg.id, { text: `❌ Check failed: ${err.message}`, show_alert: true });
        }

        // Refresh list
        await showProductList(bot, chatId, dbUser.id, page, msg.message_id);

    } catch (error) {
        console.error('Check callback error:', error);
    }
}

/**
 * Handle DELETE callback
 * Deletes a product and refreshes list
 */
async function handleDeleteCallback(bot, msg, productId, page) {
    const chatId = msg.chat.id;
    const user = msg.from;

    try {
        const dbUser = await queries.findUserByTelegramId(user.id);
        if (!dbUser) return;

        // Verify ownership & Delete
        const deleted = await queries.deleteTrackedProduct(productId, dbUser.id);

        if (deleted) {
            await bot.answerCallbackQuery(msg.id, { text: '🗑️ Product deleted', show_alert: true });
            // Refresh list (stay on same page, or showProductList handles empty/adjust)
            await showProductList(bot, chatId, dbUser.id, page, msg.message_id);
        } else {
            await bot.answerCallbackQuery(msg.id, { text: '❌ Could not delete product', show_alert: true });
        }

    } catch (error) {
        console.error('Delete callback error:', error);
    }
}

module.exports = {
    handleStart,
    handleTrack,
    handleSetPrice,
    handleStatus,
    handleHelp,
    handleDelete,
    handleCheck,
    handlePlans,
    handleUpgrade,
    handleDowngrade,
    showProductList,
    handleCheckCallback,
    handleDeleteCallback
};
