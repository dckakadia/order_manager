import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from './config';
import { apiFetch, setAuthStorage } from './apiUtils';
import { STORAGE_KEYS, USER_ROLES, ROUTES, ERROR_MESSAGES } from './constants';
import { initPushNotifications } from './pushNotifications';

export default function Login() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      });

      if (!result.ok) {
        setError(result.error || ERROR_MESSAGES.VALIDATION_ERROR);
        return;
      }

      const data = result.data;
      if (data.success) {
        // Use centralized storage utility with proper keys
        setAuthStorage(data.token, data.role, data.id || '');
        initPushNotifications();

        // Fetch page permissions before navigating so the nav renders correctly on first
        // landing — App.jsx's mount-only effect won't re-run on this client-side route change.
        try {
          const permsResult = await apiFetch(`${config.api.baseURL}/api/users/me/permissions`);
          if (permsResult.ok) {
            localStorage.setItem(STORAGE_KEYS.USER_PERMISSIONS, JSON.stringify(permsResult.data.data));
          }
        } catch (err) {
          console.error('Permissions fetch error:', err);
        }

        // Navigate based on role
        const roleRoutes = {
          [USER_ROLES.MANAGER]: ROUTES.STATUS,
          [USER_ROLES.SALES]: ROUTES.SALES,
          [USER_ROLES.ADMIN]: ROUTES.SALES
        };
        
        const route = roleRoutes[data.role] || ROUTES.SALES;
        navigate(route);
      } else {
        setError(data.message || ERROR_MESSAGES.VALIDATION_ERROR);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(ERROR_MESSAGES.NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>🌊 Mivox Spas Login</h2>
      {error && (
        <div className="badge badge-start" style={{ display: 'block', textAlign: 'center', marginBottom: '1rem', padding: '0.75rem' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            className="form-control"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoFocus
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label className="form-label">PIN / Password</label>
          <input
            type="password"
            className="form-control"
            value={pin}
            onChange={e => setPin(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
