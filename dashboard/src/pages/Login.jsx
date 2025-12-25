import React, { useState } from 'react';

function Login() {
    const [inputUserId, setInputUserId] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        if (!inputUserId.trim()) {
            setError('Please enter your Telegram User ID');
            return;
        }

        // Simple numeric check (Telegram IDs are numbers)
        if (!/^\d+$/.test(inputUserId)) {
            setError('User ID must be a number');
            return;
        }

        // Redirect to dashboard with user_id param
        window.location.href = `/?user_id=${inputUserId}`;
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>TrackIt <span>Dashboard</span></h1>
                    <p>View your tracked products and price history</p>
                </div>

                <div className="login-methods">
                    <div className="method bot-method">
                        <h3>🤖 Recommended</h3>
                        <p>Open the TrackIt Telegram bot and click the <b>"📊 Dashboard"</b> button to auto-login.</p>
                        <a href="https://t.me/TrackIt1918bot" target="_blank" rel="noopener noreferrer" className="btn-bot">
                            Open Telegram Bot ↗
                        </a>
                    </div>

                    <div className="divider">
                        <span>OR</span>
                    </div>

                    <div className="method manual-method">
                        <h3>Enter ID Manually</h3>
                        <form onSubmit={handleLogin}>
                            <div className="input-group">
                                <input
                                    type="text"
                                    placeholder="Telegram User ID (e.g. 123456789)"
                                    value={inputUserId}
                                    onChange={(e) => setInputUserId(e.target.value)}
                                />
                            </div>
                            {error && <p className="error-msg">{error}</p>}
                            <button type="submit" className="btn-login">Access Dashboard</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
