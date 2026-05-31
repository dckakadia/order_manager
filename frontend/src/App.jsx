import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { ClipboardList, Users, Activity, BarChart2, Settings, LogOut } from 'lucide-react';
import { io } from 'socket.io-client';
import { createContext, useEffect, useState } from 'react';
import config, { apiFetch } from './config';
import SalesForm from './SalesForm';
import LiveOrderStatus from './LiveOrderStatus';
import ManagerDashboard from './ManagerDashboard';
import ItemMaster from './ItemMaster';
import CustomerMaster from './CustomerMaster';
import Login from './Login';

export const SocketContext = createContext();

function Navigation() {
  const location = useLocation();
  const role = localStorage.getItem(config.storage.userRole);

  const handleLogout = async () => {
    try {
      await apiFetch(`${config.api.baseURL}/api/auth/logout`, { method: 'POST' });
    } catch (e) {}
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <>
      <header className="app-header">
        <div className="logo-icon">🌊</div>
        <h1 className="app-name">Ocean Spas</h1>
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
  const role = localStorage.getItem(config.storage.userRole);
  
  if (!role) return <Navigate to="/login" />;
  if (role === 'MANAGER') return <Navigate to="/status" />;
  if (role === 'SALES') return <Navigate to="/sales" />;
  return <Navigate to="/admin" />;
}

function App() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Fetch CSRF token on app load
    apiFetch(`${config.api.baseURL}/api/csrf-token`).catch(() => {});

    // CRITICAL FIX: Use environment variables for API URL
    const newSocket = io(config.api.socketURL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });
    setSocket(newSocket);
    
    return () => newSocket.close();
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
  const role = localStorage.getItem(config.storage.userRole);
  
  if (!role) {
    return <Navigate to="/login" />;
  }
  
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><h2>Access Denied</h2><p>You do not have permission to view this page.</p></div>;
  }
  
  return children;
}

export default App;
