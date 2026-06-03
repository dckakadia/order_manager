import { useState, useEffect } from 'react';
import config, { apiFetch, uploadWithProgress } from './config';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { ImagePlus, X, MapPin, RefreshCw } from 'lucide-react';
import PhotoModal from './PhotoModal';
import { compressImage } from './imageUtils';

// Add a new component at the top to handle individual photo rendering
function PhotoThumbnail({ photo, index, canDeletePhotos, handleDelete, onClick }) {
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
    const thumbPath = photo.filePath ? photo.filePath.replace(/([^\/]+)$/, 'thumb_$1') : '';
    const thumbUrl = getImageUrl(thumbPath);
    
    if (imageUrl.startsWith('blob:')) {
      if (isMounted) setBlobUrl(imageUrl);
      return;
    }

    const loadOriginal = () => {
      apiFetch(imageUrl)
        .then(res => {
          if (!res.ok) throw new Error('Original missing');
          return res.blob();
        })
        .then(blob => {
          if (isMounted) setBlobUrl(URL.createObjectURL(blob));
        })
        .catch(() => {
          if (isMounted) setHasError(true);
        });
    };

    apiFetch(thumbUrl)
      .then(res => {
        if (!res.ok) throw new Error('Thumbnail missing');
        return res.blob();
      })
      .then(blob => {
        if (isMounted) setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        // Fallback to original image if thumbnail isn't found
        loadOriginal();
      });

    return () => { isMounted = false; };
  }, [photo.filePath]);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {hasError || (!blobUrl && !photo.isUploading) ? (
        <div style={{
          width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid var(--border)',
          ...(photo.photoType === 'location_photo' && { border: '2px solid #0f766e' })
        }}>
          <ImagePlus size={24} color="#94a3b8" />
        </div>
      ) : (
        <div style={{ position: 'relative', width: '64px', height: '64px' }}>
          <img 
            src={photo.previewUrl || blobUrl}
            alt="Order Attachment" 
            style={{ 
              width: '64px', height: '64px', minWidth: '64px', minHeight: '64px',
              display: 'block', objectFit: 'cover', backgroundColor: '#f1f5f9', color: 'transparent',
              borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)',
              ...(photo.photoType === 'location_photo' && { border: '2px solid #0f766e' })
            }}
            onClick={() => { if(!photo.isUploading) onClick(index) }}
          />
          {photo.isUploading && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.6)', borderRadius: '8px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 10
            }}>
              <span style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                {photo.progress || 0}%
              </span>
              <div style={{ width: '80%', height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', marginTop: '6px' }}>
                <div style={{ width: `${photo.progress || 0}%`, height: '100%', background: '#10b981', borderRadius: '2px', transition: 'width 0.2s' }}></div>
              </div>
            </div>
          )}
        </div>
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
      {canDeletePhotos && (
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
  const canDeletePhotos = canAddPhotos && username !== 'sunil';

  const loadPhotos = async () => {
    try {
      const res = await apiFetch(`${config.api.baseURL}/api/orders/${orderId}/attachments`);
      if (res.ok) {
        const data = res.data;
        setPhotos(data?.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [orderId]);

  const handleAddPhoto = async () => {
    let tempId = null;
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

        tempId = `temp_${Date.now()}`;
        setPhotos(prev => [...prev, {
          id: tempId,
          isUploading: true,
          progress: 5,
          previewUrl: image.webPath,
          photoType: 'location_photo',
          photoLat: coords.lat,
          photoLng: coords.lng
        }]);

        const response = await fetch(image.webPath);
        let blob = await response.blob();
        
        setPhotos(prev => prev.map(p => p.id === tempId ? { ...p, progress: 15 } : p));
        blob = await compressImage(blob);
        
        if (blob.size > 1 * 1024 * 1024) {
          alert('The photo could not be compressed below 1MB. Please choose a smaller photo.');
          setPhotos(prev => prev.filter(p => p.id !== tempId));
          return;
        }
        
        const base64data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        const payload = JSON.stringify({
          imageBase64: base64data,
          fileName: `photo_${Date.now()}.${image.format || 'jpg'}`,
          photoType: 'location_photo',
          lat: coords.lat,
          lng: coords.lng
        });

        const uploadRes = await uploadWithProgress(
          `${config.api.baseURL}/api/orders/${orderId}/attachments`,
          payload,
          (pct) => {
            const realPct = 15 + Math.floor(pct * 0.85); // Compress is 15%, upload is 85%
            setPhotos(prev => prev.map(p => p.id === tempId ? { ...p, progress: realPct } : p));
          }
        );

        if (uploadRes.ok) {
          loadPhotos();
        } else {
            const errData = uploadRes.data || {};
            const errMsg = errData.error || 'The file might be too large or the server rejected it.';
            console.error("Upload failed", errData);
            alert(`Upload failed: ${errMsg}`);
            setPhotos(prev => prev.filter(p => p.id !== tempId));
        }
    } catch (e) {
      console.error('User cancelled or error', e);
      if (tempId) {
        setPhotos(prev => prev.filter(p => p.id !== tempId));
        alert(`An error occurred while adding the photo: ${e.message || 'Unknown error'}`);
      }
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
            <button onClick={handleAddPhoto} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', border: 'none', background: 'var(--primary)', color: '#ffffff', borderRadius: '99px', display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}>
              <ImagePlus size={12} /> Add Photo
            </button>
          )}
        </div>
      </div>
      
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {photos.map((photo, index) => (
            <PhotoThumbnail 
              key={photo.id}
              photo={photo}
              index={index}
              canDeletePhotos={canDeletePhotos}
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
