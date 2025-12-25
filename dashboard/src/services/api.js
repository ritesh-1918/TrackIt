const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Fetch dashboard data for a user
 * @param {string} userId - Telegram User ID
 * @returns {Promise<Object>} Dashboard data
 */
export async function fetchDashboardData(userId) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/${userId}`);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('User not found. Please register via the Telegram bot first.');
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch dashboard data');
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

/**
 * Fetch price history for a product
 * @param {number} productId 
 * @returns {Promise<Array>} History data
 */
export async function fetchPriceHistory(productId) {
    try {
        const response = await fetch(`${API_BASE_URL}/history/${productId}`);
        if (!response.ok) throw new Error('Failed to fetch history');
        return await response.json();
    } catch (error) {
        console.error('History API Error:', error);
        return [];
    }
}
