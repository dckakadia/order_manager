import { useState, useEffect, useContext } from 'react';
import { SocketContext } from './App';
import { MapPin, Share2, CheckCircle2, Pencil, Trash2, XCircle, X } from 'lucide-react';

const API_BASE = 'http://116.74.77.22:3000';

export default function SalesForm() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [formData, setFormData] = useState({
    customerName: '', phone: '', email: '', shippingAddress: '', taxNumber: '',
    baseModel: '', deliveryDate: '', notes: '', faucetPosition: 'No Faucet', orderBy: 'Manish', manualPrice: ''
  });

  const [location, setLocation] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const socket = useContext(SocketContext);
  const role = localStorage.getItem('ocean_spas_role');

  const authHeader = { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` };

  const refreshOrders = () => {
    fetch(`${API_BASE}/api/orders`, { headers: authHeader })
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(() => {});
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/items`, { headers: authHeader })
      .then(res => res.json())
      .then(data => setItems(data))
      .catch(() => {});

    fetch(`${API_BASE}/api/customers`, { headers: authHeader })
      .then(res => res.json())
      .then(data => setCustomers(data))
      .catch(() => {});

    refreshOrders();

    if (socket) {
      socket.on('new_order', refreshOrders);
      socket.on('order_status_updated', (updatedOrder) => {
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      });
      socket.on('order_deleted', (id) => {
        setOrders(prev => prev.filter(o => o.id !== id));
      });

      return () => {
        socket.off('new_order', refreshOrders);
        socket.off('order_status_updated');
        socket.off('order_deleted');
      };
    }
  }, [socket]);

  const handleCustomerSelect = (e) => {
    const custId = e.target.value;
    setSelectedCustomerId(custId);
    if (!custId) {
      setFormData({ ...formData, customerName: '', phone: '', email: '', shippingAddress: '', taxNumber: '' });
      return;
    }
    const customer = customers.find(c => c.id.toString() === custId);
    if (customer) {
      setFormData({
        ...formData,
        customerName: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        shippingAddress: customer.shippingAddress || '',
        taxNumber: customer.taxNumber || ''
      });
    }
  };

  const baseModels = items.filter(i => i.category === 'Base Model' || i.category === 'Model' || !i.category);
  const selectedModel = baseModels.find(m => m.id.toString() === formData.baseModel);

  const handleCheckIn = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          time: new Date().toISOString()
        });
      }, () => alert('Unable to get location. Please allow location access.'));
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!formData.baseModel) return alert('Please select a base model');
    if (!selectedCustomerId) return alert('Please select a customer');

    const orderPayload = {
      ...formData,
      baseModel: selectedModel.name,
      basePrice: selectedModel.price,
      totalPrice: Number(formData.manualPrice),
      deliveryDate: formData.deliveryDate,
      notes: formData.notes,
      locationLat: location?.lat,
      locationLng: location?.lng,
      checkInTime: location?.time
    };

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(orderPayload)
      });

      // BUG FIX #5: Check response before marking as submitted
      if (!res.ok) throw new Error('Order submission failed');

      refreshOrders();
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        // BUG FIX #6: Reset customer dropdown + all form state properly
        setSelectedCustomerId('');
        setFormData({ customerName: '', phone: '', email: '', shippingAddress: '', taxNumber: '', baseModel: '', deliveryDate: '', notes: '', faucetPosition: 'No Faucet', orderBy: 'Manish', manualPrice: '' });
        setLocation(null);
      }, 3000);
    } catch {
      setSubmitError('Failed to submit order. Please try again.');
    }
  };

  const handleShare = async () => {
    const text = `Ocean Spas Order\n\nCustomer: ${formData.customerName}\nModel: ${selectedModel?.name}\nTotal Price: ₹${Number(formData.manualPrice).toLocaleString('en-IN')}\nNotes: ${formData.notes || 'None'}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ocean Spas Order Details', text });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      window.open(`mailto:?subject=Order Details&body=${encodeURIComponent(text)}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this order?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}`, {
        method: 'DELETE',
        headers: authHeader
      });
      if (!res.ok) throw new Error('Delete failed');
    } catch {
      setSubmitError('Failed to delete order.');
      setTimeout(() => setSubmitError(''), 3000);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ status: 'Cancelled' })
      });
      if (!res.ok) throw new Error('Cancel failed');
    } catch {
      setSubmitError('Failed to cancel order.');
      setTimeout(() => setSubmitError(''), 3000);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(editingOrder)
      });
      if (!res.ok) throw new Error('Update failed');
      setEditingOrder(null);
    } catch {
      setSubmitError('Failed to update order.');
      setTimeout(() => setSubmitError(''), 3000);
    }
  };

  if (submitted) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <CheckCircle2 size={64} color="var(--secondary)" style={{ margin: '0 auto 1rem' }} />
        <h2>Order Submitted!</h2>
        <p>The production manager has been notified instantly.</p>
      </div>
    );
  }

  return (
    <div className="grid-2">
      <div className="glass-card">
        <h2>Customer Details</h2>
        {submitError && <div className="badge badge-start" style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}>{submitError}</div>}
        <form id="orderForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label required">Select Customer</label>
            <select className="form-control primary" value={selectedCustomerId} onChange={handleCustomerSelect} required>
              <option value="" disabled>-- Choose from Customer Master --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input type="text" className="form-control" value={formData.customerName} readOnly placeholder="Auto-filled from selection" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="tel" inputMode="tel" className="form-control" value={formData.phone} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" inputMode="email" className="form-control" value={formData.email} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Shipping Address</label>
            <textarea className="form-control" rows={3} value={formData.shippingAddress} readOnly></textarea>
          </div>
          
          <button 
            type="button" 
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginBottom: '1rem', padding: 0 }}
          >
            {showAdvanced ? '- Hide Advanced Options' : '+ Show Advanced Options (Tax No.)'}
          </button>
          
          {showAdvanced && (
            <div className="form-group">
              <label className="form-label">Tax / Business Number</label>
              <input type="text" className="form-control" value={formData.taxNumber} readOnly />
            </div>
          )}
        </form>
      </div>

      <div>
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <h2>Configuration</h2>
          <div className="form-group">
            <label className="form-label required">Base Model</label>
            <select className="form-control" required value={formData.baseModel} onChange={e => {
              const modelId = e.target.value;
              const m = baseModels.find(x => x.id.toString() === modelId);
              setFormData({...formData, baseModel: modelId, manualPrice: m ? m.price : ''});
            }} form="orderForm">
              <option value="">-- Select Model --</option>
              {baseModels.map(m => (
                <option key={m.id} value={m.id}>{m.name} (₹{m.price.toLocaleString('en-IN')})</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label required">Committed Delivery Date</label>
            <input type="date" className="form-control" required value={formData.deliveryDate} onChange={e => setFormData({...formData, deliveryDate: e.target.value})} form="orderForm" />
          </div>

          {/* BUG FIX / NEW FEATURE: Notes field added as per requirements */}
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Notes</label>
            <textarea
              className="form-control"
              rows={3}
              form="orderForm"
              placeholder="Any special instructions, customizations, or remarks..."
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            ></textarea>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label required">Faucet Position</label>
            <select className="form-control" required value={formData.faucetPosition} onChange={e => setFormData({...formData, faucetPosition: e.target.value})} form="orderForm">
              <option value="No Faucet">No Faucet</option>
              <option value="Left Side">Left Side</option>
              <option value="Right Side">Right Side</option>
            </select>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label required">Order By</label>
            <select className="form-control" required value={formData.orderBy} onChange={e => setFormData({...formData, orderBy: e.target.value})} form="orderForm">
              <option value="Manish">Manish</option>
              <option value="Paresh">Paresh</option>
              <option value="Devin">Devin</option>
            </select>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem', background: '#F9FAFB', padding: '1rem', borderRadius: '8px' }}>
            <label className="form-label required" style={{ marginBottom: '0.5rem', display: 'block' }}>Total Price (₹)</label>
            <input type="number" step="any" className="form-control" required value={formData.manualPrice} onChange={e => setFormData({...formData, manualPrice: e.target.value})} form="orderForm" style={{ fontSize: '1.25rem', fontWeight: 'bold' }} />
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button type="button" onClick={handleCheckIn} className={`btn ${location ? 'btn-success' : 'btn-secondary'}`}>
            <MapPin size={18} /> {location ? 'Checked In ✓' : 'Check-In (Location)'}
          </button>

          <button type="button" onClick={handleShare} className="btn btn-secondary" disabled={!selectedModel || !formData.customerName}>
            <Share2 size={18} /> Share Order
          </button>

          <button type="submit" form="orderForm" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Submit Order Now
          </button>
        </div>
      </div>

      {/* LIVE ORDERS SECTION */}
      <div className="glass-card" style={{ gridColumn: '1 / -1', marginTop: '2rem' }}>
        <h2>My Submitted Orders</h2>
        <div className="order-list">
          {orders.map(order => {
            const isDelivered = order.status === 'Delivered';
            return (
              <div className="order-card" key={order.id} style={{ opacity: isDelivered ? 0.6 : 1 }}>
                <div className="order-card-header">
                  <span className="order-id">#{order.id}</span>
                  <span className={`badge ${
                    order.status === 'Order Form Received' ? 'badge-received' :
                    order.status === 'Start Production' ? 'badge-start' :
                    order.status === 'Finish Production' ? 'badge-finish' :
                    order.status === 'Order Ready For Dispatch' ? 'badge-ready' :
                    order.status === 'Order Dispatched' ? 'badge-dispatched' : 'badge-delivered'
                  }`}>{order.status}</span>
                </div>
                <div className="order-customer-name">{order.customerName}</div>
                <div style={{ marginBottom: '8px', marginTop: '4px' }}>
                  <span className="order-model">{order.baseModel}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '8px' }}>
                  <strong>Notes:</strong> {order.notes || '—'}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <div className="order-date">
                    Delivery: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN') : 'Not Set'}
                  </div>
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
              <p>No orders placed yet.</p>
            </div>
          )}
        </div>
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
