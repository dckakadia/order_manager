import { useState, useEffect } from 'react';
import { DollarSign, Package, CheckCircle, Clock } from 'lucide-react';

export default function ManagerDashboard() {
  const [orders, setOrders] = useState([]);
  
  useEffect(() => {
    fetch('http://116.74.77.22:3000/api/orders', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` }
    })
      .then(res => res.json())
      .then(data => setOrders(data));
  }, []);

  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
  const activeOrders = orders.filter(o => o.status !== 'Delivered').length;
  const completedOrders = orders.filter(o => o.status === 'Delivered').length;
  
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
            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem' }}>${totalRevenue.toLocaleString()}</h3>
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

      </div>

      {/* Pipeline Breakdown */}
      <div className="glass-card" style={{ padding: '2rem' }}>
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
