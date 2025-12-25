import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import { fetchDashboardData } from '../services/api';

function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Get userId from URL query params
        const params = new URLSearchParams(window.location.search);
        const userId = params.get('user_id');

        if (!userId) {
            setError('Please provide a user_id in the URL (e.g., ?user_id=12345)');
            setLoading(false);
            return;
        }

        const loadData = async () => {
            try {
                setLoading(true);
                const dashboardData = await fetchDashboardData(userId);
                setData(dashboardData);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <div className="error-card">
                    <h2>⚠️ Access Error</h2>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()}>Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <Header user={data.user} />

            <main className="container">
                <section className="stats-bar">
                    <div className="stat-item">
                        <span className="stat-label">Tracking</span>
                        <span className="stat-value">
                            {data.products.length} <span className="stat-limit">/ {data.user.max_products}</span>
                        </span>
                    </div>
                </section>

                {data.products.length === 0 ? (
                    <div className="empty-state">
                        <h3>No products tracked yet</h3>
                        <p>Use the Telegram bot to add products!</p>
                    </div>
                ) : (
                    <div className="product-grid">
                        {data.products.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default Dashboard;
