import { useState, useEffect, useContext } from 'react';
import { SocketContext } from './App';
import { MapPin, Share2, CheckCircle2 } from 'lucide-react';

const API_BASE = 'http://116.74.77.22:3000';

export default function SalesForm() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [formData, setFormData] = useState({
    customerName: '', phone: '', email: '', shippingAddress: '', taxNumber: '',
    baseModel: '', deliveryDate: '', notes: ''
  });

  const [location, setLocation] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
  }, []);

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

  const baseModels = items.filter(i => i.category === 'Base Model');
  const selectedModel = baseModels.find(m => m.id.toString() === formData.baseModel);
  const totalPrice = selectedModel ? selectedModel.price : 0;

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
      totalPrice,
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
        setFormData({ customerName: '', phone: '', email: '', shippingAddress: '', taxNumber: '', baseModel: '', deliveryDate: '', notes: '' });
        setLocation(null);
      }, 3000);
    } catch {
      setSubmitError('Failed to submit order. Please try again.');
    }
  };

  const handleShare = async () => {
    const text = `Ocean Spas Order\n\nCustomer: ${formData.customerName}\nModel: ${selectedModel?.name}\nTotal Price: ₹${totalPrice.toLocaleString('en-IN')}\nNotes: ${formData.notes || 'None'}`;
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
          <div className="form-group" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
            <label className="form-label" style={{ color: 'var(--primary)' }}>Select Customer *</label>
            {/* BUG FIX #6: use value (controlled) so it resets properly after submission */}
            <select className="form-control" value={selectedCustomerId} onChange={handleCustomerSelect} required>
              <option value="" disabled>-- Choose from Customer Master --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input type="text" className="form-control" value={formData.customerName} readOnly style={{ backgroundColor: '#F3F4F6' }} placeholder="Auto-filled from selection" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="tel" className="form-control" value={formData.phone} readOnly style={{ backgroundColor: '#F3F4F6' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={formData.email} readOnly style={{ backgroundColor: '#F3F4F6' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Shipping Address</label>
            <textarea className="form-control" rows={3} value={formData.shippingAddress} readOnly style={{ backgroundColor: '#F3F4F6' }}></textarea>
          </div>
          <div className="form-group">
            <label className="form-label">Tax / Business Number</label>
            <input type="text" className="form-control" value={formData.taxNumber} readOnly style={{ backgroundColor: '#F3F4F6' }} />
          </div>
        </form>
      </div>

      <div>
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <h2>Configuration</h2>
          <div className="form-group">
            <label className="form-label">Base Model *</label>
            <select className="form-control" required value={formData.baseModel} onChange={e => setFormData({...formData, baseModel: e.target.value})} form="orderForm">
              <option value="">-- Select Model --</option>
              {baseModels.map(m => (
                <option key={m.id} value={m.id}>{m.name} (₹{m.price.toLocaleString('en-IN')})</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Committed Delivery Date *</label>
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

          <div style={{ padding: '1rem', background: '#F9FAFB', borderRadius: '8px', marginTop: '1.5rem' }}>
            <p className="form-label" style={{ marginBottom: 0 }}>Total Price</p>
            <div className="price-display">₹{totalPrice.toLocaleString('en-IN')}</div>
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
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Model</th>
                <th>Delivery Date</th>
                <th>Notes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 600 }}>#{order.id}</td>
                  <td>{order.customerName}</td>
                  <td>{order.baseModel}</td>
                  <td>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN') : 'Not Set'}</td>
                  <td style={{ maxWidth: '150px', fontSize: '0.85rem', color: 'var(--text-light)' }}>{order.notes || '—'}</td>
                  <td>
                    <span className={`badge ${
                      order.status === 'Order Form Received' ? 'badge-received' :
                      order.status === 'Start Production' ? 'badge-start' :
                      order.status === 'Finish Production' ? 'badge-finish' :
                      order.status === 'Order Ready For Dispatch' ? 'badge-ready' :
                      order.status === 'Order Dispatched' ? 'badge-dispatched' : 'badge-delivered'
                    }`}>{order.status}</span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>No orders placed yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
