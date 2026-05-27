import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { createContext, useEffect, useState } from 'react';
import SalesForm from './SalesForm';
import ManagerDashboard from './ManagerDashboard';
import ItemMaster from './ItemMaster';
import CustomerMaster from './CustomerMaster';
import Login from './Login';

export const SocketContext = createContext();

function App() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect to backend
    const newSocket = io('http://localhost:3001');
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
              <Link to="/sales" className="nav-link">Sales View</Link>
              <Link to="/manager" className="nav-link">Manager Dashboard</Link>
              <Link to="/admin" className="nav-link">Item Master</Link>
              <Link to="/customers" className="nav-link">Customer Master</Link>
              {localStorage.getItem('ocean_spas_auth_token') && (
                <button 
                  onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
                  className="btn btn-secondary" 
                  style={{ marginLeft: '1rem', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                >
                  Logout
                </button>
              )}
            </div>
          </nav>
          
          <Routes>
            <Route path="/" element={<Navigate to="/sales" />} />
            <Route path="/sales" element={<SalesForm />} />
            <Route path="/login" element={<Login />} />
            <Route path="/manager" element={<ProtectedRoute><ManagerDashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><ItemMaster /></ProtectedRoute>} />
            <Route path="/customers" element={<CustomerMaster />} />
          </Routes>
        </div>
      </Router>
    </SocketContext.Provider>
  );
}

// Simple Protected Route wrapper
function ProtectedRoute({ children }) {
  const isAuth = !!localStorage.getItem('ocean_spas_auth_token');
  if (!isAuth) {
    return <Navigate to="/login" />;
  }
  return children;
}

export default App;
