import { useState, useEffect, useContext } from 'react';
import { SocketContext } from './App';
import { ArrowRight, Box, CheckCircle2, Pencil, Trash2, XCircle, X } from 'lucide-react';

const API_BASE = 'http://116.74.77.22:3000';

const STAGES = [
  'Order Form Received',
  'Start Production',
  'Finish Production',
  'Order Ready For Dispatch',
  'Order Dispatched',
  'Delivered'
];

export default function LiveOrderStatus() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [editingOrder, setEditingOrder] = useState(null);
  const socket = useContext(SocketContext);
  const role = localStorage.getItem('ocean_spas_role');

  useEffect(() => {
    fetch(`${API_BASE}/api/orders`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` }
    })
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(() => setError('Failed to load orders.'));

    if (!socket) return;

    socket.on('new_order', (newOrder) => {
      setOrders(prev => [newOrder, ...prev]);
    });

    socket.on('order_status_updated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    socket.on('order_deleted', (id) => {
      setOrders(prev => prev.filter(o => o.id !== id));
    });

    return () => {
      socket.off('new_order');
      socket.off('order_status_updated');
      socket.off('order_deleted');
    };
  }, [socket]);

  const advanceStatus = async (orderId, currentStatus) => {
    const currentIndex = STAGES.indexOf(currentStatus);
    if (currentIndex < STAGES.length - 1) {
      const nextStatus = STAGES[currentIndex + 1];
      try {
        // BUG FIX #3: Use full API_BASE URL instead of relative path
        const res = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}`
          },
          body: JSON.stringify({ status: nextStatus })
        });
        if (!res.ok) throw new Error('Status update failed');
      } catch {
        setError('Failed to update order status. Please try again.');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this order?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` }
      });
      if (!res.ok) throw new Error('Delete failed');
    } catch {
      setError('Failed to delete order.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` 
        },
        body: JSON.stringify({ status: 'Cancelled' })
      });
      if (!res.ok) throw new Error('Cancel failed');
    } catch {
      setError('Failed to cancel order.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}`
        },
        body: JSON.stringify(editingOrder)
      });
      if (!res.ok) throw new Error('Update failed');
      setEditingOrder(null);
    } catch {
      setError('Failed to update order.');
      setTimeout(() => setError(''), 3000);
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
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Live Order Board</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--secondary)', animation: 'pulse 2s infinite' }}></div>
          Live Sync Active
        </div>
      </div>

      {error && <div className="badge badge-start" style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}>{error}</div>}

      <div className="order-list">
        {orders.map(order => {
          const isDelivered = order.status === 'Delivered';
          return (
            <div className="order-card" key={order.id} style={{ opacity: isDelivered ? 0.6 : 1 }}>
              <div className="order-card-header">
                <span className="order-id">#{order.id}</span>
                <span className={`badge ${getBadgeClass(order.status)}`}>{order.status}</span>
              </div>
              <div className="order-customer-name">{order.customerName}</div>
              <div className="order-phone">{order.phone}</div>
              <div style={{ marginBottom: '8px' }}>
                <span className="order-model">{order.baseModel}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '8px' }}>
                <strong>Total:</strong> ₹{order.totalPrice?.toLocaleString('en-IN')}
                <br />
                <strong>Notes:</strong> {order.notes || '—'}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <div className="order-date">
                  Delivery: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN') : 'Not Set'}
                </div>
                {!isDelivered && order.status !== 'Cancelled' ? (
                  <button
                    onClick={() => advanceStatus(order.id, order.status)}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', minHeight: '36px' }}
                  >
                    Advance <ArrowRight size={14} />
                  </button>
                ) : (
                  <span style={{ color: order.status === 'Cancelled' ? 'var(--danger)' : 'var(--secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                    {order.status === 'Cancelled' ? <XCircle size={14} /> : <CheckCircle2 size={14} />} 
                    {order.status === 'Cancelled' ? 'Cancelled' : 'Completed'}
                  </span>
                )}
              </div>
              
              {role === 'ADMIN' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
                  <button onClick={() => setEditingOrder(order)} className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '12px', minHeight: '32px' }}>
                    <Pencil size={14} /> Edit
                  </button>
                  {order.status !== 'Cancelled' && (
                    <button onClick={() => handleCancel(order.id)} className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '12px', minHeight: '32px', color: '#b91c1c' }}>
                      <XCircle size={14} /> Cancel
                    </button>
                  )}
                  <button onClick={() => handleDelete(order.id)} className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '12px', minHeight: '32px', color: '#b91c1c', borderColor: '#fee2e2', background: '#fff5f5' }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-light)' }}>
            <Box size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No orders yet. Waiting for sales team...</p>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}} />

      {/* EDIT MODAL */}
      {editingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', background: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Edit Order #{editingOrder.id}</h3>
              <button onClick={() => setEditingOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label required">Customer Name</label>
                <input type="text" className="form-control" required value={editingOrder.customerName} onChange={e => setEditingOrder({...editingOrder, customerName: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input type="tel" inputMode="tel" className="form-control" value={editingOrder.phone} onChange={e => setEditingOrder({...editingOrder, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label required">Base Model</label>
                <input type="text" className="form-control" required value={editingOrder.baseModel} onChange={e => setEditingOrder({...editingOrder, baseModel: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Date</label>
                <input type="date" className="form-control" value={editingOrder.deliveryDate ? editingOrder.deliveryDate.split('T')[0] : ''} onChange={e => setEditingOrder({...editingOrder, deliveryDate: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={3} value={editingOrder.notes || ''} onChange={e => setEditingOrder({...editingOrder, notes: e.target.value})}></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
