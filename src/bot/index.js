/**
 * Telegram Bot Module - Main Entry Point
 * 
 * Initializes the Telegram bot and registers all command handlers.
 */

const TelegramBot = require('node-telegram-bot-api');
const commands = require('./commands');

// Bot instance (singleton)
let bot = null;

/**
 * Initialize the Telegram bot
 * Sets up polling and registers all command handlers
 * @returns {Promise<TelegramBot>} The bot instance
 */
async function initializeBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
    }

    if (token === 'your_bot_token_here') {
        throw new Error('Please set your actual Telegram bot token in .env file');
    }

    // Create bot instance with polling
    bot = new TelegramBot(token, {
        polling: true
    });

    // Register command handlers
    registerCommands();

    // Handle polling errors
    bot.on('polling_error', (error) => {
        console.error('❌ Telegram polling error:', error.code, error.message);
    });

    // Handle general errors
    bot.on('error', (error) => {
        console.error('❌ Telegram bot error:', error.message);
    });

    // Log successful connection
    try {
        const me = await bot.getMe();
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🤖 TrackIt bot started');
        console.log(`📱 Bot username: @${me.username}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (error) {
        console.error('❌ Failed to connect to Telegram:', error.message);
        throw error;
    }

    return bot;
}

/**
 * Register all bot command handlers
 */
function registerCommands() {
    // /start - Initialize the bot for a user
    bot.onText(/\/start/, (msg) => commands.handleStart(bot, msg));

    // /track <url> - Track a new Amazon product
    bot.onText(/\/track(.*)/, (msg, match) => commands.handleTrack(bot, msg, match));

    // /setprice <id> <price> - Set target price for a product
    bot.onText(/\/setprice(.*)/, (msg, match) => commands.handleSetPrice(bot, msg, match));

    // /status - View tracked products and their status
    bot.onText(/\/status/, (msg) => commands.handleStatus(bot, msg));

    // /help - Show help message
    bot.onText(/\/help/, (msg) => commands.handleHelp(bot, msg));

    // /delete <id> - Remove a tracked product
    bot.onText(/\/delete(.*)/, (msg, match) => commands.handleDelete(bot, msg, match));

    // /check - Manually trigger price check for user's products
    bot.onText(/\/check/, (msg) => commands.handleCheck(bot, msg));

    // /plans - Show plan comparison
    bot.onText(/\/plans/, (msg) => commands.handlePlans(bot, msg));

    // /upgrade - Upgrade to PRO plan (demo mode)
    bot.onText(/\/upgrade/, (msg) => commands.handleUpgrade(bot, msg));

    // /downgrade - Downgrade to FREE plan
    bot.onText(/\/downgrade/, (msg) => commands.handleDowngrade(bot, msg));

    // Handle callback queries (Inline Buttons)
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const action = query.data;

        // Acknowledge callback to stop loading animation
        try {
            await bot.answerCallbackQuery(query.id);
        } catch (error) {
            console.error('Error answering callback:', error.message);
        }

        // Construct mock msg object for command handlers
        const msg = query.message;
        msg.from = query.from; // Use the clicker as the sender

        // Handle Dynamic Actions (Page, Check, Delete)
        if (action.startsWith('PAGE_')) {
            const page = parseInt(action.split('_')[1]);
            await commands.showProductList(bot, chatId, query.from.id, page, msg.message_id, query.from);
            return;
        }

        if (action.startsWith('CHECK_')) {
            const parts = action.split('_');
            const id = parseInt(parts[1]);
            const page = parseInt(parts[2]) || 1;
            await commands.handleCheckCallback(bot, msg, id, page);
            return;
        }

        if (action.startsWith('DELETE_')) {
            const parts = action.split('_');
            const id = parseInt(parts[1]);
            const page = parseInt(parts[2]) || 1;
            await commands.handleDeleteCallback(bot, msg, id, page);
            return;
        }

        switch (action) {
            case 'TRACK':
                await bot.sendMessage(chatId,
                    '👇 <b>Send me an Amazon product link:</b>\n\n' +
                    '<code>https://amazon.in/dp/...</code>\n\n' +
                    'Or use command: <code>/track &lt;url&gt;</code>',
                    {
                        parse_mode: 'HTML',
                        ...require('./keyboards').closeKeyboard
                    }
                );
                break;


            case 'STATUS':
                await commands.showProductList(bot, chatId, query.from.id, 1, msg.message_id, query.from);
                break;

            case 'DASHBOARD':
                const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5173';
                const magicLink = `${dashboardUrl}/?user_id=${query.from.id}`;
                const isLocal = dashboardUrl.includes('localhost') || dashboardUrl.includes('127.0.0.1');

                if (isLocal) {
                    // Localhost: Send link in text (Buttons don't support localhost)
                    await bot.sendMessage(chatId,
                        `📊 <b>TrackIt Dashboard</b>\n\n` +
                        `Use this link to access your local dashboard:\n` +
                        `<a href="${magicLink}">🚀 Open Dashboard</a>\n\n` +
                        `<i>(Link valid for your account only)</i>`,
                        {
                            parse_mode: 'HTML',
                            // No inline button for link, just close
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '❌ Close', callback_data: 'CLOSE' }]
                                ]
                            }
                        }
                    );
                } else {
                    // Production: Use inline button
                    await bot.sendMessage(chatId,
                        `📊 <b>TrackIt Dashboard</b>\n\n` +
                        `Click the button below to view your products, price history charts, and trends on the web!\n\n` +
                        `<i>(Link valid for your account only)</i>`,
                        {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🚀 Open Dashboard', url: magicLink }],
                                    [{ text: '❌ Close', callback_data: 'CLOSE' }]
                                ]
                            }
                        }
                    );
                }
                break;

            case 'UPGRADE':
                // Show plans instead of immediate upgrade for better UX
                await commands.handlePlans(bot, msg);
                break;

            case 'HELP':
                await commands.handleHelp(bot, msg);
                break;

            case 'BACK':
                // Go back to main menu by simulating /start
                // We fake the text so handleStart acts correctly if it depends on it (it doesn't)
                await commands.handleStart(bot, msg);
                break;

            case 'CLOSE':
                // Delete the message to clean up chat
                try {
                    await bot.deleteMessage(chatId, msg.message_id);
                } catch (err) {
                    // If delete fails (too old), edit it
                    await bot.editMessageText('✅ Session closed. Use /start to begin again.', {
                        chat_id: chatId,
                        message_id: msg.message_id
                    });
                }
                break;

            default:
                console.log('Unknown callback action:', action);
        }
    });

    console.log('📋 Bot commands registered: /start, /track, /setprice, /status, /help, /delete, /check, /plans, /upgrade, /downgrade');
}

/**
 * Get the bot instance
 * @returns {TelegramBot} The bot instance
 */
function getBot() {
    if (!bot) {
        throw new Error('Bot not initialized. Call initializeBot() first.');
    }
    return bot;
}

/**
 * Send a message to a specific user
 * @param {number} chatId - Telegram chat ID
 * @param {string} message - Message to send
 * @param {Object} options - Additional options
 */
async function sendMessage(chatId, message, options = {}) {
    const botInstance = getBot();
    return botInstance.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
    });
}

/**
 * Stop the bot (for graceful shutdown)
 */
function stopBot() {
    if (bot) {
        bot.stopPolling();
        bot = null;
        console.log('🤖 Bot stopped');
    }
}

module.exports = {
    initializeBot,
    getBot,
    sendMessage,
    stopBot
};
