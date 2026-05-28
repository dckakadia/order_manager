import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function CustomerMaster() {
  const [customers, setCustomers] = useState([]);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', shippingAddress: '', taxNumber: ''
  });

  const fetchCustomers = async () => {
    const res = await fetch('http://116.74.77.22:3000/api/customers', { headers: { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` } });
    const data = await res.json();
    setCustomers(data);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    await fetch('http://116.74.77.22:3000/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}`
      },
      body: JSON.stringify(formData)
    });
    setFormData({ name: '', phone: '', email: '', shippingAddress: '', taxNumber: '' });
    fetchCustomers();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    await fetch(`/api/customers/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}`
      }
    });
    fetchCustomers();
  };

  return (
    <div className="grid-2">
      <div className="glass-card">
        <h2>Add New Customer</h2>
        <form onSubmit={handleAddCustomer}>
          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input type="text" className="form-control" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="text" className="form-control" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>

          <div className="form-group">
            <label className="form-label">Shipping Address</label>
            <textarea className="form-control" rows={3} value={formData.shippingAddress} onChange={e => setFormData({...formData, shippingAddress: e.target.value})}></textarea>
          </div>

          <div className="form-group">
            <label className="form-label">Tax/Business Number</label>
            <input type="text" className="form-control" value={formData.taxNumber} onChange={e => setFormData({...formData, taxNumber: e.target.value})} />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            <Plus size={18} /> Add Customer
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ maxHeight: '800px', overflowY: 'auto' }}>
        <h2>Customer List</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.phone || '-'}</td>
                  <td>
                    <button onClick={() => handleDelete(customer.id)} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center' }}>No customers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
