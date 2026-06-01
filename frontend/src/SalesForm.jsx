import { useState, useEffect, useContext } from 'react';
import { SocketContext } from './App';
import config, { apiFetch, uploadWithProgress } from './config';
import { MapPin, Share2, CheckCircle2, Pencil, Trash2, XCircle, X, ImagePlus, User, ChevronDown, Calendar, Search } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import html2canvas from 'html2canvas';
import OrderPhotos from './OrderPhotos';
import PhotoModal from './PhotoModal';
import { compressImage } from './imageUtils';

const renderDeliveryDate = (dateString) => {
  if (!dateString) return <span style={{ padding: '0.4rem 0.75rem', background: '#f1f5f9', color: '#64748b', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.95rem' }}>Not Set</span>;
  
  const dDate = new Date(dateString);
  const today = new Date();
  today.setHours(0,0,0,0);
  const diffDays = Math.floor((dDate - today) / (1000 * 60 * 60 * 24));
  
  let bgColor = '#f0fdf4';
  let color = '#166534';
  let border = '1px solid #bbf7d0';
  let label = 'Delivery: ';
  
  if (diffDays < 0) {
    bgColor = '#fef2f2';
    color = '#991b1b';
    border = '1px solid #fecaca';
    label = '⚠️ OVERDUE: ';
  } else if (diffDays <= 3) {
    bgColor = '#fff7ed';
    color = '#9a3412';
    border = '1px solid #fed7aa';
    label = '⏳ URGENT: ';
  }
  
  return (
    <div style={{
      background: bgColor, color, border, 
      padding: '0.4rem 0.75rem', borderRadius: '6px', 
      fontWeight: 'bold', fontSize: '0.95rem',
      display: 'inline-block'
    }}>
      {label}{dDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
    </div>
  );
};

export default function SalesForm() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [formData, setFormData] = useState({
    customerName: '', phone: '', email: '', shippingAddress: '', taxNumber: '',
    baseModel: '', variant: '', deliveryDate: '', notes: '', faucetPosition: '', sidePanel: '', orderBy: 'Manish', manualPrice: ''
  });
  const [locationPhotos, setLocationPhotos] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null);

  const getVariantPrice = (modelId, variantName) => {
    if (!modelId || !variantName) return '';
    const m = items.find(x => x.id.toString() === modelId);
    if (!m) return '';
    const priceField = `${variantName.toLowerCase()}Price`;
    return m[priceField] !== undefined && m[priceField] !== null ? m[priceField] : (m.price || 0);
  };

  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const socket = useContext(SocketContext);
  const role = localStorage.getItem('ocean_spas_role');

  const refreshOrders = () => {
    apiFetch(`${config.api.baseURL}/api/orders?page=${page}&limit=20`)
      .then(res => res.json())
      .then(data => {
        const ordersArray = Array.isArray(data) ? data : (data.data || []);
        setOrders(ordersArray);
        if (data.pagination) setTotalPages(data.pagination.pages || 1);
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshOrders();
  }, [page]);

  useEffect(() => {
    apiFetch(`${config.api.baseURL}/api/items`)
      .then(res => res.json())
      .then(data => setItems(Array.isArray(data) ? data : (data.data || [])))
      .catch(() => {});

    apiFetch(`${config.api.baseURL}/api/customers`)
      .then(res => res.json())
      .then(data => setCustomers(Array.isArray(data) ? data : (data.data || [])))
      .catch(() => {});

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

  const handleCustomerSelect = (custId) => {
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

  // 1. Sort customers newest first (by id descending)
  const sortedCustomers = [...customers].sort((a, b) => b.id - a.id);

  // 3. Pin last 5 used customers at top
  const recentCustomerIds = [];
  for (const order of orders) {
    if (recentCustomerIds.length >= 5) break;
    const matchedCustomer = customers.find(c => c.name === order.customerName && (c.phone === order.phone || !order.phone));
    if (matchedCustomer && !recentCustomerIds.includes(matchedCustomer.id)) {
      recentCustomerIds.push(matchedCustomer.id);
    }
  }
  const recentCustomers = recentCustomerIds.map(id => customers.find(c => c.id === id)).filter(Boolean);

  const lowerSearchTerm = customerSearchTerm.toLowerCase();
  const filteredRecentCustomers = recentCustomers.filter(c => 
    c.name.toLowerCase().includes(lowerSearchTerm) || 
    (c.phone && c.phone.includes(lowerSearchTerm))
  );
  const filteredAllCustomers = sortedCustomers.filter(c => 
    c.name.toLowerCase().includes(lowerSearchTerm) || 
    (c.phone && c.phone.includes(lowerSearchTerm))
  );

  const baseModels = items.filter(i => i.category === 'Base Model' || i.category === 'Model' || !i.category);
  const selectedModel = baseModels.find(m => m.id.toString() === formData.baseModel);

  const handleAddLocationPhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt
      });

      const previewUrl = image.webPath;
      const tempId = `temp_${Date.now()}`;
      
      setLocationPhotos(prev => [...prev, {
        id: tempId,
        isCompressing: true,
        previewUrl,
        uploadProgress: 0,
        isUploading: false
      }]);

      let coords = { lat: null, lng: null };
      try {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location !== "granted") {
          await Geolocation.requestPermissions();
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (geoErr) {
        console.warn("GPS not available:", geoErr);
      }

      const response = await fetch(image.webPath);
      let blob = await response.blob();
      
      // Compress the image before checking size limits
      blob = await compressImage(blob);
      
      if (blob.size > 1 * 1024 * 1024) {
        alert('The photo could not be compressed below 1MB. Please choose a smaller photo.');
        setLocationPhotos(prev => prev.filter(p => p.id !== tempId));
        return;
      }
      
      const timestamp = new Date().toISOString();

      setLocationPhotos(prev => prev.map(p => p.id === tempId ? {
        ...p,
        isCompressing: false,
        file: blob,
        format: image.format || "jpg",
        lat: coords.lat,
        lng: coords.lng,
        timestamp
      } : p));

    } catch (err) {
      console.log("Photo cancelled or error:", err);
    }
  };

  const handleRemoveLocationPhoto = (index) => {
    setLocationPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadLocationPhotos = async (orderId) => {
    let hasError = false;
    for (let i = 0; i < locationPhotos.length; i++) {
      const photo = locationPhotos[i];
      setLocationPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, isUploading: true, uploadProgress: 0 } : p));
      
      const formData = new FormData();
      formData.append("photo", photo.file, `location_${Date.now()}.${photo.format}`);
      if (photo.lat !== null) formData.append("lat", photo.lat);
      if (photo.lng !== null) formData.append("lng", photo.lng);
      formData.append("timestamp", photo.timestamp);
      formData.append("photoType", "location_photo");

      const uploadRes = await uploadWithProgress(
        `${config.api.baseURL}/api/orders/${orderId}/attachments`,
        formData,
        (pct) => {
          setLocationPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, uploadProgress: pct } : p));
        }
      );
      
      if (!uploadRes.ok) {
        hasError = true;
        const errData = uploadRes.data || {};
        const errMsg = errData.error || 'The file might be too large or the server rejected it.';
        alert(`Location Photo Upload failed: ${errMsg}`);
      }
    }
    return !hasError;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!formData.baseModel) return alert('Please select a base model');
    if (!selectedCustomerId) return alert('Please select a customer');

    const orderPayload = {
      ...formData,
      customerId: selectedCustomerId,
      itemId: formData.baseModel,
      baseModel: selectedModel.name,
      variant: formData.variant,
      basePrice: selectedModel.price,
      totalPrice: Number(formData.manualPrice),
      deliveryDate: formData.deliveryDate,
      notes: formData.notes,
      faucetPosition: formData.faucetPosition,
      sidePanel: formData.sidePanel
    };

    try {
      const res = await apiFetch(`${config.api.baseURL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      // BUG FIX #5: Check response before marking as submitted
      if (!res.ok) throw new Error('Order submission failed');

      const newOrder = await res.json();
      const orderId = newOrder.data?.id || newOrder.id;

      if (locationPhotos.length > 0 && orderId) {
        await uploadLocationPhotos(orderId);
      }

      refreshOrders();
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        // BUG FIX #6: Reset customer dropdown + all form state properly
        setSelectedCustomerId('');
        setCustomerSearchTerm('');
        setFormData({ customerName: '', phone: '', email: '', shippingAddress: '', taxNumber: '', baseModel: '', variant: '', deliveryDate: '', notes: '', faucetPosition: '', sidePanel: '', orderBy: 'Manish', manualPrice: '' });
        setLocationPhotos([]);
      }, 3000);
    } catch {
      setSubmitError('Failed to submit order. Please try again.');
    }
  };

  const handleShareOrder = async (order) => {
    try {
      const receiptElement = document.getElementById(`receipt-capture-${order.id}`);
      if (!receiptElement) return;
      
      const canvas = await html2canvas(receiptElement, { scale: 2 });
      const base64Data = canvas.toDataURL('image/png').split(',')[1];
      
      const fileName = `order_${order.id}_${Date.now()}.png`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache
      });
      
      await Share.share({
        title: `Ocean Spas Order #${order.id}`,
        text: `Here are the details for Order #${order.id}.`,
        url: savedFile.uri,
        dialogTitle: 'Share Order Receipt'
      });
    } catch (err) {
      console.error('Share error:', err);
      // Fallback
      const text = `Ocean Spas Order #${order.id}\n\nCustomer: ${order.customerName}\nModel: ${order.baseModel} ${order.variant ? `(${order.variant})` : ''}\nTotal Price: ₹${Number(order.totalPrice || 0).toLocaleString('en-IN')}\nNotes: ${order.notes || 'None'}`;
      if (navigator.share) {
        navigator.share({ title: `Ocean Spas Order #${order.id}`, text }).catch(() => {});
      } else {
        window.open(`mailto:?subject=Order ${order.id} Details&body=${encodeURIComponent(text)}`);
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this order?')) return;
    try {
      const res = await apiFetch(`${config.api.baseURL}/api/orders/${id}`, {
        method: 'DELETE'
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
      const res = await apiFetch(`${config.api.baseURL}/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await apiFetch(`${config.api.baseURL}/api/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={22} color="var(--secondary)" /> Customer Details
        </h2>
        {submitError && <div className="badge badge-start" style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}>{submitError}</div>}
        <form id="orderForm" onSubmit={handleSubmit}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label required">Select Customer</label>
            <div className="search-input-wrapper" onClick={() => setIsCustomerDropdownOpen(true)}>
              <Search className="search-icon" size={18} />
              <input
                type="text"
                className="form-control"
                placeholder="-- Search or Choose Customer --"
                value={customerSearchTerm}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value);
                  setIsCustomerDropdownOpen(true);
                  if (selectedCustomerId) {
                     setSelectedCustomerId('');
                     setFormData({ ...formData, customerName: '', phone: '', email: '', shippingAddress: '', taxNumber: '' });
                  }
                }}
                onFocus={() => setIsCustomerDropdownOpen(true)}
                required={!selectedCustomerId}
                style={{ width: '100%', cursor: 'text' }}
              />
            </div>
            
            {isCustomerDropdownOpen && (
              <>
                <div 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} 
                  onClick={() => {
                    setIsCustomerDropdownOpen(false);
                    const selected = customers.find(c => c.id.toString() === selectedCustomerId);
                    if (selected) {
                      setCustomerSearchTerm(`${selected.name} (${selected.phone || 'No phone'})`);
                    } else {
                      setCustomerSearchTerm('');
                    }
                  }}
                />
                <div style={{ 
                  position: 'absolute', top: '100%', left: 0, right: 0, 
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', 
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 100, 
                  maxHeight: '280px', overflowY: 'auto', marginTop: '4px' 
                }}>
                  {filteredRecentCustomers.length > 0 && (
                    <>
                      <div style={{ padding: '8px 12px', background: '#f8fafc', fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', position: 'sticky', top: 0 }}>Recent Customers</div>
                      {filteredRecentCustomers.map(c => (
                        <div 
                          key={`recent-${c.id}`}
                          style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: '#fff' }}
                          onClick={() => {
                            handleCustomerSelect(c.id.toString());
                            setCustomerSearchTerm(`${c.name} (${c.phone || 'No phone'})`);
                            setIsCustomerDropdownOpen(false);
                          }}
                        >
                          <div style={{ fontWeight: 500, color: '#0f172a' }}>{c.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{c.phone || 'No phone'}</div>
                        </div>
                      ))}
                    </>
                  )}
                  
                  <div style={{ padding: '8px 12px', background: '#f8fafc', fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', position: 'sticky', top: filteredRecentCustomers.length > 0 ? 0 : 0 }}>All Customers</div>
                  {filteredAllCustomers.map(c => (
                    <div 
                      key={`all-${c.id}`}
                      style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: '#fff' }}
                      onClick={() => {
                        handleCustomerSelect(c.id.toString());
                        setCustomerSearchTerm(`${c.name} (${c.phone || 'No phone'})`);
                        setIsCustomerDropdownOpen(false);
                      }}
                    >
                      <div style={{ fontWeight: 500, color: '#0f172a' }}>{c.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{c.phone || 'No phone'}</div>
                    </div>
                  ))}
                  {filteredAllCustomers.length === 0 && (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>No customers found</div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input type="text" className="form-control auto-filled" value={formData.customerName} readOnly placeholder="Auto-filled from selection" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input type="tel" inputMode="tel" className="form-control auto-filled" value={formData.phone} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" inputMode="email" className="form-control auto-filled" value={formData.email} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Shipping Address</label>
            <textarea className="form-control auto-filled" rows={3} value={formData.shippingAddress} readOnly></textarea>
          </div>
          
          <button 
            type="button" 
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ background: 'none', border: 'none', color: '#20c997', fontWeight: 600, fontSize: '13px', cursor: 'pointer', marginBottom: '1rem', padding: 0 }}
          >
            {showAdvanced ? '- Hide Advanced Options' : '+ Show Advanced Options (Tax No.)'}
          </button>
          
          {showAdvanced && (
            <div className="form-group">
              <label className="form-label">Tax / Business Number</label>
              <input type="text" className="form-control auto-filled" value={formData.taxNumber} readOnly />
            </div>
          )}
        </form>
      </div>

      <div>
        <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
          <h2>Configuration</h2>
          <div className="form-group">
            <label className="form-label required">Select Model</label>
            <div className="select-wrapper color-1">
              <select className="form-control pill-select" required value={formData.baseModel} onChange={e => {
                const modelId = e.target.value;
                const price = getVariantPrice(modelId, formData.variant);
                setFormData({...formData, baseModel: modelId, manualPrice: price});
              }} form="orderForm">
                <option value="">-- Select Model --</option>
                {baseModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label required">Select Variant</label>
            <div className="select-wrapper color-2">
              <select className="form-control pill-select" required value={formData.variant} onChange={e => {
                const newVariant = e.target.value;
                const price = getVariantPrice(formData.baseModel, newVariant);
                setFormData({...formData, variant: newVariant, manualPrice: price});
              }} form="orderForm">
                <option value="">-- Select Variant --</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
                <option value="Titanium">Titanium</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label required">Faucet Position</label>
            <div className="select-wrapper color-3">
              <select className="form-control pill-select" required value={formData.faucetPosition} onChange={e => setFormData({...formData, faucetPosition: e.target.value})} form="orderForm">
                <option value="" disabled>-- Select Faucet Position --</option>
                <option value="No Faucet">No Faucet</option>
                <option value="Left Side">Left Side</option>
                <option value="Right Side">Right Side</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label required">Side Panel</label>
            <div className="select-wrapper color-4">
              <select className="form-control pill-select" required value={formData.sidePanel} onChange={e => setFormData({...formData, sidePanel: e.target.value})} form="orderForm">
                <option value="" disabled>-- Select Side Panel --</option>
                <option value="Head Side">Head Side</option>
                <option value="Leg Side">Leg Side</option>
                <option value="Head + Leg Side">Head + Leg Side</option>
                <option value="No Side Panel">No Side Panel</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Notes</label>
            <textarea
              className="form-control"
              style={{ minHeight: '80px', borderRadius: '10px', fontStyle: 'italic' }}
              rows={3}
              form="orderForm"
              placeholder="Any special instructions, customizations, or remarks..."
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            ></textarea>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem', padding: '1rem 0' }}>
            <label className="form-label required" style={{ marginBottom: '0.5rem', display: 'block' }}>Total Price</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--primary)' }}>₹</span>
              <input type="number" step="any" className="form-control" required value={formData.manualPrice} onChange={e => setFormData({...formData, manualPrice: e.target.value})} form="orderForm" style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--primary)', border: 'none', borderBottom: '2px solid var(--border)', borderRadius: 0, padding: '4px 0', background: 'transparent' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem', background: '#fff5f0', padding: '1rem', borderRadius: '12px', border: '1.5px solid #ff6b35' }}>
            <label className="form-label required" style={{ color: '#ff6b35', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={18} /> COMMITTED DELIVERY DATE</label>
            <input type="date" className="form-control" required value={formData.deliveryDate} onChange={e => setFormData({...formData, deliveryDate: e.target.value})} form="orderForm" style={{ fontWeight: 'bold', fontSize: '16px', color: '#ff6b35', borderColor: '#ff6b35', background: '#ffffff' }} />
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label required">Order By</label>
            <div className="select-wrapper color-1">
              <select className="form-control pill-select" required value={formData.orderBy} onChange={e => setFormData({...formData, orderBy: e.target.value})} form="orderForm">
                <option value="Manish">Manish</option>
                <option value="Paresh">Paresh</option>
                <option value="Devin">Devin</option>
              </select>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            📸 Installation Location Photos
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-light)", marginBottom: "1rem" }}>
            Take photos of the installation space. GPS is captured automatically.
          </p>

          <button type="button" onClick={handleAddLocationPhoto}
            className="btn-camera-dashed"
            style={{ marginBottom: "1rem" }}>
            <ImagePlus size={24} /> 
            <span>Add Location Photo</span>
          </button>

          {locationPhotos.length > 0 && (
            <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "4px" }}>
              {locationPhotos.map((photo, index) => (
                <div key={index} style={{ position: "relative", flexShrink: 0 }}>
                  <img src={photo.previewUrl} alt="Location"
                    onClick={() => { if(!photo.isUploading && !photo.isCompressing) setViewerIndex(index) }}
                    style={{ width: "80px", height: "80px", objectFit: "cover",
                      borderRadius: "12px", border: "1px solid var(--border)", cursor: "pointer" }} />
                  {(photo.isUploading || photo.isCompressing) && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      background: 'rgba(0,0,0,0.6)', borderRadius: '12px',
                      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 10
                    }}>
                      <span style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                        {photo.isCompressing ? 'Processing' : `${photo.uploadProgress || 0}%`}
                      </span>
                      {!photo.isCompressing && (
                        <div style={{ width: '80%', height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', marginTop: '6px' }}>
                          <div style={{ width: `${photo.uploadProgress || 0}%`, height: '100%', background: '#10b981', borderRadius: '2px', transition: 'width 0.2s' }}></div>
                        </div>
                      )}
                    </div>
                  )}
                  {(!photo.isUploading && !photo.isCompressing) && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                       <span style={{ background: 'rgba(245, 158, 11, 0.9)', color: 'white', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px' }}>Pending Submit</span>
                    </div>
                  )}
                  {(!photo.isUploading && !photo.isCompressing) && (
                    <button type="button" onClick={() => handleRemoveLocationPhoto(index)}
                      style={{ position: "absolute", top: "-6px", right: "-6px",
                        background: "var(--danger)", color: "white", border: "none",
                        borderRadius: "50%", width: "20px", height: "20px",
                        cursor: "pointer", display: "flex", alignItems: "center",
                        justifyContent: "center", padding: 0 }}>
                      <X size={12} />
                    </button>
                  )}
                  {photo.lat && <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(16, 185, 129, 0.9)', color: 'white', borderRadius: '12px', padding: '2px 4px', fontSize: '10px' }}><MapPin size={10} /></div>}
                </div>
              ))}
            </div>
          )}

          {viewerIndex !== null && (
            <PhotoModal 
              photos={locationPhotos} 
              initialIndex={viewerIndex} 
              onClose={() => setViewerIndex(null)} 
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <button type="submit" form="orderForm" className="btn-submit" disabled={!selectedCustomerId || !formData.baseModel}>
            Submit Order Now
          </button>
        </div>
      </div>

      {/* LIVE ORDERS SECTION */}
      <div className="glass-card" style={{ gridColumn: '1 / -1', marginTop: '1rem', background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        <h2 style={{ fontFamily: 'DM Serif Display', fontSize: '20px', color: 'var(--primary)', paddingLeft: '8px', marginBottom: '16px' }}>My Submitted Orders</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {orders.slice(0, 10).map(order => {
            const isDelivered = order.status === 'Delivered';
            return (
              <div className="order-card-premium" key={order.id} style={{ opacity: isDelivered ? 0.7 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text)' }}>{order.customerName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                      Placed: {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <span className={`pill-badge ${
                      order.status === 'Order Form Received' ? 'badge-received' :
                      order.status === 'Start Production' ? 'badge-start' :
                      order.status === 'Finish Production' ? 'badge-finish' :
                      order.status === 'Order Ready For Dispatch' ? 'badge-ready' :
                      order.status === 'Order Dispatched' ? 'badge-dispatched' : 'badge-delivered'
                    }`} style={{ 
                      background: order.status === 'Order Form Received' ? '#eef2ff' : order.status === 'Delivered' ? '#e6fcf5' : '#ebfbee',
                      color: order.status === 'Order Form Received' ? '#3b5bdb' : order.status === 'Delivered' ? '#0ca678' : '#2b8a3e',
                      border: '1px solid currentColor'
                    }}>
                      {order.status}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>#{order.id}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>
                    {order.baseModel} {order.variant && `(${order.variant})`}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)' }}>
                    ₹{order.totalPrice?.toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                  {order.faucetPosition && order.faucetPosition !== 'Not Specified' && (
                    <span className="pill-badge" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>Faucet: {order.faucetPosition}</span>
                  )}
                  {order.sidePanel && order.sidePanel !== 'Not Specified' && (
                    <span className="pill-badge" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>Panel: {order.sidePanel}</span>
                  )}
                  {order.orderBy && (
                    <span className="pill-badge" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>
                        {order.orderBy.charAt(0).toUpperCase()}
                      </div>
                      {order.orderBy}
                    </span>
                  )}
                </div>
                
                {order.notes && (
                  <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginBottom: '12px', padding: '8px', background: '#f8fafc', borderRadius: '8px' }}>
                    "{order.notes}"
                  </div>
                )}
                
                <OrderPhotos orderId={order.id} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <div className="order-date" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {order.status === 'Delivered' ? (
                      <span style={{ color: '#0ca678', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={14} /> Delivered: {new Date(order.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: new Date(order.deliveryDate) < new Date().setHours(0,0,0,0) ? '#e03131' : '#2b8a3e', fontWeight: 'bold', fontSize: '12px' }}>
                        <Calendar size={14} /> {order.deliveryDate ? `Delivery: ${new Date(order.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'No Delivery Date'}
                      </div>
                    )}
                  </div>
                  
                  {role !== 'ADMIN' && (
                    <button onClick={() => handleShareOrder(order)} style={{ background: 'transparent', border: '1.5px solid #e0e5f0', borderRadius: '99px', padding: '6px 12px', color: 'var(--text)', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <Share2 size={14} /> Share
                    </button>
                  )}
                </div>
                
                <div id={`receipt-capture-${order.id}`} style={{ position: 'absolute', top: '-9999px', left: '-9999px', background: '#fff', padding: '30px', width: '500px', fontFamily: 'sans-serif', borderRadius: '12px', zIndex: -1 }}>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h2 style={{ color: '#0f172a', margin: '0 0 8px 0', fontSize: '24px' }}>OCEAN SPAS</h2>
                    <p style={{ color: '#64748b', margin: 0 }}>Order Receipt #{order.id}</p>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', color: '#1e293b' }}>
                    <tbody>
                      <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Customer</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.customerName}</td></tr>
                      <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Phone</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.phone || 'N/A'}</td></tr>
                      <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Model</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.baseModel}</td></tr>
                      <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Variant</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.variant || 'None'}</td></tr>
                      <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Faucet</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.faucetPosition || 'Not Specified'}</td></tr>
                      <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Side Panel</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.sidePanel || 'Not Specified'}</td></tr>
                      <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Delivery</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN') : 'Not Set'}</td></tr>
                      <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Order By</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.orderBy}</td></tr>
                      <tr><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>Notes</td><td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>{order.notes || 'None'}</td></tr>
                      <tr><td style={{ padding: '16px 8px', fontWeight: 'bold', fontSize: '20px' }}>Total Price</td><td style={{ padding: '16px 8px', fontWeight: 'bold', fontSize: '22px', color: '#10b981' }}>₹{Number(order.totalPrice || 0).toLocaleString('en-IN')}</td></tr>
                    </tbody>
                  </table>
                  <div style={{ textAlign: 'center', marginTop: '30px', color: '#64748b', fontSize: '12px' }}>
                    Thank you for choosing Ocean Spas!
                  </div>
                </div>

                {role === 'ADMIN' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
                    <button onClick={() => handleShareOrder(order)} className="btn btn-secondary" style={{ flex: '1 1 calc(50% - 4px)', padding: '0.4rem', fontSize: '12px', minHeight: '32px', borderRadius: '99px' }}>
                      <Share2 size={14} /> Share
                    </button>
                    <button onClick={() => setEditingOrder(order)} className="btn btn-secondary" style={{ flex: '1 1 calc(50% - 4px)', padding: '0.4rem', fontSize: '12px', minHeight: '32px', borderRadius: '99px' }}>
                      <Pencil size={14} /> Edit
                    </button>
                    {order.status !== 'Cancelled' && (
                      <button onClick={() => handleCancel(order.id)} className="btn btn-secondary" style={{ flex: '1 1 calc(50% - 4px)', padding: '0.4rem', fontSize: '12px', minHeight: '32px', color: '#e03131', borderRadius: '99px' }}>
                        <XCircle size={14} /> Cancel
                      </button>
                    )}
                    <button onClick={() => handleDelete(order.id)} className="btn btn-secondary" style={{ flex: '1 1 calc(50% - 4px)', padding: '0.4rem', fontSize: '12px', minHeight: '32px', color: '#e03131', borderColor: '#fee2e2', background: '#fff5f5', borderRadius: '99px' }}>
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

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1rem', gap: '1rem', paddingBottom: '2rem' }}>
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1}
            style={{ background: page === 1 ? '#f8fafc' : '#ffffff', color: page === 1 ? '#cbd5e1' : 'var(--text)', border: '1px solid #e0e5f0', borderRadius: '99px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: page === 1 ? 'default' : 'pointer', transition: 'all 0.2s ease' }}
          >
            Previous
          </button>
          <span style={{ fontWeight: '600', fontSize: '13px', color: '#64748b' }}>Page {page} of {totalPages}</span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page >= totalPages}
            style={{ background: page >= totalPages ? '#f8fafc' : '#ffffff', color: page >= totalPages ? '#cbd5e1' : 'var(--text)', border: '1px solid #e0e5f0', borderRadius: '99px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: page >= totalPages ? 'default' : 'pointer', transition: 'all 0.2s ease' }}
          >
            Next
          </button>
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
                <label className="form-label">Variant</label>
                <select className="form-control" value={editingOrder.variant || ''} onChange={e => setEditingOrder({...editingOrder, variant: e.target.value})}>
                  <option value="">-- None --</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                  <option value="Titanium">Titanium</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Faucet Position</label>
                <select className="form-control" value={editingOrder.faucetPosition || ''} onChange={e => setEditingOrder({...editingOrder, faucetPosition: e.target.value})}>
                  <option value="">-- None --</option>
                  <option value="No Faucet">No Faucet</option>
                  <option value="Left Side">Left Side</option>
                  <option value="Right Side">Right Side</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Side Panel</label>
                <select className="form-control" value={editingOrder.sidePanel || ''} onChange={e => setEditingOrder({...editingOrder, sidePanel: e.target.value})}>
                  <option value="">-- None --</option>
                  <option value="Head Side">Head Side</option>
                  <option value="Leg Side">Leg Side</option>
                  <option value="Head + Leg Side">Head + Leg Side</option>
                  <option value="No Side Panel">No Side Panel</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Order By</label>
                <select className="form-control" value={editingOrder.orderBy || ''} onChange={e => setEditingOrder({...editingOrder, orderBy: e.target.value})}>
                  <option value="">-- None --</option>
                  <option value="Manish">Manish</option>
                  <option value="Paresh">Paresh</option>
                  <option value="Devin">Devin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Total Price (₹)</label>
                <input type="number" step="any" className="form-control" value={editingOrder.totalPrice || ''} onChange={e => setEditingOrder({...editingOrder, totalPrice: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginTop: '1.5rem', background: '#fff7ed', padding: '1rem', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                <label className="form-label required" style={{ color: '#9a3412', fontWeight: 'bold' }}>🚨 COMMITTED DELIVERY DATE</label>
                <input type="date" className="form-control" required value={editingOrder.deliveryDate ? editingOrder.deliveryDate.split('T')[0] : ''} onChange={e => setEditingOrder({...editingOrder, deliveryDate: e.target.value})} style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#9a3412', borderColor: '#fed7aa' }} />
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
