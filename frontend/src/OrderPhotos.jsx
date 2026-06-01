import { useState, useEffect } from 'react';
import config, { apiFetch } from './config';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { ImagePlus, X, MapPin, RefreshCw } from 'lucide-react';
import PhotoModal from './PhotoModal';
import { compressImage } from './imageUtils';

// Add a new component at the top to handle individual photo rendering
function PhotoThumbnail({ photo, index, canAddPhotos, handleDelete, onClick }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
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

    const imageUrl = getImageUrl(photo.filePath);
    
    if (imageUrl.startsWith('blob:')) {
      if (isMounted) setBlobUrl(imageUrl);
      return;
    }

    apiFetch(imageUrl)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.blob();
      })
      .then(blob => {
        if (isMounted) setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (isMounted) setHasError(true);
      });

    return () => { isMounted = false; };
  }, [photo.filePath]);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {hasError || !blobUrl ? (
        <div style={{
          width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid var(--border)',
          ...(photo.photoType === 'location_photo' && { border: '2px solid #0f766e' })
        }}>
          <ImagePlus size={24} color="#94a3b8" />
        </div>
      ) : (
        <img 
          src={blobUrl}
          alt="Order Attachment" 
          style={{ 
            width: '64px', height: '64px', minWidth: '64px', minHeight: '64px',
            display: 'block', objectFit: 'cover', backgroundColor: '#f1f5f9', color: 'transparent',
            borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)',
            ...(photo.photoType === 'location_photo' && { border: '2px solid #0f766e' })
          }}
          onClick={() => onClick(index)}
        />
      )}
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
  );
}

export default function OrderPhotos({ orderId }) {
  const [photos, setPhotos] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null);

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
        let blob = await response.blob();
        
        blob = await compressImage(blob);
        
        if (blob.size > 1 * 1024 * 1024) {
          alert('The photo could not be compressed below 1MB. Please choose a smaller photo.');
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


  return (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>Installation Location Photos</h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canAddPhotos && (
            <button onClick={handleUpdateGPS} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', borderRadius: '99px', display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}>
              <RefreshCw size={12} /> Update GPS
            </button>
          )}
          {canAddPhotos && (
            <button onClick={handleAddPhoto} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', border: 'none', background: 'var(--primary)', color: '#ffffff', borderRadius: '99px', display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}>
              <ImagePlus size={12} /> Add Photo
            </button>
          )}
        </div>
      </div>
      
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {photos.map(photo => (
            <PhotoThumbnail 
              key={photo.id}
              photo={photo}
              index={index}
              canAddPhotos={canAddPhotos}
              handleDelete={handleDelete}
              onClick={setViewerIndex}
            />
          ))}
        </div>
      )}

      {viewerIndex !== null && (
        <PhotoModal 
          photos={photos} 
          initialIndex={viewerIndex} 
          onClose={() => setViewerIndex(null)} 
        />
      )}
    </div>
  );
}
