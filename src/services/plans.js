/**
 * Plans Service
 * 
 * Defines subscription plans and their rules.
 * Provides helpers to fetch plan configurations.
 */

// ===========================================
// PLAN DEFINITIONS
// ===========================================

const PLANS = {
    FREE: {
        id: 'FREE',
        name: 'Free',
        displayName: '🆓 Free Plan',
        maxProducts: 1,
        checkInterval: 'WEEKLY',
        checkIntervalMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        checkCron: '0 9 * * 0', // Every Sunday at 9 AM
        features: [
            'Track 1 product',
            'Weekly price checks',
            'Price drop alerts',
            'Basic notifications'
        ],
        price: 0,
        currency: 'INR'
    },

    PRO: {
        id: 'PRO',
        name: 'Pro',
        displayName: '⭐ Pro Plan',
        maxProducts: 10,
        checkInterval: 'DAILY',
        checkIntervalMs: 24 * 60 * 60 * 1000, // 1 day
        checkCron: '0 9 * * *', // Every day at 9 AM
        features: [
            'Track up to 10 products',
            'Daily price checks',
            'Priority notifications',
            'Price history tracking',
            'Target price alerts'
        ],
        price: 99,
        currency: 'INR'
    }
};

// Check interval mappings
const CHECK_INTERVALS = {
    WEEKLY: {
        label: 'Weekly',
        description: 'Every Sunday at 9 AM IST',
        cron: '0 9 * * 0',
        ms: 7 * 24 * 60 * 60 * 1000
    },
    DAILY: {
        label: 'Daily',
        description: 'Every day at 9 AM IST',
        cron: '0 9 * * *',
        ms: 24 * 60 * 60 * 1000
    },
    HOURLY: {
        label: 'Hourly',
        description: 'Every hour',
        cron: '0 * * * *',
        ms: 60 * 60 * 1000
    }
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get plan rules by plan ID
 * @param {string} planId - Plan ID (FREE, PRO)
 * @returns {Object} Plan configuration
 */
function getPlanById(planId) {
    const plan = PLANS[planId?.toUpperCase()];

    if (!plan) {
        // Default to FREE plan if not found
        console.warn(`Unknown plan: ${planId}, defaulting to FREE`);
        return PLANS.FREE;
    }

    return plan;
}

/**
 * Get plan rules for a user
 * @param {Object} user - User object with plan field
 * @returns {Object} Plan configuration
 */
function getUserPlan(user) {
    if (!user || !user.plan) {
        return PLANS.FREE;
    }

    return getPlanById(user.plan);
}

/**
 * Check if user can track more products
 * @param {Object} user - User object
 * @param {number} currentProductCount - Current number of tracked products
 * @returns {Object} { canTrack: boolean, limit: number, current: number, remaining: number }
 */
function canUserTrackMore(user, currentProductCount) {
    const plan = getUserPlan(user);
    const limit = user?.max_products || plan.maxProducts;
    const remaining = Math.max(0, limit - currentProductCount);

    return {
        canTrack: currentProductCount < limit,
        limit,
        current: currentProductCount,
        remaining
    };
}

/**
 * Get check interval configuration
 * @param {string} intervalId - Interval ID (WEEKLY, DAILY, HOURLY)
 * @returns {Object} Interval configuration
 */
function getCheckInterval(intervalId) {
    return CHECK_INTERVALS[intervalId?.toUpperCase()] || CHECK_INTERVALS.WEEKLY;
}

/**
 * Get all available plans
 * @returns {Object} All plan configurations
 */
function getAllPlans() {
    return { ...PLANS };
}

/**
 * Compare two plans
 * @param {string} planA - First plan ID
 * @param {string} planB - Second plan ID
 * @returns {number} -1 if A < B, 0 if equal, 1 if A > B
 */
function comparePlans(planA, planB) {
    const order = { FREE: 0, PRO: 1 };
    const a = order[planA?.toUpperCase()] ?? 0;
    const b = order[planB?.toUpperCase()] ?? 0;

    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

/**
 * Check if plan is premium (paid)
 * @param {string} planId - Plan ID
 * @returns {boolean} Whether plan is premium
 */
function isPremiumPlan(planId) {
    const plan = getPlanById(planId);
    return plan.price > 0;
}

/**
 * Format plan for display in Telegram message
 * @param {string} planId - Plan ID
 * @returns {string} Formatted plan info
 */
function formatPlanInfo(planId) {
    const plan = getPlanById(planId);
    const interval = getCheckInterval(plan.checkInterval);

    return `
<b>${plan.displayName}</b>

📦 <b>Products:</b> Up to ${plan.maxProducts}
⏰ <b>Check Frequency:</b> ${interval.label} (${interval.description})

<b>Features:</b>
${plan.features.map(f => `• ${f}`).join('\n')}
${plan.price > 0 ? `\n💰 <b>Price:</b> ₹${plan.price}/month` : ''}
    `.trim();
}

module.exports = {
    // Plan definitions
    PLANS,
    CHECK_INTERVALS,

    // Helper functions
    getPlanById,
    getUserPlan,
    canUserTrackMore,
    getCheckInterval,
    getAllPlans,
    comparePlans,
    isPremiumPlan,
    formatPlanInfo
};
