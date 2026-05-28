import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://116.74.77.22:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      });
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('ocean_spas_auth_token', data.token);
        localStorage.setItem('ocean_spas_role', data.role);
        navigate('/sales');
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Login</h2>
      {error && <div className="badge badge-start" style={{ display: 'block', textAlign: 'center', marginBottom: '1rem' }}>{error}</div>}
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
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
          Login
        </button>
      </form>
    </div>
  );
}
