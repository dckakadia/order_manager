import { useState, useEffect } from 'react';
import config, { apiFetch } from './config';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ImagePlus, X, MapPin } from 'lucide-react';

export default function OrderPhotos({ orderId }) {
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

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
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        
        const formData = new FormData();
        formData.append('photo', blob, `photo_${Date.now()}.${image.format || 'jpg'}`);

        const uploadRes = await apiFetch(`${config.api.baseURL}/api/orders/${orderId}/attachments`, {
          method: 'POST',
          body: formData
        });

        if (uploadRes.ok) {
          loadPhotos();
        } else {
            console.error("Upload failed");
        }
      }
    } catch (e) {
      console.error('User cancelled or error', e);
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

  return (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>Photos</h4>
        <button onClick={handleAddPhoto} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '12px', minHeight: 'auto', display: 'flex', gap: '4px' }}>
          <ImagePlus size={14} /> Add Photo
        </button>
      </div>
      
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {photos.map(photo => (
            <div key={photo.id} style={{ position: 'relative', flexShrink: 0 }}>
              <img 
                src={`${config.api.baseURL}${photo.filePath.startsWith('/uploads') ? '/api' + photo.filePath : photo.filePath}`}
                alt="Order Attachment" 
                style={{ 
                  width: '80px', height: '80px', objectFit: 'cover', 
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
              <button 
                onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
              >
                <X size={12} />
              </button>
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
              src={`${config.api.baseURL}${selectedPhoto.filePath.startsWith('/uploads') ? '/api' + selectedPhoto.filePath : selectedPhoto.filePath}`}
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
