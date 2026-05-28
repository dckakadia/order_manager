import { useState, useEffect, useContext } from 'react';
import { SocketContext } from './App';
import { ArrowRight, Box, CheckCircle2 } from 'lucide-react';

const STAGES = [
  'Order Form Received',
  'Start Production',
  'Finish Production',
  'Order Ready For Dispatch',
  'Order Dispatched',
  'Delivered'
];

export default function ManagerDashboard() {
  const [orders, setOrders] = useState([]);
  const socket = useContext(SocketContext);

  useEffect(() => {
    // Fetch initial orders
    fetch('/api/orders', {
      headers: { 'x-pin': localStorage.getItem('ocean_spas_auth_token') }
    })
      .then(res => res.json())
      .then(data => setOrders(data));

    if (!socket) return;

    // Listen for real-time new orders
    socket.on('new_order', (newOrder) => {
      setOrders(prev => [newOrder, ...prev]);
    });

    // Listen for real-time status updates
    socket.on('order_status_updated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    return () => {
      socket.off('new_order');
      socket.off('order_status_updated');
    };
  }, [socket]);

  const advanceStatus = async (orderId, currentStatus) => {
    const currentIndex = STAGES.indexOf(currentStatus);
    if (currentIndex < STAGES.length - 1) {
      const nextStatus = STAGES[currentIndex + 1];
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-pin': localStorage.getItem('ocean_spas_auth_token')
        },
        body: JSON.stringify({ status: nextStatus })
      });
    }
  };

  const getBadgeClass = (status) => {
    if (status === 'Order Form Received') return 'badge-received';
    if (status === 'Start Production') return 'badge-start';
    if (status === 'Finish Production') return 'badge-finish';
    if (status === 'Order Ready For Dispatch') return 'badge-ready';
    if (status === 'Order Dispatched') return 'badge-dispatched';
    if (status === 'Delivered') return 'badge-delivered';
    return '';
  };

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Live Order Board</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--secondary)', animation: 'pulse 2s infinite' }}></div>
          Live Sync Active
        </div>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Model</th>
              <th>Delivery Date</th>
              <th>Total</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              const isDelivered = order.status === 'Delivered';
              return (
                <tr key={order.id} style={{ opacity: isDelivered ? 0.6 : 1 }}>
                  <td style={{ fontWeight: 600 }}>#{order.id}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{order.customerName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{order.phone}</div>
                  </td>
                  <td>{order.baseModel}</td>
                  <td>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'Not Set'}</td>
                  <td style={{ fontWeight: 600 }}>{order.totalPrice.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${getBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    {!isDelivered ? (
                      <button 
                        onClick={() => advanceStatus(order.id, order.status)} 
                        className="btn btn-primary" 
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      >
                        Advance <ArrowRight size={14} />
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-light)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle2 size={14} /> Completed
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {orders.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-light)' }}>
                  <Box size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p>No orders yet. Waiting for sales team...</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}} />
    </div>
  );
}
