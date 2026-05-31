import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X } from 'lucide-react';
import config, { apiFetch } from './config';

export default function CustomerMaster() {
  const [customers, setCustomers] = useState([]);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', shippingAddress: '', taxNumber: ''
  });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editingId, setEditingId] = useState(null);

  const role = localStorage.getItem('ocean_spas_role');

  const fetchCustomers = async () => {
    try {
      const res = await apiFetch(`${config.api.baseURL}/api/customers`);
      if (res.status === 401) {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : (data.data || []));
    } catch {
      setError('Failed to load customers.');
      setCustomers([]);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const url = editingId ? `${config.api.baseURL}/api/customers/${editingId}` : `${config.api.baseURL}/api/customers`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error(editingId ? 'Failed to update customer' : 'Failed to add customer');
      setFormData({ name: '', phone: '', email: '', shippingAddress: '', taxNumber: '' });
      setSuccessMsg(editingId ? 'Customer updated successfully!' : 'Customer added successfully!');
      setEditingId(null);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchCustomers();
    } catch {
      setError(editingId ? 'Failed to update customer. Please try again.' : 'Failed to add customer. Please try again.');
    }
  };

  const handleEditClick = (customer) => {
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      shippingAddress: customer.shippingAddress || '',
      taxNumber: customer.taxNumber || ''
    });
    setEditingId(customer.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    try {
      const checkRes = await apiFetch(`${config.api.baseURL}/api/customers/${id}/check-links`);
      if (!checkRes.ok) throw new Error('Failed to verify customer links.');
      const checkData = await checkRes.json();
      
      if (checkData.count > 0) {
        alert(`Cannot delete. '${checkData.name}' is used in ${checkData.count} Sales Orders.`);
        return;
      }

      if (!window.confirm('Are you sure you want to permanently delete this customer?')) return;

      const res = await apiFetch(`${config.api.baseURL}/api/customers/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Delete failed');
      }
      fetchCustomers();
    } catch (err) {
      setError(err.message || 'Failed to delete customer. You may not have permission.');
    }
  };

  // BUG FIX #7: Only show delete and add forms to ADMIN
  const canDelete = role === 'ADMIN';
  const isAdmin = role === 'ADMIN';
  const canAdd = ['ADMIN', 'SALES'].includes(role);

  return (
    <div className="grid-2">
      {canAdd && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>{editingId ? 'Edit Customer' : 'Add New Customer'}</h2>
            {editingId && (
              <button onClick={() => { setEditingId(null); setFormData({ name: '', phone: '', email: '', shippingAddress: '', taxNumber: '' }); }} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', minHeight: 'auto' }}>
                <X size={16} /> Cancel
              </button>
            )}
          </div>
          {error && <div className="badge badge-start" style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}>{error}</div>}
          {successMsg && <div className="badge badge-delivered" style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}>{successMsg}</div>}
          <form onSubmit={handleSubmit}>
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
            {editingId ? <><Edit2 size={18} /> Update Customer</> : <><Plus size={18} /> Add Customer</>}
          </button>
        </form>
      </div>
      )}

      <div className="glass-card" style={{ maxHeight: '800px', overflowY: 'auto' }}>
        <h2>Customer List</h2>
        <div className="option-list">
          {customers.map(customer => (
            <div className="option-card" key={customer.id}>
              <div className="option-card-main">
                <div className="option-name">{customer.name}</div>
                <div className="option-price">{customer.phone || 'No phone'}</div>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button onClick={() => handleEditClick(customer)} className="option-delete-btn" style={{ color: 'var(--primary)', background: '#eff6ff', borderColor: '#bfdbfe' }} aria-label="Edit">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(customer.id)} className="option-delete-btn" aria-label="Delete">
                    <Trash2 size={18} />
                  </button>
                </div>
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
