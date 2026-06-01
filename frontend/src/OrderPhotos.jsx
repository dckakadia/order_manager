import { useState, useEffect } from 'react';
import config, { apiFetch } from './config';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { ImagePlus, X, MapPin, RefreshCw } from 'lucide-react';

export default function OrderPhotos({ orderId }) {
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const role = localStorage.getItem('ocean_spas_role');
  const username = localStorage.getItem('ocean_spas_username');
  const canAddPhotos = role === 'ADMIN' || role === 'MANAGER' || username === 'manish';

  const loadPhotos = async () => {
    try {
      const res = await apiFetch(`${config.api.baseURL}/api/orders/${orderId}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [orderId]);

  const handleAddPhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt
      });

      if (image.webPath) {
        // Capture GPS location automatically
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
        const blob = await response.blob();
        
        if (blob.size > 5 * 1024 * 1024) {
          alert('The photo size is more than 5MB. Kindly upload a photo size below 5MB.');
          return;
        }
        
        const formData = new FormData();
        formData.append('photo', blob, `photo_${Date.now()}.${image.format || 'jpg'}`);
        formData.append('photoType', 'location_photo');
        if (coords.lat !== null) formData.append("lat", coords.lat);
        if (coords.lng !== null) formData.append("lng", coords.lng);

        const uploadRes = await apiFetch(`${config.api.baseURL}/api/orders/${orderId}/attachments`, {
          method: 'POST',
          body: formData
        });

        if (uploadRes.ok) {
          alert('Photo uploaded successfully!');
          loadPhotos();
        } else {
            const errData = await uploadRes.json().catch(() => ({}));
            const errMsg = errData.error || 'The file might be too large or the server rejected it.';
            console.error("Upload failed", errData);
            alert(`Upload failed: ${errMsg}`);
        }
      }
    } catch (e) {
      console.error('User cancelled or error', e);
    }
  };

  const handleUpdateGPS = async () => {
    try {
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          alert('Location access denied');
          return;
        }
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const res = await apiFetch(`${config.api.baseURL}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ locationLat: lat, locationLng: lng })
      });
      if (res.ok) {
        alert('GPS location updated successfully');
      } else {
        alert('Failed to update GPS location');
      }
    } catch (e) {
      console.error(e);
      alert('Error fetching or updating location. Make sure GPS is enabled.');
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm('Delete this photo?')) return;
    try {
      const res = await apiFetch(`${config.api.baseURL}/api/orders/${orderId}/attachments/${attachmentId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setPhotos(photos.filter(p => p.id !== attachmentId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (photos.length === 0 && !canAddPhotos) {
    return null;
  }

  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    let cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (!cleanPath.startsWith('/api')) {
      cleanPath = `/api${cleanPath}`;
    }
    const baseUrl = config.api.baseURL.replace(/\/$/, '');
    return `${baseUrl}${cleanPath}`;
  };

  return (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>Installation Location Photos</h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canAddPhotos && (
            <button onClick={handleUpdateGPS} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '12px', minHeight: 'auto', display: 'flex', gap: '4px' }}>
              <RefreshCw size={14} /> Update GPS
            </button>
          )}
          {canAddPhotos && (
            <button onClick={handleAddPhoto} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '12px', minHeight: 'auto', display: 'flex', gap: '4px' }}>
              <ImagePlus size={14} /> Add Photo
            </button>
          )}
        </div>
      </div>
      
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {photos.map(photo => (
            <div key={photo.id} style={{ position: 'relative', flexShrink: 0 }}>
              <img 
                src={getImageUrl(photo.filePath)}
                alt="Order Attachment" 
                style={{ 
                  width: '80px', height: '80px', minWidth: '80px', minHeight: '80px',
                  display: 'block', objectFit: 'cover', backgroundColor: '#f1f5f9', color: 'transparent',
                  borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)',
                  ...(photo.photoType === 'location_photo' && { border: '2px solid #0f766e' })
                }}
                onClick={() => setSelectedPhoto(photo)}
              />
              {photo.photoType === "location_photo" && photo.photoLat && (
                <div style={{
                  position: "absolute", bottom: "2px", left: "2px",
                  background: "#0f766e", borderRadius: "3px",
                  padding: "1px 4px", display: "flex", alignItems: "center"
                }}>
                  <MapPin size={10} color="white" />
                </div>
              )}
              {canAddPhotos && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                  style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }} onClick={() => setSelectedPhoto(null)}>
          <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
            <button 
              onClick={() => setSelectedPhoto(null)}
              style={{ position: 'absolute', top: '-40px', right: 0, background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={32} />
            </button>
            <img 
              src={getImageUrl(selectedPhoto.filePath)}
              alt="Full size" 
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }}
              onClick={e => e.stopPropagation()}
            />
            {selectedPhoto.photoType === "location_photo" && selectedPhoto.photoLat && (
              <div style={{
                marginTop: "12px", textAlign: "center",
                background: "rgba(0,0,0,0.6)", borderRadius: "8px", padding: "8px 16px"
              }}>
                <div style={{ color: "#6ee7b7", fontSize: "13px", marginBottom: "4px" }}>
                  <MapPin size={14} style={{ display: "inline" }} /> GPS: {selectedPhoto.photoLat.toFixed(6)}, {selectedPhoto.photoLng.toFixed(6)}
                </div>
                <a href={`https://maps.google.com/?q=${selectedPhoto.photoLat},${selectedPhoto.photoLng}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: "#93c5fd", fontSize: "12px" }}>
                  Open in Google Maps ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
