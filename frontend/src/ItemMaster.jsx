import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function ItemMaster() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Base Model');

  const fetchItems = async () => {
    const res = await fetch('http://116.74.77.22:3000/api/items', { headers: { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` } });
    const data = await res.json();
    setItems(data);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAddItem = async (e) => {
    e.preventDefault();
    await fetch('http://116.74.77.22:3000/api/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}`
      },
      body: JSON.stringify({ category, name, price })
    });
    setName('');
    setPrice('');
    fetchItems();
  };

  const handleDelete = async (id) => {
    await fetch(`http://116.74.77.22:3000/api/items/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}`
      }
    });
    fetchItems();
  };

  return (
    <div className="grid-2">
      <div className="glass-card">
        <h2>Add New Option</h2>
        <form onSubmit={handleAddItem}>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-control" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="Base Model">Base Model</option>
              <option value="Size">Size</option>
              <option value="Color">Color</option>
              <option value="Jet Config">Jet Configuration</option>
              <option value="Upgrades">Jacuzzi Upgrades</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Name</label>
            <input type="text" className="form-control" required value={name} onChange={e => setName(e.target.value)} />
          </div>
          
          <div className="form-group">
            <label className="form-label">Price Adjustment (₹ / $)</label>
            <input type="number" className="form-control" required value={price} onChange={e => setPrice(e.target.value)} />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            <Plus size={18} /> Add Option
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <h2>Current Options</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Name</th>
                <th>Price</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.category}</td>
                  <td>{item.name}</td>
                  <td>{item.price.toLocaleString()}</td>
                  <td>
                    <button onClick={() => handleDelete(item.id)} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center' }}>No items found. Add some models!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
