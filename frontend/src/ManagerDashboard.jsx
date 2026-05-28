import { useState, useEffect, useContext } from 'react';
import { DollarSign, Package, CheckCircle, Clock } from 'lucide-react';
import { SocketContext } from './App';

const API_BASE = 'http://116.74.77.22:3000';

export default function ManagerDashboard() {
  const [orders, setOrders] = useState([]);
  const socket = useContext(SocketContext);

  const fetchOrders = () => {
    fetch(`${API_BASE}/api/orders`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` }
    })
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // BUG FIX #9: Subscribe to Socket.IO events so dashboard updates in real-time
  useEffect(() => {
    if (!socket) return;

    socket.on('new_order', (newOrder) => {
      setOrders(prev => [newOrder, ...prev]);
    });

    socket.on('order_status_updated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    return () => {
      socket.off('new_order');
      socket.off('order_status_updated');
    };
  }, [socket]);

  // BUG FIX #10: Use ₹ (Indian Rupee) instead of $ for currency
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
  const activeOrders = orders.filter(o => o.status !== 'Delivered').length;
  const completedOrders = orders.filter(o => o.status === 'Delivered').length;
  const totalOrders = orders.length;

  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid-1" style={{ gap: '2rem' }}>

      {/* Top Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: '#3b82f6' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.875rem' }}>Total Revenue</p>
            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem' }}>₹{totalRevenue.toLocaleString('en-IN')}</h3>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.875rem' }}>Active Pipeline</p>
            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem' }}>{activeOrders} Orders</h3>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.875rem' }}>Completed</p>
            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem' }}>{completedOrders} Orders</h3>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', color: '#8b5cf6' }}>
            <Package size={24} />
          </div>
          <div>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.875rem' }}>Total Orders</p>
            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem' }}>{totalOrders}</h3>
          </div>
        </div>

      </div>

      {/* Pipeline Breakdown */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={20} /> Production Pipeline Breakdown
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 500 }}>{status}</span>
              <span className="badge badge-secondary" style={{ fontSize: '1rem', padding: '0.25rem 0.75rem' }}>{count}</span>
            </div>
          ))}
          {Object.keys(statusCounts).length === 0 && (
            <p style={{ color: 'var(--text-light)' }}>No orders in pipeline yet.</p>
          )}
        </div>
      </div>

    </div>
  );
}
