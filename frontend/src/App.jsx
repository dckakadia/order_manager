import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { ClipboardList, Database, Activity, BarChart2, LogOut, Box, FileText } from 'lucide-react';
import { io } from 'socket.io-client';
import { createContext, useEffect, useState } from 'react';
import { Browser } from '@capacitor/browser';
import config from './config';
import { apiFetch, clearAuthStorage, getPermissions } from './apiUtils';
import { STORAGE_KEYS, USER_ROLES, ROUTES, ERROR_MESSAGES } from './constants';
import { cleanupPushNotifications } from './pushNotifications';
import SalesForm from './SalesForm';
import LiveOrderStatus from './LiveOrderStatus';
import ManagerDashboard from './ManagerDashboard';
import Report from './Report';
import Master from './Master';
import Login from './Login';
import DeliveredOrders from './DeliveredOrders';
import NotificationBell from './NotificationBell';

export const SocketContext = createContext();

const isNewerVersion = (latest, current) => {
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

// Fetches release info and returns { version, downloadUrl } if a newer version exists, otherwise null.
// Throws on network/server failure so callers can distinguish "no update" from "couldn't check".
const fetchAvailableUpdate = async () => {
  const result = await apiFetch(`${config.api.baseURL}/api/system/update-check`);
  if (!result.ok) throw new Error(result.error || ERROR_MESSAGES.NETWORK_ERROR);

  const data = result.data;
  if (!data.success || !data.data || !data.data.latestVersion) return null;
  if (!isNewerVersion(data.data.latestVersion, config.appVersion)) return null;

  let downloadUrl = data.data.downloadUrl;
  if (downloadUrl.startsWith('/')) {
    downloadUrl = `${config.api.baseURL || window.location.origin}${downloadUrl}`;
  }
  return { version: data.data.latestVersion, downloadUrl };
};

function Navigation() {
  const location = useLocation();
  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  const isAdmin = role === 'ADMIN';
  const permissions = getPermissions();
  const [socketConnected, setSocketConnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  // Auto-check for updates once on load — surfaces a dismissible banner instead of
  // requiring the user to tap "Check Update". Important for users still on an old
  // (pre-rebrand) build, who have no other way of learning a new app exists.
  useEffect(() => {
    fetchAvailableUpdate()
      .then(update => {
        if (!update) return;
        const dismissedVersion = localStorage.getItem(STORAGE_KEYS.DISMISSED_UPDATE_VERSION);
        if (dismissedVersion === update.version) return;
        setUpdateInfo(update);
      })
      .catch(error => console.error('Auto update check failed:', error));
  }, []);

  const installUpdate = async () => {
    if (!updateInfo) return;
    await Browser.open({ url: updateInfo.downloadUrl });
  };

  const dismissUpdateBanner = () => {
    if (updateInfo) {
      localStorage.setItem(STORAGE_KEYS.DISMISSED_UPDATE_VERSION, updateInfo.version);
    }
    setUpdateInfo(null);
  };

  const handleLogout = async () => {
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/auth/logout`, { method: 'POST' });
      if (!result.ok) {
        console.error('Logout error:', result.error);
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Unregister this device's push token before clearing auth (needs the token to still be present)
      await cleanupPushNotifications();
      // Clear auth storage (not all localStorage)
      clearAuthStorage();
      window.location.href = ROUTES.LOGIN;
    }
  };

  return (
    <>
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="logo-icon">🌊</div>
          <h1 className="app-name" style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: 0 }}>
            Mivox Spas
            <span style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.7, background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px' }}>
              v{config.appVersion}
            </span>
          </h1>
        </div>
        {role && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <NotificationBell />
            <button
              onClick={handleLogout}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title={socketConnected ? 'Connected' : 'Offline'}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        )}
      </header>
      {updateInfo && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: '#0f172a', color: 'white', padding: '0.6rem 1rem', fontSize: '13px' }}>
          <span>
            🎉 New version available (v{updateInfo.version}). If it doesn't install as an update, uninstall the old app first.
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button onClick={installUpdate} style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '0.35rem 0.7rem', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
              Update Now
            </button>
            <button onClick={dismissUpdateBanner} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.35rem 0.6rem', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        </div>
      )}
      {role && (
        <nav className="bottom-nav">
          {(isAdmin || permissions.sales?.canView) && (
            <Link to="/sales" className={`bottom-nav-item ${location.pathname === '/sales' ? 'active' : ''}`}>
              <ClipboardList size={24} />
              <span>New Order</span>
            </Link>
          )}

          {(isAdmin || permissions.status?.canView) && (
            <Link to="/status" className={`bottom-nav-item ${location.pathname === '/status' ? 'active' : ''}`}>
              <Activity size={24} />
              <span>Live Orders</span>
            </Link>
          )}

          {(isAdmin || permissions.delivered?.canView) && (
            <Link to="/delivered" className={`bottom-nav-item ${location.pathname === '/delivered' ? 'active' : ''}`}>
              <Box size={24} />
              <span>Delivered</span>
            </Link>
          )}

          {(isAdmin || permissions.customers?.canView || permissions.items?.canView) && (
            <Link to="/master" className={`bottom-nav-item ${location.pathname === '/master' ? 'active' : ''}`}>
              <Database size={24} />
              <span>Master</span>
            </Link>
          )}

          {(isAdmin || permissions.report?.canView) && (
            <Link to="/report" className={`bottom-nav-item ${location.pathname === '/report' ? 'active' : ''}`}>
              <FileText size={24} />
              <span>Report</span>
            </Link>
          )}

          {(isAdmin || permissions.dashboard?.canView) && (
            <Link to="/dashboard" className={`bottom-nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}>
              <BarChart2 size={24} />
              <span>Admin</span>
            </Link>
          )}

        </nav>
      )}
    </>
  );
}

function RootRedirect() {
  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  
  if (!role) return <Navigate to={ROUTES.LOGIN} />;
  if (role === USER_ROLES.MANAGER) return <Navigate to={ROUTES.STATUS} />;
  return <Navigate to={ROUTES.SALES} />;
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

    // Refresh cached page permissions on every app mount, so admin changes take effect
    // without requiring re-login (only for logged-in users — silently no-ops otherwise).
    if (localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)) {
      apiFetch(`${config.api.baseURL}/api/users/me/permissions`)
        .then(result => {
          if (result.ok) {
            localStorage.setItem(STORAGE_KEYS.USER_PERMISSIONS, JSON.stringify(result.data.data));
          }
        })
        .catch(error => console.error('Permissions fetch error:', error));
    }

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
            
            <Route path="/sales" element={<ProtectedRoute requiredPage="sales"><SalesForm /></ProtectedRoute>} />

            <Route path="/status" element={<ProtectedRoute requiredPage="status"><LiveOrderStatus /></ProtectedRoute>} />
            <Route path="/delivered" element={<ProtectedRoute requiredPage="delivered"><DeliveredOrders /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute requiredPage="dashboard"><ManagerDashboard /></ProtectedRoute>} />
            <Route path="/report" element={<ProtectedRoute requiredPage="report"><Report /></ProtectedRoute>} />
            <Route path="/master" element={<ProtectedRoute requiredPage={['customers', 'items']}><Master /></ProtectedRoute>} />
          </Routes>
        </div>
      </Router>
    </SocketContext.Provider>
  );
}

// Simple Protected Route wrapper. Pass either `requiredPage` (checked against the
// current user's per-page permissions — a string, or an array for a union check when
// a route merges multiple pages) or `allowedRoles` (hardcoded role check, for routes
// that should never be permission-customizable).
function ProtectedRoute({ children, allowedRoles, requiredPage }) {
  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);

  if (!role) {
    return <Navigate to={ROUTES.LOGIN} />;
  }

  if (role === 'ADMIN') {
    return children;
  }

  const accessDenied = (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Access Denied</h2>
      <p>You do not have permission to view this page.</p>
    </div>
  );

  if (requiredPage) {
    const permissions = getPermissions();
    const pages = Array.isArray(requiredPage) ? requiredPage : [requiredPage];
    if (!pages.some(page => permissions[page]?.canView)) {
      return accessDenied;
    }
  } else if (allowedRoles && !allowedRoles.includes(role)) {
    return accessDenied;
  }

  return children;
}

export default App;
