import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { ClipboardList, Users, Activity, BarChart2, Settings, LogOut } from 'lucide-react';
import { io } from 'socket.io-client';
import { createContext, useEffect, useState } from 'react';
import SalesForm from './SalesForm';
import LiveOrderStatus from './LiveOrderStatus';
import ManagerDashboard from './ManagerDashboard';
import ItemMaster from './ItemMaster';
import CustomerMaster from './CustomerMaster';
import Login from './Login';

export const SocketContext = createContext();

function Navigation() {
  const location = useLocation();
  const token = localStorage.getItem('ocean_spas_auth_token');
  const role = localStorage.getItem('ocean_spas_role');

  return (
    <>
      <header className="app-header">
        <div className="logo-icon">🌊</div>
        <h1 className="app-name">Ocean Spas</h1>
      </header>
      {token && (
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
            onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
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
  const token = localStorage.getItem('ocean_spas_auth_token');
  const role = localStorage.getItem('ocean_spas_role');
  
  if (!token) return <Navigate to="/login" />;
  if (role === 'MANAGER') return <Navigate to="/status" />;
  if (role === 'SALES') return <Navigate to="/sales" />;
  return <Navigate to="/admin" />;
}

function App() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to backend
    const newSocket = io('http://116.74.77.22:3000');
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
  const token = localStorage.getItem('ocean_spas_auth_token');
  const role = localStorage.getItem('ocean_spas_role');
  
  if (!token) {
    return <Navigate to="/login" />;
  }
  
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><h2>Access Denied</h2><p>You do not have permission to view this page.</p></div>;
  }
  
  return children;
}

export default App;
