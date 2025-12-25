import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

function PriceChart({ history, currency }) {
    const currencySymbol = currency === 'INR' ? '₹' : '$';

    // Prepare chart data
    const data = useMemo(() => {
        // Sort just in case API didn't
        const sortedHistory = [...history].sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at));

        return {
            labels: sortedHistory.map(h => new Date(h.checked_at).toLocaleDateString()),
            datasets: [
                {
                    label: 'Price',
                    data: sortedHistory.map(h => h.price),
                    borderColor: 'rgb(37, 99, 235)', // --primary
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.3, // Smooth curve
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
            ],
        };
    }, [history]);

    const options = {
        responsive: true,
        maintainAspectRatio: false, // Allow height control via CSS container
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: (context) => `${currencySymbol}${context.parsed.y}`
                }
            },
        },
        scales: {
            y: {
                beginAtZero: false, // Don't force 0, focus on price variation
                ticks: {
                    callback: (value) => `${currencySymbol}${value}`
                },
                grid: {
                    color: '#f1f5f9'
                }
            },
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    maxTicksLimit: 5
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };

    return (
        <div className="chart-container" style={{ height: '250px', width: '100%' }}>
            <Line options={options} data={data} />
        </div>
    );
}

export default PriceChart;
