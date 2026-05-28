import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { createContext, useEffect, useState } from 'react';
import SalesForm from './SalesForm';
import LiveOrderStatus from './LiveOrderStatus';
import ManagerDashboard from './ManagerDashboard';
import ItemMaster from './ItemMaster';
import CustomerMaster from './CustomerMaster';
import Login from './Login';

export const SocketContext = createContext();

function App() {
  const [socket, setSocket] = useState(null);
  
  const token = localStorage.getItem('ocean_spas_auth_token');
  const role = localStorage.getItem('ocean_spas_role');

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
          <nav className="nav-header">
            <h2>🌊 Ocean Spas Order Manager</h2>
            <div className="nav-links">
              {token && (
                <>
                  {(role === 'SALES' || role === 'ADMIN') && (
                    <>
                      <Link to="/sales" className="nav-link">Sales View</Link>
                      <Link to="/customers" className="nav-link">Customer Master</Link>
                    </>
                  )}
                  
                  {(role === 'MANAGER' || role === 'ADMIN') && (
                    <>
                      <Link to="/status" className="nav-link">Live Order Status</Link>
                      <Link to="/dashboard" className="nav-link">Metrics Dashboard</Link>
                    </>
                  )}
                  
                  {role === 'ADMIN' && (
                    <Link to="/admin" className="nav-link">Item Master</Link>
                  )}
                  
                  <button 
                    onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
                    className="btn btn-secondary" 
                    style={{ marginLeft: '1rem', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </nav>
          
          <Routes>
            <Route path="/" element={token ? (role === 'MANAGER' ? <Navigate to="/status" /> : (role === 'SALES' ? <Navigate to="/sales" /> : <Navigate to="/admin" />)) : <Navigate to="/login" />} />
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
