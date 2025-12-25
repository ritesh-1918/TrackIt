import React, { useState } from 'react';
import { fetchPriceHistory } from '../services/api';
import PriceChart from './PriceChart';

function ProductCard({ product }) {
    const {
        id,
        title,
        current_price,
        target_price,
        amazon_url,
        last_checked_at,
        currency
    } = product;

    const [showChart, setShowChart] = useState(false);
    const [history, setHistory] = useState([]);
    const [loadingChart, setLoadingChart] = useState(false);
    const [trend, setTrend] = useState(null); // 'UP', 'DOWN', 'STABLE'
    const [isAllTimeLow, setIsAllTimeLow] = useState(false);

    const currencySymbol = currency === 'INR' ? '₹' : '$';

    // Format price
    const formatPrice = (price) => {
        if (price === null || price === undefined) return 'N/A';
        return price.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    };

    // Truncate title
    const displayTitle = title.length > 60 ? title.substring(0, 60) + '...' : title;

    // Format date
    const lastChecked = last_checked_at
        ? new Date(last_checked_at).toLocaleString()
        : 'Never';

    const isTargetHit = target_price && current_price <= target_price;

    const handleToggleChart = async () => {
        if (!showChart && history.length === 0) {
            setLoadingChart(true);
            try {
                const data = await fetchPriceHistory(id);
                setHistory(data);

                // Calculate basic trend (simple comparison of last vs first in fetched set or 7-day logic)
                // Let's just compare current vs start of history for simple trend
                if (data.length > 1) {
                    const firstPrice = data[0].price; // Oldest because we reversed in backend? No wait, backend returns oldest first now.
                    // Backend sends: map(h => ...).reverse(). Wait, getPriceHistory is DESC. Reverse makes it ASC (oldest first).
                    // So data[0] is oldest. data[data.length-1] is newest.

                    const newestPrice = data[data.length - 1].price;

                    if (newestPrice < firstPrice) setTrend('DOWN');
                    else if (newestPrice > firstPrice) setTrend('UP');
                    else setTrend('STABLE');

                    // All-time low check (within fetched history)
                    const minPrice = Math.min(...data.map(d => d.price));
                    if (current_price <= minPrice) setIsAllTimeLow(true);
                }

            } catch (err) {
                console.error('Failed to load chart', err);
            } finally {
                setLoadingChart(false);
            }
        }
        setShowChart(!showChart);
    };

    return (
        <div className={`product-card ${isTargetHit ? 'target-hit' : ''}`}>
            <div className="product-header">
                <span className="product-id">#{id}</span>
                {isTargetHit && <span className="badge success">Target Reached!</span>}
                {isAllTimeLow && <span className="badge warning">Low Price!</span>}
            </div>

            <h3 className="product-title" title={title}>
                <a href={amazon_url} target="_blank" rel="noopener noreferrer">
                    {displayTitle}
                </a>
            </h3>

            <div className="product-prices">
                <div className="price-item current">
                    <span className="label">Current Price</span>
                    <div className="value-group">
                        <span className="value">{currencySymbol}{formatPrice(current_price)}</span>
                        {trend === 'DOWN' && <span className="trend down">▼</span>}
                        {trend === 'UP' && <span className="trend up">▲</span>}
                    </div>
                </div>

                {target_price && (
                    <div className="price-item target">
                        <span className="label">Target Price</span>
                        <span className="value">{currencySymbol}{formatPrice(target_price)}</span>
                    </div>
                )}
            </div>

            <div className="chart-section">
                {showChart && (
                    <div className="chart-wrapper">
                        {loadingChart ? (
                            <div className="chart-loading">Loading history...</div>
                        ) : (
                            history.length > 0 ? (
                                <PriceChart history={history} currency={currency} />
                            ) : (
                                <div className="no-data">No history available</div>
                            )
                        )}
                    </div>
                )}
                <button
                    className={`btn-chart ${showChart ? 'active' : ''}`}
                    onClick={handleToggleChart}
                >
                    {showChart ? 'Hide History' : '📊 View Price History'}
                </button>
            </div>

            <div className="product-footer">
                <div className="last-checked">
                    Checked: {lastChecked}
                </div>
                <a
                    href={amazon_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-amazon"
                >
                    Buy Now ↗
                </a>
            </div>
        </div>
    );
}

export default ProductCard;
