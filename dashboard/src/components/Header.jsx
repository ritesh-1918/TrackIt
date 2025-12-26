import React from 'react';
import logo from '../assets/logo.png';

function Header({ user, onLogout }) {
    if (!user) return null;

    const isPro = user.plan === 'PRO';

    return (
        <header className="header">
            <div className="container header-content">
                <div className="logo">
                    <img src={logo} alt="TrackIt Logo" className="logo-img" />
                    <h1>TrackIt <span>Dashboard</span></h1>
                </div>
                <div className="user-info">
                    <span className="user-name">Hello, {user.firstName || user.username || 'User'}</span>
                    <span className={`plan-badge ${isPro ? 'pro' : 'free'}`}>
                        {user.planName || user.plan} PLAN
                    </span>
                    <button className="btn-logout" onClick={onLogout} title="Logout">
                        Logout
                    </button>
                </div>
            </div>
        </header>
    );
}

export default Header;
