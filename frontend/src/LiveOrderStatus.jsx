import { useState, useEffect, useContext } from 'react';
import { SocketContext } from './App';
import config from './config';
import { apiFetch, canEditPage, canDeletePage } from './apiUtils';
import { STORAGE_KEYS, ERROR_MESSAGES } from './constants';
import { ArrowRight, Box, CheckCircle2, Pencil, Trash2, XCircle, X } from 'lucide-react';
import OrderPhotos from './OrderPhotos';
import ItemPhoto from './ItemPhoto';
import PhotoModal from './PhotoModal';

const STAGES = [
  'Order Form Received',
  'Start Production',
  'Finish Production',
  'Order Ready For Dispatch',
  'Order Dispatched',
  'Delivered'
];

const renderDeliveryDate = (dateString) => {
  // BUG FIX #23: Add null safety and invalid date handling
  if (!dateString || dateString === '' || dateString === 'null') {
    return <span style={{ padding: '0.4rem 0.75rem', background: '#f1f5f9', color: '#64748b', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.95rem' }}>Not Set</span>;
  }
  
  const dDate = new Date(dateString);
  // Check if date is valid
  if (isNaN(dDate.getTime())) {
    return <span style={{ padding: '0.4rem 0.75rem', background: '#f1f5f9', color: '#64748b', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.95rem' }}>Invalid Date</span>;
  }
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const diffDays = Math.floor((dDate - today) / (1000 * 60 * 60 * 24));
  
  let bgColor = '#f0fdf4';
  let color = '#166534';
  let border = '1px solid #bbf7d0';
  let label = 'Delivery: ';
  
  if (diffDays < 0) {
    bgColor = '#fef2f2';
    color = '#991b1b';
    border = '1px solid #fecaca';
    label = '⚠️ OVERDUE: ';
  } else if (diffDays <= 3) {
    bgColor = '#fff7ed';
    color = '#9a3412';
    border = '1px solid #fed7aa';
    label = '⏳ URGENT: ';
  }
  
  return (
    <div style={{
      background: bgColor, color, border, 
      padding: '0.4rem 0.75rem', borderRadius: '6px', 
      fontWeight: 'bold', fontSize: '0.95rem',
      display: 'inline-block'
    }}>
      {label}{dDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
    </div>
  );
};

export default function LiveOrderStatus() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [modalPhoto, setModalPhoto] = useState(null);
  const socket = useContext(SocketContext);
  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  const canEdit = canEditPage('status');
  const canDelete = canDeletePage('status');

  const sortOrders = (ordersList) => {
    return [...ordersList].sort((a, b) => {
      if (!a.deliveryDate) return 1;
      if (!b.deliveryDate) return -1;
      return new Date(a.deliveryDate) - new Date(b.deliveryDate);
    });
  };

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/orders?page=${page}&limit=20&excludeStatus=Delivered`);
      if (!result.ok) {
        console.error('Failed to load orders:', result.error);
        setError('Unable to load orders. Please try again.');
        return;
      }
      const data = result.data;
      const ordersArray = Array.isArray(data) ? data : (data.data || []);
      setOrders(sortOrders(ordersArray));
      if (data.pagination) setTotalPages(data.pagination.pages || 1);
      setError('');
    } catch (err) {
      console.error('Fetch orders error:', err);
      setError(ERROR_MESSAGES.NETWORK_ERROR);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page]);

  // BUG FIX #24: Socket.IO listener cleanup with named handlers
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (newOrder) => {
      setOrders(prev => sortOrders([newOrder, ...prev]));
    };

    const handleOrderStatusUpdated = (updatedOrder) => {
      setOrders(prev => sortOrders(prev.map(o => o.id === updatedOrder.id ? updatedOrder : o)));
    };

    const handleOrderDeleted = (id) => {
      setOrders(prev => prev.filter(o => o.id !== id));
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_status_updated', handleOrderStatusUpdated);
    socket.on('order_deleted', handleOrderDeleted);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_updated', handleOrderStatusUpdated);
      socket.off('order_deleted', handleOrderDeleted);
    };
  }, [socket]);

  const advanceStatus = async (orderId, currentStatus) => {
    const currentIndex = STAGES.indexOf(currentStatus);
    if (currentIndex < STAGES.length - 1) {
      const nextStatus = STAGES[currentIndex + 1];
      try {
        // BUG FIX #3: Use full config.api.baseURL URL instead of relative path
        const res = await apiFetch(`${config.api.baseURL}/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
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

  const reverseStatus = async (orderId, currentStatus) => {
    const currentIndex = STAGES.indexOf(currentStatus);
    if (currentIndex > 0) {
      const prevStatus = STAGES[currentIndex - 1];
      if (!window.confirm(`Are you sure you want to move this order back to ${prevStatus}?`)) return;
      try {
        const res = await apiFetch(`${config.api.baseURL}/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: prevStatus })
        });
        if (!res.ok) throw new Error('Status update failed');
      } catch {
        setError('Failed to reverse order status. Please try again.');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this order?')) return;
    try {
      const res = await apiFetch(`${config.api.baseURL}/api/orders/${id}`, {
        method: 'DELETE'
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
      const res = await apiFetch(`${config.api.baseURL}/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
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
      const res = await apiFetch(`${config.api.baseURL}/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
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
        {orders.filter(o => o.status !== 'Delivered').map(order => {
          const isDelivered = false; // Always false now since they are filtered out, but kept for logic below if needed.
          return (
            <div className="order-card" key={order.id} style={{ opacity: isDelivered ? 0.6 : 1 }}>
              <div className="order-card-header">
                <span className="order-id">#{order.id}</span>
                <span className={`badge ${getBadgeClass(order.status)}`}>{order.status}</span>
              </div>
              <div className="order-customer-name">{order.customerName}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '8px' }}>
                Placed: {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
              <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ItemPhoto photoFilename={order.itemPhoto} onClick={() => setModalPhoto(order.itemPhoto)} />
                <span className="order-model">{order.baseModel} {order.variant && `(${order.variant})`}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><span style={{ fontWeight: 'normal' }}>Faucet Position:</span> <strong>{order.faucetPosition || 'Not Specified'}</strong></div>
                <div><span style={{ fontWeight: 'normal' }}>Side Panel:</span> <strong>{order.sidePanel || 'Not Specified'}</strong></div>
                <div><span style={{ fontWeight: 'normal' }}>Notes:</span> <strong>{order.notes || '—'}</strong></div>
                <div><span style={{ fontWeight: 'normal' }}>Order By:</span> <strong>{order.orderBy || 'Not Specified'}</strong></div>
              </div>
              {(order.checkInTime || (order.locationLat && order.locationLng)) && (
                <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px', borderTop: '1px dashed var(--border)' }}>
                  {order.checkInTime && <div><strong>Check-In Time:</strong> {new Date(order.checkInTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>}
                  {order.locationLat && order.locationLng && (
                    <div><strong>Check-In Location:</strong> <a href={`https://maps.google.com/?q=${order.locationLat},${order.locationLng}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>View on Map</a></div>
                  )}
                </div>
              )}
              
              <OrderPhotos orderId={order.id} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <div className="order-date">
                  {renderDeliveryDate(order.deliveryDate)}
                </div>
                {!isDelivered && order.status !== 'Cancelled' ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {canEdit && order.status !== 'Order Form Received' && (
                      <button
                        onClick={() => reverseStatus(order.id, order.status)}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', minHeight: '36px' }}
                      >
                        Reverse ←
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => advanceStatus(order.id, order.status)}
                        className={`btn ${getBadgeClass(order.status)}`}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', minHeight: '36px', border: '1px solid currentColor' }}
                      >
                        Advance <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <span style={{ color: order.status === 'Cancelled' ? 'var(--danger)' : 'var(--secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                    {order.status === 'Cancelled' ? <XCircle size={14} /> : <CheckCircle2 size={14} />} 
                    {order.status === 'Cancelled' ? 'Cancelled' : 'Completed'}
                  </span>
                )}
              </div>
              
              {(canEdit || canDelete) && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
                  {canEdit && (
                    <button onClick={() => setEditingOrder(order)} className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '12px', minHeight: '32px' }}>
                      <Pencil size={14} /> Edit
                    </button>
                  )}
                  {order.status !== 'Cancelled' && role === 'ADMIN' && (
                    <button onClick={() => handleCancel(order.id)} className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '12px', minHeight: '32px', color: '#b91c1c' }}>
                      <XCircle size={14} /> Cancel
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(order.id)} className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '12px', minHeight: '32px', color: '#b91c1c', borderColor: '#fee2e2', background: '#fff5f5' }}>
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {orders.filter(o => o.status !== 'Delivered').length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-light)' }}>
            <Box size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No active orders. All caught up!</p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '2rem', gap: '1rem' }}>
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))} 
          disabled={page === 1}
          className="btn btn-secondary"
        >
          Previous
        </button>
        <span style={{ fontWeight: '500' }}>Page {page} of {totalPages}</span>
        <button 
          onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
          disabled={page >= totalPages}
          className="btn btn-secondary"
        >
          Next
        </button>
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
                <label className="form-label">Variant</label>
                <select className="form-control" value={editingOrder.variant || ''} onChange={e => setEditingOrder({...editingOrder, variant: e.target.value})}>
                  <option value="">-- None --</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                  <option value="Titanium">Titanium</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Faucet Position</label>
                <select className="form-control" value={editingOrder.faucetPosition || ''} onChange={e => setEditingOrder({...editingOrder, faucetPosition: e.target.value})}>
                  <option value="">-- None --</option>
                  <option value="No Faucet">No Faucet</option>
                  <option value="Left Side">Left Side</option>
                  <option value="Right Side">Right Side</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Side Panel</label>
                <select className="form-control" value={editingOrder.sidePanel || ''} onChange={e => setEditingOrder({...editingOrder, sidePanel: e.target.value})}>
                  <option value="">-- None --</option>
                  <option value="Head Side">Head Side</option>
                  <option value="Leg Side">Leg Side</option>
                  <option value="Head + Leg Side">Head + Leg Side</option>
                  <option value="No Side Panel">No Side Panel</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Order By</label>
                <select className="form-control" value={editingOrder.orderBy || ''} onChange={e => setEditingOrder({...editingOrder, orderBy: e.target.value})}>
                  <option value="">-- None --</option>
                  <option value="Manish">Manish</option>
                  <option value="Paresh">Paresh</option>
                  <option value="Devin">Devin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Total Price (₹)</label>
                <input type="number" step="any" className="form-control" value={editingOrder.totalPrice || ''} onChange={e => setEditingOrder({...editingOrder, totalPrice: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginTop: '1.5rem', background: '#fff7ed', padding: '1rem', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                <label className="form-label required" style={{ color: '#9a3412', fontWeight: 'bold' }}>🚨 COMMITTED DELIVERY DATE</label>
                <input type="date" className="form-control" required value={editingOrder.deliveryDate ? editingOrder.deliveryDate.split('T')[0] : ''} onChange={e => setEditingOrder({...editingOrder, deliveryDate: e.target.value})} style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#9a3412', borderColor: '#fed7aa' }} />
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
      
      <PhotoModal photoFilename={modalPhoto} onClose={() => setModalPhoto(null)} />
    </div>
  );
}
