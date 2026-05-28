import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const API_BASE = 'http://116.74.77.22:3000';

export default function CustomerMaster() {
  const [customers, setCustomers] = useState([]);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', shippingAddress: '', taxNumber: ''
  });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const role = localStorage.getItem('ocean_spas_role');
  const authHeader = { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/customers`, { headers: authHeader });
      const data = await res.json();
      setCustomers(data);
    } catch {
      setError('Failed to load customers.');
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error('Failed to add customer');
      setFormData({ name: '', phone: '', email: '', shippingAddress: '', taxNumber: '' });
      setSuccessMsg('Customer added successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchCustomers();
    } catch {
      setError('Failed to add customer. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      // BUG FIX #2: Use full API_BASE URL instead of relative path
      const res = await fetch(`${API_BASE}/api/customers/${id}`, {
        method: 'DELETE',
        headers: authHeader
      });
      if (!res.ok) throw new Error('Delete failed');
      fetchCustomers();
    } catch {
      setError('Failed to delete customer. You may not have permission.');
    }
  };

  // BUG FIX #7: Only show delete button to ADMIN or MANAGER roles
  const canDelete = role === 'ADMIN' || role === 'MANAGER';

  return (
    <div className="grid-2">
      <div className="glass-card">
        <h2>Add New Customer</h2>
        {error && <div className="badge badge-start" style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}>{error}</div>}
        {successMsg && <div className="badge badge-delivered" style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}>{successMsg}</div>}
        <form onSubmit={handleAddCustomer}>
          <div className="form-group">
            <label className="form-label required">Customer Name</label>
            <input type="text" className="form-control" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="tel" inputMode="tel" className="form-control" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" inputMode="email" className="form-control" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Shipping Address</label>
            <textarea className="form-control" rows={3} value={formData.shippingAddress} onChange={e => setFormData({...formData, shippingAddress: e.target.value})}></textarea>
          </div>
          <div className="form-group">
            <label className="form-label">Tax / Business Number</label>
            <input type="text" className="form-control" value={formData.taxNumber} onChange={e => setFormData({...formData, taxNumber: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            <Plus size={18} /> Add Customer
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ maxHeight: '800px', overflowY: 'auto' }}>
        <h2>Customer List</h2>
        <div className="option-list">
          {customers.map(customer => (
            <div className="option-card" key={customer.id}>
              <div className="option-card-main">
                <div className="option-name">{customer.name}</div>
                <div className="option-price">{customer.phone || 'No phone'}</div>
              </div>
              {canDelete && (
                <button onClick={() => handleDelete(customer.id)} className="option-delete-btn" aria-label="Delete">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
          {customers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
              No customers found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
