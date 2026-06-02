import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Upload } from 'lucide-react';
import config, { uploadWithProgress } from './config';
import { apiFetch, clearAuthStorage } from './apiUtils';
import { STORAGE_KEYS, ERROR_MESSAGES } from './constants';
import ItemPhoto from './ItemPhoto';
import PhotoModal from './PhotoModal';
import { compressImage } from './imageUtils';

export default function ItemMaster() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [silverPrice, setSilverPrice] = useState('');
  const [goldPrice, setGoldPrice] = useState('');
  const [platinumPrice, setPlatinumPrice] = useState('');
  const [titaniumPrice, setTitaniumPrice] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFilename, setPhotoFilename] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [modalPhoto, setModalPhoto] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/items`);
      if (!result.ok) {
        if (result.status === 401) {
          clearAuthStorage();
          window.location.href = '/login';
          return;
        }
        console.error('Failed to load items:', result.error);
        setError('Unable to load items. Please try again.');
        setItems([]);
        return;
      }
      const data = result.data;
      setItems(Array.isArray(data) ? data : (data.data || []));
      setError('');
    } catch (err) {
      console.error('Fetch items error:', err);
      setError(ERROR_MESSAGES.NETWORK_ERROR);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert('Only JPG, PNG, or WEBP images are accepted.');
        e.target.value = '';
        return;
      }
      
      const compressedBlob = await compressImage(file);
      
      if (compressedBlob.size > 1 * 1024 * 1024) {
        alert('Photo must be under 1 MB and could not be compressed further.');
        e.target.value = '';
        return;
      }

      setPhotoFile(compressedBlob);
      setPhotoPreview(URL.createObjectURL(compressedBlob));
      setRemovePhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    // BUG FIX #21: Revoke blob URL to prevent memory leaks
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId ? `${config.api.baseURL}/api/items/${editingId}` : `${config.api.baseURL}/api/items`;
    const method = editingId ? 'PUT' : 'POST';
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', 0);
    formData.append('silverPrice', silverPrice ? Number(silverPrice) : 0);
    formData.append('goldPrice', goldPrice ? Number(goldPrice) : 0);
    formData.append('platinumPrice', platinumPrice ? Number(platinumPrice) : 0);
    formData.append('titaniumPrice', titaniumPrice ? Number(titaniumPrice) : 0);
    
    if (photoFile) {
      formData.append('photo', photoFile);
    }
    if (removePhoto) {
      formData.append('remove_photo', 'true');
    }

    // Omit Content-Type header so the browser sets it automatically with the correct boundary for FormData
    try {
      const result = await apiFetch(url, {
        method,
        body: formData
      });
      
      if (!result.ok) {
        const errorMsg = result.data?.error || result.data?.errors?.map(e => e.msg).join(', ') || 'Failed to save item.';
        throw new Error(errorMsg);
      }
      
      // BUG FIX #21: Clean up blob URL on successful submission
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
      
      setName('');
      setSilverPrice('');
      setGoldPrice('');
      setPlatinumPrice('');
      setTitaniumPrice('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setPhotoFilename(null);
      setRemovePhoto(false);
      setEditingId(null);
      fetchItems();
      
      alert(editingId ? 'Option updated successfully!' : 'Option added successfully!');
    } catch (error) {
      console.error('Submit error:', error);
      alert(error.message);
    }
  };

  const handleEditClick = (item) => {
    setName(item.name || '');
    setSilverPrice(item.silverPrice !== null ? item.silverPrice : '');
    setGoldPrice(item.goldPrice !== null ? item.goldPrice : '');
    setPlatinumPrice(item.platinumPrice !== null ? item.platinumPrice : '');
    setTitaniumPrice(item.titaniumPrice !== null ? item.titaniumPrice : '');
    setPhotoFilename(item.photo_filename || null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  const isAdmin = role === 'ADMIN';

  const handleDelete = async (id) => {
    try {
      const checkResult = await apiFetch(`${config.api.baseURL}/api/items/${id}/check-links`);
      if (!checkResult.ok) {
        throw new Error('Failed to verify item links.');
      }
      const checkData = checkResult.data;
      
      if (checkData.count > 0) {
        alert(`Cannot delete. '${checkData.name}' is used in ${checkData.count} Sales Orders.`);
        return;
      }

      if (!window.confirm('Are you sure you want to permanently delete this option?')) return;

      const result = await apiFetch(`${config.api.baseURL}/api/items/${id}`, {
        method: 'DELETE'
      });
      
      if (!result.ok) {
        throw new Error(result.data?.error || 'Delete failed');
      }
      fetchItems();
    } catch (err) {
      console.error('Delete error:', err);
      alert(err.message || 'Failed to delete item.');
    }
  };

  return (
    <div className="grid-2">
      {isAdmin && (
        <div className="glass-card" style={{ maxHeight: '600px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>{editingId ? 'Edit Option' : 'Add New Option'}</h2>
            {editingId && (
              <button onClick={() => { 
                setEditingId(null); setName(''); setSilverPrice(''); setGoldPrice(''); setPlatinumPrice(''); setTitaniumPrice('');
                setPhotoFile(null); setPhotoPreview(null); setPhotoFilename(null); setRemovePhoto(false);
              }} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', minHeight: 'auto' }}>
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
            <label className="form-label">Product Photo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              {(photoPreview || (photoFilename && !removePhoto)) ? (
                <div style={{ position: 'relative' }}>
                  <img 
                    src={photoPreview || `${config.api.baseURL}/api/uploads/items/${photoFilename}`} 
                    alt="Preview" 
                    style={{ width: '160px', height: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} 
                  />
                  <button type="button" onClick={handleRemovePhoto} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', padding: '4px', cursor: 'pointer', color: 'var(--danger)' }} aria-label="Remove photo">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div style={{ width: '160px', height: '160px', borderRadius: '8px', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: 'var(--text-light)' }}>
                  No Photo
                </div>
              )}
              
              <div style={{ flex: 1 }}>
                <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <Upload size={16} />
                  {(photoFilename || photoFile) && !removePhoto ? 'Change Photo' : 'Upload Photo'}
                  <input type="file" accept="image/jpeg, image/png, image/webp" style={{ display: 'none' }} onChange={handleFileChange} />
                </label>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.5rem' }}>Max 1MB. JPG, PNG, WEBP.</div>
              </div>
            </div>
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
              <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
                <ItemPhoto photoFilename={item.photo_filename} onClick={() => setModalPhoto(item.photo_filename)} size={48} />
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
      <PhotoModal photoFilename={modalPhoto} onClose={() => setModalPhoto(null)} />
    </div>
  );
}
