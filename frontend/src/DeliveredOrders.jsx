import { useState, useEffect, useContext } from 'react';
import { SocketContext } from './App';
import config from './config';
import { apiFetch } from './apiUtils';
import { STORAGE_KEYS, ERROR_MESSAGES } from './constants';
import { Box, CheckCircle2 } from 'lucide-react';
import OrderPhotos from './OrderPhotos';
import ItemPhoto from './ItemPhoto';
import PhotoModal from './PhotoModal';

export default function DeliveredOrders() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [modalPhoto, setModalPhoto] = useState(null);
  const socket = useContext(SocketContext);
  
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
            <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div><strong>Faucet Position:</strong> {order.faucetPosition || 'Not Specified'}</div>
              <div><strong>Side Panel:</strong> {order.sidePanel || 'Not Specified'}</div>
              <div><strong>Order By:</strong> {order.orderBy || 'Not Specified'}</div>
              <div><strong>Notes:</strong> {order.notes || '—'}</div>
            </div>
            
            <OrderPhotos orderId={order.id} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <div className="order-date">
                <span style={{ color: 'var(--secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                  <CheckCircle2 size={14} /> Completed
                </span>
              </div>
            </div>
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

      <PhotoModal photoFilename={modalPhoto} onClose={() => setModalPhoto(null)} />
    </div>
  );
}
