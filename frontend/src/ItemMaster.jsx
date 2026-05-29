import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function ItemMaster() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [silverPrice, setSilverPrice] = useState('');
  const [goldPrice, setGoldPrice] = useState('');
  const [platinumPrice, setPlatinumPrice] = useState('');
  const [titaniumPrice, setTitaniumPrice] = useState('');

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
      body: JSON.stringify({ 
        name, 
        silverPrice: silverPrice ? Number(silverPrice) : 0, 
        goldPrice: goldPrice ? Number(goldPrice) : 0, 
        platinumPrice: platinumPrice ? Number(platinumPrice) : 0, 
        titaniumPrice: titaniumPrice ? Number(titaniumPrice) : 0 
      })
    });
    setName('');
    setSilverPrice('');
    setGoldPrice('');
    setPlatinumPrice('');
    setTitaniumPrice('');
    fetchItems();
  };

  const role = localStorage.getItem('ocean_spas_role');
  const isAdmin = role === 'ADMIN';

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
      {isAdmin && (
        <div className="glass-card">
          <h2>Add New Option</h2>
          <form onSubmit={handleAddItem}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input type="text" className="form-control" required value={name} onChange={e => setName(e.target.value)} />
          </div>
          
          <div className="form-group">
            <label className="form-label">Silver Price (₹ / $)</label>
            <input type="number" step="any" className="form-control" required value={silverPrice} onChange={e => setSilverPrice(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Gold Price (₹ / $)</label>
            <input type="number" step="any" className="form-control" required value={goldPrice} onChange={e => setGoldPrice(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Platinum Price (₹ / $)</label>
            <input type="number" step="any" className="form-control" required value={platinumPrice} onChange={e => setPlatinumPrice(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Titanium Price (₹ / $)</label>
            <input type="number" step="any" className="form-control" required value={titaniumPrice} onChange={e => setTitaniumPrice(e.target.value)} />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            <Plus size={18} /> Add Option
          </button>
        </form>
      </div>
      )}

      <div className="glass-card" style={{ maxHeight: '600px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <h2>Current Options</h2>
        <div className="option-list">
          {items.map(item => (
            <div className="option-card" key={item.id}>
              <div className="option-card-main">
                <span className="option-category-badge">{item.category || 'Model'}</span>
                <div className="option-name">{item.name}</div>
                <div className="option-prices" style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0.5rem' }}>
                  {item.silverPrice !== undefined && item.silverPrice !== null ? (
                    <>
                      <div>Silver: ₹{Number(item.silverPrice).toLocaleString('en-IN')}</div>
                      <div>Gold: ₹{Number(item.goldPrice).toLocaleString('en-IN')}</div>
                      <div>Platinum: ₹{Number(item.platinumPrice).toLocaleString('en-IN')}</div>
                      <div>Titanium: ₹{Number(item.titaniumPrice).toLocaleString('en-IN')}</div>
                    </>
                  ) : (
                    <div>Price: ₹{item.price?.toLocaleString('en-IN')}</div>
                  )}
                </div>
              </div>
              {isAdmin && (
                <button onClick={() => handleDelete(item.id)} className="option-delete-btn" aria-label="Delete">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
              No items found. Add some models!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
