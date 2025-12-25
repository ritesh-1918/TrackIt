/**
 * Bot Keyboards Module
 * 
 * Contains all inline keyboard definitions for the bot.
 */

const mainMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: '➕ Track New Product', callback_data: 'TRACK' },
                { text: '📋 My Products', callback_data: 'STATUS' }
            ],
            [
                { text: '📊 Dashboard', callback_data: 'DASHBOARD' },
                { text: '💎 Premium Plans', callback_data: 'PLANS' }
            ],
            [
                { text: '❓ Help', callback_data: 'HELP' }
            ]
        ]
    }
};

const backKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🔙 Back to Menu', callback_data: 'BACK' }]
        ]
    }
};

const closeKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '❌ Close', callback_data: 'CLOSE' }]
        ]
    }
};

/**
 * Add navigation buttons (Back/Close) to a keyboard
 * @param {Object} keyboard - Existing inline_keyboard array or object
 * @param {boolean} showBack - Show Back button
 * @param {boolean} showClose - Show Close button
 * @returns {Object} reply_markup object
 */
function withNavigation(keyboard, showBack = true, showClose = true) {
    let rows = [];

    // Handle input variations (keyboard object or rows array)
    if (keyboard && keyboard.reply_markup && keyboard.reply_markup.inline_keyboard) {
        rows = [...keyboard.reply_markup.inline_keyboard];
    } else if (Array.isArray(keyboard)) {
        rows = [...keyboard];
    }

    const navRow = [];
    if (showBack) navRow.push({ text: '🔙 Back', callback_data: 'BACK' });
    if (showClose) navRow.push({ text: '❌ Close', callback_data: 'CLOSE' });

    if (navRow.length > 0) {
        rows.push(navRow);
    }

    return {
        reply_markup: {
            inline_keyboard: rows
        }
    };
}

/**
 * Generate a paginated product list keyboard
 * @param {Array} products - List of products
 * @param {number} page - Current page (1-based)
 * @param {number} pageSize - Products per page
 * @returns {Object} reply_markup object
 */
function productListKeyboard(products, page = 1, pageSize = 3) {
    const totalPages = Math.ceil(products.length / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageProducts = products.slice(start, end);

    let rows = [];

    // Product rows
    pageProducts.forEach(product => {
        // Short title (keep it very short for inline buttons)
        const shortTitle = product.title.length > 20
            ? product.title.substring(0, 17) + '...'
            : product.title;

        // Row for each product: [ Actions ]
        // Since we can't put too much info in buttons, we'll put Title in text and actions in buttons
        // Logic: 
        // Row 1: Check | Delete
        rows.push([
            { text: `🔍 Check #${product.id}`, callback_data: `CHECK_${product.id}_${page}` },
            { text: `🗑️ Delete #${product.id}`, callback_data: `DELETE_${product.id}_${page}` }
        ]);
    });

    // Pagination controls
    const paginationRow = [];
    if (page > 1) {
        paginationRow.push({ text: '◀️ Prev', callback_data: `PAGE_${page - 1}` });
    }

    // Page indicator (middle button, non-clickable or just reloads current)
    paginationRow.push({ text: `${page}/${totalPages || 1}`, callback_data: `PAGE_${page}` });

    if (page < totalPages) {
        paginationRow.push({ text: 'Next ▶️', callback_data: `PAGE_${page + 1}` });
    }

    if (paginationRow.length > 0) {
        rows.push(paginationRow);
    }

    // Add navigation (Back + Close)
    return withNavigation({ reply_markup: { inline_keyboard: rows } }, true, true);
}

module.exports = {
    mainMenuKeyboard,
    backKeyboard,
    closeKeyboard,
    withNavigation,
    productListKeyboard
};
