import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { ClipboardList, Users, Activity, BarChart2, Settings, LogOut } from 'lucide-react';
import { io } from 'socket.io-client';
import { createContext, useEffect, useState } from 'react';
import { Browser } from '@capacitor/browser';
import config from './config';
import { apiFetch, clearAuthStorage } from './apiUtils';
import { STORAGE_KEYS, USER_ROLES, ROUTES, ERROR_MESSAGES } from './constants';
import SalesForm from './SalesForm';
import LiveOrderStatus from './LiveOrderStatus';
import ManagerDashboard from './ManagerDashboard';
import ItemMaster from './ItemMaster';
import CustomerMaster from './CustomerMaster';
import Login from './Login';

export const SocketContext = createContext();

function Navigation() {
  const location = useLocation();
  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  const [socketConnected, setSocketConnected] = useState(false);

  const handleLogout = async () => {
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/auth/logout`, { method: 'POST' });
      if (!result.ok) {
        console.error('Logout error:', result.error);
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Clear auth storage (not all localStorage)
      clearAuthStorage();
      window.location.href = ROUTES.LOGIN;
    }
  };

  const checkForUpdates = async () => {
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/system/update-check`);
      
      if (!result.ok) {
        alert(ERROR_MESSAGES.NETWORK_ERROR);
        return;
      }
      
      const data = result.data;
      if (data.success && data.data && data.data.latestVersion) {
        const isNewer = (latest, current) => {
          const lParts = latest.split('.').map(Number);
          const cParts = current.split('.').map(Number);
          for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
            const l = lParts[i] || 0;
            const c = cParts[i] || 0;
            if (l > c) return true;
            if (l < c) return false;
          }
          return false;
        };

        if (isNewer(data.data.latestVersion, config.appVersion)) {
          if (window.confirm(`New update available (v${data.data.latestVersion})! Would you like to download it now?`)) {
            let downloadUrl = data.data.downloadUrl;
            if (downloadUrl.startsWith('/')) {
              downloadUrl = `${config.api.baseURL || window.location.origin}${downloadUrl}`;
            }
            await Browser.open({ url: downloadUrl });
          }
        } else {
          alert('You are on the latest version.');
        }
      } else {
        alert('You are on the latest version.');
      }
    } catch (error) {
      console.error('Update check error:', error);
      alert(ERROR_MESSAGES.NETWORK_ERROR);
    }
  };

  return (
    <>
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="logo-icon">🌊</div>
          <h1 className="app-name" style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: 0 }}>
            Ocean Spas
            <span style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.7, background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px' }}>
              v{config.appVersion}
            </span>
          </h1>
        </div>
        <button onClick={checkForUpdates} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          Check Update
        </button>
      </header>
      {role && (
        <nav className="bottom-nav">
          {(role === 'SALES' || role === 'ADMIN') && (
            <>
              <Link to="/sales" className={`bottom-nav-item ${location.pathname === '/sales' ? 'active' : ''}`}>
                <ClipboardList size={24} />
                <span>New Order</span>
              </Link>
              <Link to="/customers" className={`bottom-nav-item ${location.pathname === '/customers' ? 'active' : ''}`}>
                <Users size={24} />
                <span>Customers</span>
              </Link>
            </>
          )}
          
          <Link to="/status" className={`bottom-nav-item ${location.pathname === '/status' ? 'active' : ''}`}>
            <Activity size={24} />
            <span>Live Orders</span>
          </Link>
          
          {role === 'ADMIN' && (
            <>
              <Link to="/dashboard" className={`bottom-nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}>
                <BarChart2 size={24} />
                <span>Metrics</span>
              </Link>
              <Link to="/admin" className={`bottom-nav-item ${location.pathname === '/admin' ? 'active' : ''}`}>
                <Settings size={24} />
                <span>Items</span>
              </Link>
            </>
          )}
          
          <button 
            onClick={handleLogout}
            className="bottom-nav-item"
            title={socketConnected ? 'Connected' : 'Offline'}
          >
            <LogOut size={24} />
            <span>Sign Out</span>
          </button>
        </nav>
      )}
    </>
  );
}

function RootRedirect() {
  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  
  if (!role) return <Navigate to={ROUTES.LOGIN} />;
  if (role === USER_ROLES.MANAGER) return <Navigate to={ROUTES.STATUS} />;
  if (role === USER_ROLES.SALES) return <Navigate to={ROUTES.SALES} />;
  return <Navigate to={ROUTES.ADMIN} />;
}

function App() {
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    // Fetch CSRF token on app load
    apiFetch(`${config.api.baseURL}/api/csrf-token`)
      .then(result => {
        if (!result.ok) {
          console.warn('Failed to fetch CSRF token:', result.error);
        }
      })
      .catch(error => console.error('CSRF token fetch error:', error));

    // CRITICAL FIX: Use environment variables for API URL
    const newSocket = io(config.api.socketURL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    // Track socket connection status
    const handleConnect = () => {
      console.log('Socket connected');
      setSocketConnected(true);
    };
    
    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setSocketConnected(false);
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', handleDisconnect);

    setSocket(newSocket);
    
    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect', handleDisconnect);
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      <Router>
        <div className="app-container">
          <Navigation />
          
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            
            <Route path="/sales" element={<ProtectedRoute allowedRoles={['SALES', 'ADMIN']}><SalesForm /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute allowedRoles={['SALES', 'ADMIN']}><CustomerMaster /></ProtectedRoute>} />
            
            <Route path="/status" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><LiveOrderStatus /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}><ManagerDashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><ItemMaster /></ProtectedRoute>} />
          </Routes>
        </div>
      </Router>
    </SocketContext.Provider>
  );
}

// Simple Protected Route wrapper
function ProtectedRoute({ children, allowedRoles }) {
  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  
  if (!role) {
    return <Navigate to={ROUTES.LOGIN} />;
  }
  
  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }
  
  return children;
}

export default App;
