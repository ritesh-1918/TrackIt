/**
 * Subscription Service
 * 
 * Business logic for subscription and limits management.
 * Handles user tiers, product limits, and premium features.
 */

// const { queries } = require('../db');

// Subscription plan configurations
const PLANS = {
    free: {
        name: 'Free',
        maxProducts: 10,
        priceCheckFrequency: 'weekly',
        features: ['basic_tracking', 'email_alerts']
    },
    basic: {
        name: 'Basic',
        maxProducts: 50,
        priceCheckFrequency: 'daily',
        features: ['basic_tracking', 'email_alerts', 'price_history']
    },
    premium: {
        name: 'Premium',
        maxProducts: 200,
        priceCheckFrequency: 'hourly',
        features: ['basic_tracking', 'email_alerts', 'price_history', 'api_access', 'priority_support']
    }
};

/**
 * Get subscription details for a user
 * 
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Subscription details
 */
async function getSubscription(userId) {
    // TODO: Implement subscription retrieval

    console.log(`📋 Getting subscription for user ${userId}`);

    try {
        // const subscription = queries.getSubscriptionByUserId(userId);
        // 
        // if (!subscription) {
        //     // Return default free plan
        //     return {
        //         planType: 'free',
        //         ...PLANS.free,
        //         isActive: true
        //     };
        // }
        // 
        // return {
        //     ...subscription,
        //     ...PLANS[subscription.plan_type]
        // };

        return {
            planType: 'free',
            ...PLANS.free,
            isActive: true
        };

    } catch (error) {
        console.error('Error getting subscription:', error);
        return { planType: 'free', ...PLANS.free };
    }
}

/**
 * Check if user can track more products
 * 
 * @param {number} userId - User ID
 * @returns {Promise<Object>} { canTrack, currentCount, maxCount }
 */
async function checkProductLimit(userId) {
    // TODO: Implement limit checking

    console.log(`🔢 Checking product limit for user ${userId}`);

    try {
        // const subscription = await getSubscription(userId);
        // const currentCount = queries.countUserTrackedProducts(userId);
        // const maxCount = subscription.maxProducts;

        return {
            canTrack: true, // Placeholder
            currentCount: 0,
            maxCount: PLANS.free.maxProducts,
            remaining: PLANS.free.maxProducts
        };

    } catch (error) {
        console.error('Error checking product limit:', error);
        return { canTrack: false, currentCount: 0, maxCount: 0, remaining: 0 };
    }
}

/**
 * Update user subscription
 * 
 * @param {number} userId - User ID
 * @param {string} planType - Plan type (free, basic, premium)
 * @param {Date} expiresAt - Expiration date (optional for free)
 * @returns {Promise<Object>} Updated subscription
 */
async function updateSubscription(userId, planType, expiresAt = null) {
    // TODO: Implement subscription update

    console.log(`📝 Updating subscription for user ${userId} to ${planType}`);

    try {
        // Validate plan type
        if (!PLANS[planType]) {
            return { success: false, error: 'Invalid plan type' };
        }

        // const subscription = queries.upsertSubscription({
        //     userId,
        //     planType,
        //     maxProducts: PLANS[planType].maxProducts,
        //     expiresAt
        // });

        return {
            success: true,
            message: 'TODO: Implement subscription update'
        };

    } catch (error) {
        console.error('Error updating subscription:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check if subscription is active and not expired
 * 
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} Whether subscription is active
 */
async function isSubscriptionActive(userId) {
    // TODO: Implement expiration check

    try {
        // const subscription = await getSubscription(userId);
        // 
        // if (subscription.planType === 'free') {
        //     return true; // Free plan never expires
        // }
        // 
        // if (!subscription.expiresAt) {
        //     return true;
        // }
        // 
        // return new Date(subscription.expiresAt) > new Date();

        return true; // Placeholder

    } catch (error) {
        console.error('Error checking subscription status:', error);
        return false;
    }
}

/**
 * Get available subscription plans
 * 
 * @returns {Object} Available plans with their features
 */
function getAvailablePlans() {
    return PLANS;
}

module.exports = {
    getSubscription,
    checkProductLimit,
    updateSubscription,
    isSubscriptionActive,
    getAvailablePlans,
    PLANS
};
