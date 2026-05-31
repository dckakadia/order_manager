import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X } from 'lucide-react';
import config from './config';

export default function ItemMaster() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [silverPrice, setSilverPrice] = useState('');
  const [goldPrice, setGoldPrice] = useState('');
  const [platinumPrice, setPlatinumPrice] = useState('');
  const [titaniumPrice, setTitaniumPrice] = useState('');
  const [editingId, setEditingId] = useState(null);

  const fetchItems = async () => {
    try {
      const res = await fetch(`${config.api.baseURL}/api/items`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` } });
      if (res.status === 401) {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : (data.data || []));
    } catch (e) {
      setItems([]);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId ? `${config.api.baseURL}/api/items/${editingId}` : `${config.api.baseURL}/api/items`;
    const method = editingId ? 'PUT' : 'POST';
    
    await fetch(url, {
      method,
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
    setEditingId(null);
    fetchItems();
  };

  const handleEditClick = (item) => {
    setName(item.name || '');
    setSilverPrice(item.silverPrice !== null ? item.silverPrice : '');
    setGoldPrice(item.goldPrice !== null ? item.goldPrice : '');
    setPlatinumPrice(item.platinumPrice !== null ? item.platinumPrice : '');
    setTitaniumPrice(item.titaniumPrice !== null ? item.titaniumPrice : '');
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const role = localStorage.getItem('ocean_spas_role');
  const isAdmin = role === 'ADMIN';

  const handleDelete = async (id) => {
    try {
      const authHeader = { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` };
      const checkRes = await fetch(`${config.api.baseURL}/api/items/${id}/check-links`, { headers: authHeader });
      if (!checkRes.ok) throw new Error('Failed to verify item links.');
      const checkData = await checkRes.json();
      
      if (checkData.count > 0) {
        alert(`Cannot delete. '${checkData.name}' is used in ${checkData.count} Sales Orders.`);
        return;
      }

      if (!window.confirm('Are you sure you want to permanently delete this option?')) return;

      const res = await fetch(`${config.api.baseURL}/api/items/${id}`, {
        method: 'DELETE',
        headers: authHeader
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Delete failed');
      }
      fetchItems();
    } catch (err) {
      alert(err.message || 'Failed to delete item.');
    }
  };

  return (
    <div className="grid-2">
      {isAdmin && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>{editingId ? 'Edit Option' : 'Add New Option'}</h2>
            {editingId && (
              <button onClick={() => { setEditingId(null); setName(''); setSilverPrice(''); setGoldPrice(''); setPlatinumPrice(''); setTitaniumPrice(''); }} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', minHeight: 'auto' }}>
                <X size={16} /> Cancel
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit}>
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
            {editingId ? <><Edit2 size={18} /> Update Option</> : <><Plus size={18} /> Add Option</>}
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
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button onClick={() => handleEditClick(item)} className="option-delete-btn" style={{ color: 'var(--primary)', background: '#eff6ff', borderColor: '#bfdbfe' }} aria-label="Edit">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="option-delete-btn" aria-label="Delete">
                    <Trash2 size={18} />
                  </button>
                </div>
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
