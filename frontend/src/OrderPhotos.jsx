import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import config, { uploadWithProgress } from './config';
// ✅ FIX #1: Import apiFetch from apiUtils (returns {ok, data}), NOT from config (returns raw Response)
import { apiFetch } from './apiUtils';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { ImagePlus, X, MapPin } from 'lucide-react';
import PhotoModal from './PhotoModal';
import { compressImage } from './imageUtils';
import { STORAGE_KEYS } from './constants';

const isNativePlatform = Capacitor.isNativePlatform();

// ✅ FIX #2: Auth token helper — reads JWT from correct localStorage key and builds Authorization header.
// On native (Capacitor/Android), cookies are unreliable. We must use Bearer token in header.
const getAuthHeaders = () => {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
};

// ✅ FIX #3: uploadWithProgress needs auth header on native platform.
// Wraps the existing uploadWithProgress to inject Authorization header.
const uploadWithAuth = async (url, payload, onProgress) => {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  // uploadWithProgress in config.js uses fetch directly — we need to pass auth header
  // Since uploadWithProgress uses Bearer token bypass on server (skips CSRF for Bearer),
  // and auth middleware reads Authorization header as fallback, this works correctly.
  try {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Get CSRF token from cookie (works on web; on native it may be empty — but Bearer skips CSRF check)
    const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]+)'));
    const csrf = match ? match[2] : null;
    if (csrf) headers['x-csrf-token'] = csrf;
    if (typeof payload === 'string') headers['Content-Type'] = 'application/json';

    if (onProgress) onProgress(10);

    const response = await fetch(url, {
      method: 'POST',
      body: payload,
      headers,
      credentials: 'include'
    });

    if (onProgress) onProgress(100);

    const textData = await response.text();
    let data;
    try { data = JSON.parse(textData); } catch (e) { data = { error: textData }; }

    return response.ok ? { ok: true, data } : { ok: false, data };
  } catch (error) {
    console.error('Upload error:', error);
    return { ok: false, data: { error: error.message || 'Network error during upload' } };
  }
};

// PhotoThumbnail sub-component — renders a single photo tile with upload progress overlay
function PhotoThumbnail({ photo, index, canDeletePhotos, handleDelete, onClick }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const getImageUrl = (path) => {
      if (!path) return '';
      if (path.startsWith('http')) return path;
      let cleanPath = path.startsWith('/') ? path : `/${path}`;
      if (!cleanPath.startsWith('/api')) cleanPath = `/api${cleanPath}`;
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

    // ✅ FIX #4: Use apiFetch (from apiUtils) which correctly handles auth and returns {ok, data}
    const loadOriginal = () => {
      apiFetch(imageUrl)
        .then(res => {
          if (!res.ok) throw new Error('Original missing');
          // apiFetch returns parsed JSON — for image blobs we need the raw response
          // So fall back to direct fetch with auth header for binary content
          return fetch(imageUrl, { headers: getAuthHeaders(), credentials: 'include' });
        })
        .then(r => r.blob())
        .then(blob => { if (isMounted) setBlobUrl(URL.createObjectURL(blob)); })
        .catch(() => { if (isMounted) setHasError(true); });
    };

    // Try thumbnail first, fallback to original
    fetch(thumbUrl, { headers: getAuthHeaders(), credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('No thumb'); return r.blob(); })
      .then(blob => { if (isMounted) setBlobUrl(URL.createObjectURL(blob)); })
      .catch(() => {
        fetch(imageUrl, { headers: getAuthHeaders(), credentials: 'include' })
          .then(r => { if (!r.ok) throw new Error('No image'); return r.blob(); })
          .then(blob => { if (isMounted) setBlobUrl(URL.createObjectURL(blob)); })
          .catch(() => { if (isMounted) setHasError(true); });
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
            onClick={() => { if (!photo.isUploading) onClick(index); }}
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

  // ✅ FIX #5: Read role from the correct STORAGE_KEYS constant (not a hardcoded string)
  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  const canAddPhotos = role === 'ADMIN' || role === 'MANAGER' || role === 'SALES';
  const canDeletePhotos = role === 'ADMIN';

  const loadPhotos = async () => {
    try {
      // ✅ FIX #6: Use apiFetch from apiUtils — it sends auth cookie AND Bearer token, handles 401
      const res = await apiFetch(`${config.api.baseURL}/api/orders/${orderId}/attachments`);
      if (res.ok) {
        setPhotos(res.data?.data || []);
      } else {
        console.error('Failed to load photos:', res.error || res.data);
      }
    } catch (e) {
      console.error('loadPhotos exception:', e);
    }
  };

  useEffect(() => {
    if (orderId) loadPhotos();
  }, [orderId]);

  const fileInputRef = useRef(null);

  // ─── WEB / DESKTOP PATH ────────────────────────────────────────────────────
  const handleFallbackFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    let tempId = null;
    try {
      tempId = Date.now();
      const previewUrl = URL.createObjectURL(file);
      setPhotos(prev => [...prev, { id: tempId, previewUrl, isUploading: true, progress: 0 }]);

      // Get GPS coordinates (best-effort)
      let coords = { lat: null, lng: null };
      try {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location === 'granted' || permissions.location === 'prompt') {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
          coords.lat = pos.coords.latitude;
          coords.lng = pos.coords.longitude;
        }
      } catch (geoErr) {
        console.warn('GPS unavailable:', geoErr);
      }

      // Convert file to Base64
      const base64data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const setProgress = (pct) => {
        setPhotos(prev => prev.map(p => p.id === tempId ? { ...p, progress: pct } : p));
      };

      const payload = JSON.stringify({
        imageBase64: base64data,
        fileName: `photo_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`,
        photoType: 'location_photo',
        lat: coords.lat,
        lng: coords.lng
      });

      // ✅ FIX #7: Use uploadWithAuth which correctly sends Authorization header
      const res = await uploadWithAuth(
        `${config.api.baseURL}/api/orders/${orderId}/attachments`,
        payload,
        setProgress
      );

      if (res.ok) {
        setPhotos(prev => prev.filter(p => p.id !== tempId));
        await loadPhotos();
      } else {
        // ✅ FIX #8: Show the actual server error, not a generic message
        const errMsg = res.data?.error || res.data?.message || 'Upload failed. Please try again.';
        console.error('Upload failed:', res.data);
        alert(`Upload failed: ${errMsg}`);
        setPhotos(prev => prev.filter(p => p.id !== tempId));
      }
    } catch (error) {
      console.error('handleFallbackFileSelect error:', error);
      if (tempId) setPhotos(prev => prev.filter(p => p.id !== tempId));
      alert(`Upload error: ${error.message || 'Unknown error'}`);
    }
    e.target.value = null;
  };

  // ─── NATIVE / ANDROID PATH ─────────────────────────────────────────────────
  const handleNativeAddPhoto = async () => {
    let tempId = null;
    try {
      // Request camera access
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt
      });

      if (!image.webPath) {
        alert('No image captured. Please try again.');
        return;
      }

      // Get GPS (best-effort)
      let coords = { lat: null, lng: null };
      try {
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location !== 'granted') await Geolocation.requestPermissions();
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (geoErr) {
        console.warn('GPS not available:', geoErr);
      }

      // Show preview immediately
      tempId = `temp_${Date.now()}`;
      setPhotos(prev => [...prev, {
        id: tempId, isUploading: true, progress: 5,
        previewUrl: image.webPath, photoType: 'location_photo',
        photoLat: coords.lat, photoLng: coords.lng
      }]);

      // Fetch blob from the webPath URI
      const blobResponse = await fetch(image.webPath);
      let blob = await blobResponse.blob();
      setPhotos(prev => prev.map(p => p.id === tempId ? { ...p, progress: 15 } : p));

      // Compress
      blob = await compressImage(blob);
      if (blob.size > 25 * 1024 * 1024) {
        alert('Photo is too large (max 25MB after compression). Please choose a smaller photo.');
        setPhotos(prev => prev.filter(p => p.id !== tempId));
        return;
      }

      // Convert to Base64
      const base64data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      setPhotos(prev => prev.map(p => p.id === tempId ? { ...p, progress: 25 } : p));

      const payload = JSON.stringify({
        imageBase64: base64data,
        fileName: `photo_${Date.now()}.${image.format || 'jpg'}`,
        photoType: 'location_photo',
        lat: coords.lat,
        lng: coords.lng
      });

      // ✅ FIX #9: uploadWithAuth sends Authorization: Bearer header.
      // The server's CSRF bypass allows Bearer-authenticated requests to skip CSRF check.
      // This is the permanent fix for native platforms where cookies don't work reliably.
      const uploadRes = await uploadWithAuth(
        `${config.api.baseURL}/api/orders/${orderId}/attachments`,
        payload,
        (pct) => {
          const realPct = 25 + Math.floor(pct * 0.75);
          setPhotos(prev => prev.map(p => p.id === tempId ? { ...p, progress: realPct } : p));
        }
      );

      if (uploadRes.ok) {
        setPhotos(prev => prev.filter(p => p.id !== tempId));
        await loadPhotos();
      } else {
        // ✅ FIX #10: Surface the real error to the user
        const errMsg = uploadRes.data?.error || uploadRes.data?.message || 'Server rejected the upload.';
        console.error('Native upload failed:', uploadRes.data);
        alert(`Upload failed: ${errMsg}`);
        setPhotos(prev => prev.filter(p => p.id !== tempId));
      }
    } catch (e) {
      console.error('handleNativeAddPhoto error:', e);
      if (tempId) setPhotos(prev => prev.filter(p => p.id !== tempId));
      // Don't alert if user cancelled the camera picker
      if (e?.message && !e.message.includes('cancelled') && !e.message.includes('cancel')) {
        alert(`Camera error: ${e.message}`);
      }
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
      } else {
        alert('Failed to delete photo. Please try again.');
      }
    } catch (e) {
      console.error('handleDelete error:', e);
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
            isNativePlatform ? (
              <button
                onClick={handleNativeAddPhoto}
                style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', border: 'none', background: 'var(--primary)', color: '#ffffff', borderRadius: '99px', display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}
              >
                <ImagePlus size={12} /> Add Photo
              </button>
            ) : (
              <>
                <label
                  htmlFor={`add-photo-input-${orderId}`}
                  style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', border: 'none', background: 'var(--primary)', color: '#ffffff', borderRadius: '99px', display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}
                >
                  <ImagePlus size={12} /> Add Photo
                </label>
                <input
                  id={`add-photo-input-${orderId}`}
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  onChange={handleFallbackFileSelect}
                />
              </>
            )
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
