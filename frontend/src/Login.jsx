import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from './config';

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
      const response = await fetch(`${config.api.baseURL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      });
      const data = await response.json();

      if (data.success) {
        localStorage.setItem(config.storage.authToken, data.token);
        localStorage.setItem(config.storage.userRole, data.role);

        // BUG FIX #1: Navigate based on role, not always to /sales
        if (data.role === 'MANAGER') {
          navigate('/status');
        } else if (data.role === 'SALES') {
          navigate('/sales');
        } else {
          navigate('/admin');
        }
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection error. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>🌊 Ocean Spas Login</h2>
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
