/**
 * Plan Guard Service
 * 
 * Validates user actions against their plan rules.
 * Use this in all commands to enforce plan limits.
 */

const { getUserPlan, canUserTrackMore, PLANS } = require('./plans');

/**
 * Validate user action against plan rules
 * @param {Object} user - User object from database
 * @param {string} action - Action to validate
 * @param {Object} context - Additional context (e.g., currentProductCount)
 * @returns {Object} { allowed: boolean, reason: string, suggestion?: string }
 */
function validateAction(user, action, context = {}) {
    const plan = getUserPlan(user);

    switch (action) {
        case 'TRACK_PRODUCT':
            return validateTrackProduct(user, plan, context);

        case 'SET_TARGET_PRICE':
            return validateSetTargetPrice(user, plan, context);

        case 'MANUAL_CHECK':
            return validateManualCheck(user, plan, context);

        case 'VIEW_HISTORY':
            return validateViewHistory(user, plan, context);

        case 'DAILY_CHECK':
            return validateDailyCheck(user, plan, context);

        default:
            return { allowed: true, reason: 'Action allowed' };
    }
}

/**
 * Validate tracking a new product
 */
function validateTrackProduct(user, plan, context) {
    const currentCount = context.currentProductCount || 0;
    const trackCheck = canUserTrackMore(user, currentCount);

    if (!trackCheck.canTrack) {
        return {
            allowed: false,
            reason: `Product limit reached (${trackCheck.current}/${trackCheck.limit})`,
            suggestion: plan.id === 'FREE'
                ? `Upgrade to PRO to track up to ${PLANS.PRO.maxProducts} products!`
                : 'Delete a product to add a new one.',
            limit: trackCheck.limit,
            current: trackCheck.current
        };
    }

    return {
        allowed: true,
        reason: `Can track ${trackCheck.remaining} more product(s)`,
        remaining: trackCheck.remaining
    };
}

/**
 * Validate setting target price
 */
function validateSetTargetPrice(user, plan, context) {
    // All plans can set target prices
    return { allowed: true, reason: 'Target price allowed' };
}

/**
 * Validate manual price check
 */
function validateManualCheck(user, plan, context) {
    // All plans can do manual checks
    return { allowed: true, reason: 'Manual check allowed' };
}

/**
 * Validate viewing price history
 */
function validateViewHistory(user, plan, context) {
    // PRO users get full history, FREE users get limited
    const limit = plan.id === 'PRO' ? 90 : 7;

    return {
        allowed: true,
        reason: `Can view ${limit} days of history`,
        historyDays: limit
    };
}

/**
 * Validate eligibility for daily check
 */
function validateDailyCheck(user, plan, context) {
    const checkInterval = user?.check_interval || plan.checkInterval;

    if (checkInterval !== 'DAILY' && checkInterval !== 'HOURLY') {
        return {
            allowed: false,
            reason: `Daily checks require PRO plan (current: ${checkInterval})`,
            suggestion: 'Upgrade to PRO for daily price checks!'
        };
    }

    return { allowed: true, reason: 'Daily check allowed' };
}

/**
 * Check if user can perform action (simplified boolean check)
 */
function canPerformAction(user, action, context = {}) {
    return validateAction(user, action, context).allowed;
}

/**
 * Get upgrade message for denied actions
 */
function getUpgradeMessage(action) {
    const messages = {
        'TRACK_PRODUCT': `⭐ <b>Upgrade to PRO</b> to track up to ${PLANS.PRO.maxProducts} products!`,
        'DAILY_CHECK': `⭐ <b>Upgrade to PRO</b> for daily price checks instead of weekly!`,
        'VIEW_HISTORY': `⭐ <b>Upgrade to PRO</b> for 90 days of price history!`
    };

    return messages[action] || '⭐ <b>Upgrade to PRO</b> for more features!';
}

/**
 * Format validation result for Telegram message
 */
function formatValidationMessage(validation) {
    if (validation.allowed) {
        return null;
    }

    let message = `⚠️ <b>Action Not Allowed</b>\n\n`;
    message += `${validation.reason}\n`;

    if (validation.suggestion) {
        message += `\n💡 ${validation.suggestion}`;
    }

    return message;
}

module.exports = {
    validateAction,
    canPerformAction,
    getUpgradeMessage,
    formatValidationMessage
};
