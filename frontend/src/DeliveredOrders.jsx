import { useState, useEffect, useContext } from 'react';
import { SocketContext } from './App';
import config from './config';
import { apiFetch, canEditPage, canDeletePage } from './apiUtils';
import { STORAGE_KEYS, ERROR_MESSAGES } from './constants';
import { Box, CheckCircle2, Share2, Pencil, Trash2, XCircle, X, Calendar } from 'lucide-react';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import html2canvas from 'html2canvas';
import OrderPhotos from './OrderPhotos';
import ItemPhoto from './ItemPhoto';
import PhotoModal from './PhotoModal';

export default function DeliveredOrders() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [modalPhoto, setModalPhoto] = useState(null);
  const socket = useContext(SocketContext);
  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  const canEdit = canEditPage('delivered');
  const canDelete = canDeletePage('delivered');

  const sortOrders = (ordersList) => {
    return [...ordersList].sort((a, b) => {
      return new Date(b.updatedAt) - new Date(a.updatedAt); // Sort delivered orders by recently delivered
    });
  };

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/orders?page=${page}&limit=20&status=Delivered`);
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

  const handleShareOrder = async (order) => {
    try {
      const receiptElement = document.getElementById(`receipt-capture-${order.id}`);
      if (!receiptElement) return;
      
      const canvas = await html2canvas(receiptElement, { scale: 2 });
      const base64Data = canvas.toDataURL('image/png').split(',')[1];
      
      const fileName = `order_${order.id}_${Date.now()}.png`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache
      });
      
      const shareText = `Mivox Spas Order #${order.id}\n\nCustomer: ${order.customerName}\nModel: ${order.baseModel} ${order.variant ? `(${order.variant})` : ''}\nTotal Price: ₹${Number(order.totalPrice || 0).toLocaleString('en-IN')}\nNotes: ${order.notes || 'None'}`;
      
      await Share.share({
        title: `Mivox Spas Order #${order.id}`,
        text: shareText,
        url: savedFile.uri,
        dialogTitle: 'Share Order Receipt'
      });
    } catch (err) {
      console.error('Share error:', err);
      // Fallback
      const text = `Mivox Spas Order #${order.id}\n\nCustomer: ${order.customerName}\nModel: ${order.baseModel} ${order.variant ? `(${order.variant})` : ''}\nTotal Price: ₹${Number(order.totalPrice || 0).toLocaleString('en-IN')}\nNotes: ${order.notes || 'None'}`;
      if (navigator.share) {
        navigator.share({ title: `Mivox Spas Order #${order.id}`, text }).catch(() => {});
      } else {
        window.open(`mailto:?subject=Order ${order.id} Details&body=${encodeURIComponent(text)}`);
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingOrder)
      });
      if (!res.ok) throw new Error('Update failed');
      
      // Update local state directly so it reflects without page reload
      setOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, ...editingOrder } : o));
      setEditingOrder(null);
    } catch {
      setError('Failed to update order.');
      setTimeout(() => setError(''), 3000);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page]);

  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (newOrder) => {
      if (newOrder.status === 'Delivered') {
        setOrders(prev => sortOrders([newOrder, ...prev]));
      }
    };

    const handleOrderStatusUpdated = (updatedOrder) => {
      setOrders(prev => {
        if (updatedOrder.status === 'Delivered') {
          // If it was already in the list, update it. If not, add it.
          const exists = prev.some(o => o.id === updatedOrder.id);
          if (exists) {
            return sortOrders(prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
          } else {
            return sortOrders([updatedOrder, ...prev]);
          }
        } else {
          // If status changed away from Delivered, remove it
          return prev.filter(o => o.id !== updatedOrder.id);
        }
      });
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

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Delivered Orders</h2>
      </div>

      {error && <div className="badge badge-start" style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}>{error}</div>}

      <div className="order-list">
        {orders.map(order => (
          <div className="order-card" key={order.id} style={{ opacity: 0.8 }}>
            <div className="order-card-header">
              <span className="order-id">#{order.id}</span>
              <span className="badge badge-delivered">{order.status}</span>
            </div>
            <div className="order-customer-name">{order.customerName}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '8px' }}>
              Delivered: {new Date(order.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ItemPhoto photoFilename={order.itemPhoto} onClick={() => setModalPhoto(order.itemPhoto)} />
              <span className="order-model">{order.baseModel} {order.variant && `(${order.variant})`}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px', overflowWrap: 'break-word' }}>
              <div><strong>Faucet Position:</strong> {order.faucetPosition || 'Not Specified'}</div>
              <div><strong>Side Panel:</strong> {order.sidePanel || 'Not Specified'}</div>
              <div><strong>Order By:</strong> {order.orderBy || 'Not Specified'}</div>
              <div><strong>Notes:</strong> {order.notes || '—'}</div>
            </div>
            
            <OrderPhotos orderId={order.id} />

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <div className="order-date">
                <span style={{ color: 'var(--secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                  <CheckCircle2 size={14} /> Completed
                </span>
              </div>
              {!canEdit && (
                <button onClick={() => handleShareOrder(order)} style={{ background: 'transparent', border: '1.5px solid #e0e5f0', borderRadius: '99px', padding: '6px 12px', color: 'var(--text)', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <Share2 size={14} /> Share
                </button>
              )}
            </div>

            <div id={`receipt-capture-${order.id}`} style={{ position: 'absolute', top: '-9999px', left: '-9999px', background: '#fff', padding: '30px', width: '500px', fontFamily: 'sans-serif', borderRadius: '12px', zIndex: -1 }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: '#0f172a', margin: '0 0 8px 0', fontSize: '24px' }}>MIVOX SPAS</h2>
                <p style={{ color: '#64748b', margin: 0 }}>Order Receipt #{order.id}</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#1e293b' }}>
                <tbody>
                  <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Customer</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.customerName}</td></tr>
                  <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Phone</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.phone || 'N/A'}</td></tr>
                  <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Model</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.baseModel}</td></tr>
                  <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Variant</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.variant || 'None'}</td></tr>
                  <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Faucet</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.faucetPosition || 'Not Specified'}</td></tr>
                  <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Side Panel</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.sidePanel || 'Not Specified'}</td></tr>
                  <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Delivery</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN') : 'Not Set'}</td></tr>
                  <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Order By</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.orderBy}</td></tr>
                  <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', verticalAlign: 'top' }}>Notes</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{order.notes || 'None'}</td></tr>
                  <tr><td style={{ padding: '16px 8px', fontWeight: 'bold', fontSize: '20px' }}>Total Price</td><td style={{ padding: '16px 8px', fontWeight: 'bold', fontSize: '22px', color: '#10b981' }}>₹{Number(order.totalPrice || 0).toLocaleString('en-IN')}</td></tr>
                </tbody>
              </table>
              <div style={{ textAlign: 'center', marginTop: '30px', color: '#64748b', fontSize: '12px' }}>
                Thank you for choosing Mivox Spas!
              </div>
            </div>

            {canEdit && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
                <button onClick={() => handleShareOrder(order)} className="btn btn-secondary" style={{ flex: '1 1 calc(50% - 4px)', padding: '0.4rem', fontSize: '12px', minHeight: '32px', borderRadius: '99px' }}>
                  <Share2 size={14} /> Share
                </button>
                <button onClick={() => setEditingOrder(order)} className="btn btn-secondary" style={{ flex: '1 1 calc(50% - 4px)', padding: '0.4rem', fontSize: '12px', minHeight: '32px', borderRadius: '99px' }}>
                  <Pencil size={14} /> Edit
                </button>
                {order.status !== 'Cancelled' && role === 'ADMIN' && (
                  <button onClick={() => handleCancel(order.id)} className="btn btn-secondary" style={{ flex: '1 1 calc(50% - 4px)', padding: '0.4rem', fontSize: '12px', minHeight: '32px', color: '#e03131', borderRadius: '99px' }}>
                    <XCircle size={14} /> Cancel
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(order.id)} className="btn btn-secondary" style={{ flex: '1 1 calc(50% - 4px)', padding: '0.4rem', fontSize: '12px', minHeight: '32px', color: '#e03131', borderColor: '#fee2e2', background: '#fff5f5', borderRadius: '99px' }}>
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-light)' }}>
            <Box size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No delivered orders yet.</p>
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
                <input type="text" className="form-control" required value={editingOrder.customerName || ''} onChange={e => setEditingOrder({...editingOrder, customerName: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input type="tel" inputMode="tel" className="form-control" value={editingOrder.phone || ''} onChange={e => setEditingOrder({...editingOrder, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label required">Base Model</label>
                <input type="text" className="form-control" required value={editingOrder.baseModel || ''} onChange={e => setEditingOrder({...editingOrder, baseModel: e.target.value})} />
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
