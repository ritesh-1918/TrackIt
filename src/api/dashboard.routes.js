const express = require('express');
const router = express.Router();
const queries = require('../db/queries');
const { getUserPlan, PLANS } = require('../services/plans');

/**
 * GET /dashboard/:userId
 * Fetch dashboard data for a specific user
 */
router.get('/dashboard/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // 1. Validate user exists
        // We assume userId passed is the Telegram ID (as that's what we use publicly)
        // If it's the internal DB ID, queries.findUserByTelegramId might need adjustment or we use findUserById
        // The prompt says "Validate user exists in DB". 
        // Let's assume the URL param is the Telegram ID for ease of use from the bot/frontend.
        const dbUser = await queries.findUserByTelegramId(userId);

        if (!dbUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 2. Fetch user plan details
        const plan = getUserPlan(dbUser);

        // 3. Fetch tracked products
        const products = await queries.getTrackedProductsByUserId(dbUser.id);

        // 4. Sort products: last_checked_at DESC (newest checks first), then created_at DESC
        products.sort((a, b) => {
            const dateA = new Date(a.last_checked_at || a.created_at);
            const dateB = new Date(b.last_checked_at || b.created_at);
            return dateB - dateA;
        });

        // 5. Format response
        const response = {
            user: {
                id: dbUser.telegram_id, // Return Telegram ID
                username: dbUser.username,
                firstName: dbUser.first_name,
                plan: plan.id,
                planName: plan.displayName,
                max_products: plan.maxProducts
            },
            products: products.map(p => ({
                id: p.id,
                title: p.title,
                amazon_url: p.amazon_url,
                current_price: p.current_price,
                target_price: p.target_price,
                currency: p.currency,
                last_checked_at: p.last_checked_at,
                image_url: p.image_url // Include if available in DB/Schema, otherwise undefined is fine
            }))
        };

        res.json(response);

    } catch (error) {
        console.error('Error in GET /api/dashboard/:userId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /history/:productId
 * Fetch price history for a specific product
 */
router.get('/history/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;

        // 1. Validate product exists (optional but good practice)
        const product = await queries.findProductById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // 2. Fetch history
        // Limit to last 30 entries for the chart
        const history = await queries.getPriceHistory(productId, 30);

        // 3. Format response: sort by date ASC for chart (oldest first)
        // getPriceHistory returns DESC (newest first), so we reverse
        const chartData = history.map(h => ({
            price: h.price,
            checked_at: h.checked_at
        })).reverse();

        res.json(chartData);

    } catch (error) {
        console.error('Error in GET /api/history/:productId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
