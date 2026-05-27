import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      
      if (response.ok) {
        localStorage.setItem('ocean_spas_auth_token', pin);
        navigate('/manager');
      } else {
        setError('Invalid PIN code');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto' }} className="glass-card">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ background: 'var(--primary)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'white' }}>
          <Lock size={32} />
        </div>
        <h2>Manager Access</h2>
        <p style={{ color: 'var(--text-light)' }}>Enter your PIN to continue</p>
      </div>

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <input
            type="password"
            className="form-control"
            placeholder="Enter PIN (e.g. 1234)"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em' }}
            autoFocus
          />
        </div>
        
        {error && <p style={{ color: 'var(--danger)', textAlign: 'center', marginBottom: '1rem' }}>{error}</p>}
        
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
          Unlock
        </button>
      </form>
    </div>
  );
}
