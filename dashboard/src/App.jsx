import React, { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlUserId = params.get('user_id');
    const storedUserId = localStorage.getItem('trackit_user_id');

    if (urlUserId) {
      // User came with a link, save ID and log in
      localStorage.setItem('trackit_user_id', urlUserId);
      setIsAuthenticated(true);
    } else if (storedUserId) {
      // User has stored ID, update URL to match expected format for Dashboard (or refactor Dashboard)
      // For now, we'll just redirect to ensure Dashboard.jsx finds the param
      // Or better: We can just let Dashboard run if we pass the ID, but Dashboard reads from URL.
      // Easiest fix: Redirect if URL param missing but storage exists
      if (!urlUserId) {
        window.history.replaceState(null, '', `/?user_id=${storedUserId}`);
      }
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
    setChecking(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('trackit_user_id');
    // Remove query param without reloading
    const url = new URL(window.location);
    url.searchParams.delete('user_id');
    window.history.pushState({}, '', url);

    setIsAuthenticated(false);
  };

  if (checking) return null; // Or a loading spinner

  return (
    <div className="app">
      {isAuthenticated ? <Dashboard onLogout={handleLogout} /> : <Login />}
    </div>
  );
}

export default App;
