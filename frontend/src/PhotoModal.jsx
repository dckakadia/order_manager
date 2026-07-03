import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import config from './config';

export default function PhotoModal({ photos, initialIndex = 0, onClose, photoFilename }) {
  // Support legacy single photo or new gallery mode
  const gallery = photos || (photoFilename ? [{ url: photoFilename }] : []);
  
  if (gallery.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [blobUrls, setBlobUrls] = useState({});
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Zoom and Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  // Touch tracking
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);
  const pinchStartDistRef = useRef(null);
  const initialScaleRef = useRef(1);
  const panStartRef = useRef(null);

  const currentPhoto = gallery[currentIndex];
  
  const navigate = (newIndex) => {
    if (newIndex >= 0 && newIndex < gallery.length) {
      setCurrentIndex(newIndex);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const loadPhoto = (index) => {
      if (index < 0 || index >= gallery.length) return;
      if (blobUrls[index]) return;
      
      const photo = gallery[index];
      const urlStr = photo.url || photo.filePath || photo.previewUrl;
      if (!urlStr) return;

      const getImageUrl = (filename) => {
        if (filename.startsWith('http') || filename.startsWith('blob:')) return filename;
        let cleanPath = filename;
        if (!cleanPath.includes('/api/uploads/')) {
            cleanPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
            cleanPath = `/api/uploads/items${cleanPath}`;
        } else if (!cleanPath.startsWith('/')) {
            cleanPath = `/${cleanPath}`;
        }
        const baseUrl = (config.api.baseURL || '').replace(/\/$/, '');
        return `${baseUrl}${cleanPath}`;
      };

      const imageUrl = getImageUrl(urlStr);
      if (imageUrl.startsWith('blob:')) {
        if (isMounted) setBlobUrls(prev => ({ ...prev, [index]: imageUrl }));
        return;
      }
      
      import('./config').then(({ apiFetch }) => {
        apiFetch(imageUrl)
          .then(res => res.ok ? res.blob() : Promise.reject())
          .then(blob => {
            if (isMounted) {
              setBlobUrls(prev => ({ ...prev, [index]: URL.createObjectURL(blob) }));
              if (index === currentIndex) {
                setLoading(false);
                setError(false);
              }
            }
          })
          .catch(() => {
            if (isMounted && index === currentIndex) {
              setError(true);
              setLoading(false);
            }
          });
      });
    };

    // Reset states for current index
    if (!blobUrls[currentIndex]) {
      setLoading(true);
      setError(false);
    } else {
      setLoading(false);
      setError(false);
    }

    // Preload current, previous, and next photos
    loadPhoto(currentIndex);
    loadPhoto(currentIndex - 1);
    loadPhoto(currentIndex + 1);

    return () => { isMounted = false; };
  }, [currentIndex, gallery, blobUrls]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      initialScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      if (scale === 1) {
        touchStartRef.current = e.touches[0].clientX;
        touchEndRef.current = null;
      } else {
        setIsDragging(true);
        panStartRef.current = {
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y
        };
      }
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const newScale = Math.max(1, Math.min(initialScaleRef.current * (dist / pinchStartDistRef.current), 4));
      setScale(newScale);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
    } else if (e.touches.length === 1) {
      if (scale === 1) {
        touchEndRef.current = e.touches[0].clientX;
      } else if (panStartRef.current) {
        setPosition({
          x: e.touches[0].clientX - panStartRef.current.x,
          y: e.touches[0].clientY - panStartRef.current.y
        });
      }
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
    panStartRef.current = null;
    setIsDragging(false);

    if (scale === 1 && touchStartRef.current !== null && touchEndRef.current !== null) {
      const dist = touchStartRef.current - touchEndRef.current;
      const minSwipeDistance = 50;
      if (dist > minSwipeDistance) {
        navigate(currentIndex + 1);
      } else if (dist < -minSwipeDistance) {
        navigate(currentIndex - 1);
      }
    }
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  let lastTap = 0;
  const handleTouchEndDoubleTap = (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
      // Double tap
      if (scale > 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else {
        setScale(2);
      }
    }
    lastTap = currentTime;
    handleTouchEnd(e);
  };
  
  // Desktop double click
  const handleDoubleClick = () => {
      if (scale > 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else {
        setScale(2);
      }
  };

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none'
      }}
      onClick={onClose}
    >
      {/* Top Bar */}
      <div 
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          zIndex: 10001,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
          {gallery.length > 1 ? `${currentIndex + 1} / ${gallery.length}` : ''}
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            color: 'white',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={24} />
        </button>
      </div>

      {/* Navigation Arrows */}
      {gallery.length > 1 && currentIndex > 0 && (
        <button 
          onClick={(e) => { e.stopPropagation(); navigate(currentIndex - 1); }}
          style={{
            position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255, 255, 255, 0.2)', border: 'none', color: 'white',
            borderRadius: '50%', width: '48px', height: '48px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10000
          }}
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {gallery.length > 1 && currentIndex < gallery.length - 1 && (
        <button 
          onClick={(e) => { e.stopPropagation(); navigate(currentIndex + 1); }}
          style={{
            position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255, 255, 255, 0.2)', border: 'none', color: 'white',
            borderRadius: '50%', width: '48px', height: '48px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10000
          }}
        >
          <ChevronRight size={32} />
        </button>
      )}
      
      {/* Image Container */}
      <div 
        style={{
          width: '100%', height: '100%',
          overflow: 'hidden',
          display: 'flex',
          touchAction: 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEndDoubleTap}
        onDoubleClick={handleDoubleClick}
      >
        <div 
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            transform: `translateX(-${currentIndex * 100}%)`,
            transition: 'transform 250ms ease'
          }}
        >
          {gallery.map((photo, index) => (
            <div 
              key={index}
              style={{
                flex: '0 0 100%',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {blobUrls[index] ? (
                <img 
                  src={blobUrls[index]} 
                  alt={`Gallery item ${index + 1}`} 
                  style={{
                    maxWidth: '100vw',
                    maxHeight: '90vh',
                    objectFit: 'contain',
                    transform: currentIndex === index ? `translate(${position.x}px, ${position.y}px) scale(${scale})` : 'none',
                    transition: (currentIndex === index && !isDragging) ? 'transform 250ms ease' : 'none',
                    transformOrigin: 'center center'
                  }}
                  onClick={e => e.stopPropagation()}
                  onDragStart={e => e.preventDefault()}
                />
              ) : index === currentIndex && !error ? (
                <div style={{ color: 'white', fontSize: '18px' }}>Loading...</div>
              ) : index === currentIndex && error ? (
                <div style={{ color: 'white', textAlign: 'center' }}>
                  <X size={48} color="#ef4444" style={{ margin: '0 auto' }} />
                  <p>Failed to load image</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* GPS Overlay */}
      {((currentPhoto.lat !== undefined && currentPhoto.lat !== null) || (currentPhoto.photoLat !== undefined && currentPhoto.photoLat !== null)) && (
        <div 
          style={{
            position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)', borderRadius: '8px', padding: '10px 16px',
            textAlign: 'center', zIndex: 10001, backdropFilter: 'blur(4px)'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ color: '#6ee7b7', fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <MapPin size={16} /> 
            GPS: {(currentPhoto.lat || currentPhoto.photoLat).toFixed(6)}, {(currentPhoto.lng || currentPhoto.photoLng).toFixed(6)}
          </div>
          <a 
            href={`https://maps.google.com/?q=${currentPhoto.lat || currentPhoto.photoLat},${currentPhoto.lng || currentPhoto.photoLng}`}
            target="_blank" rel="noopener noreferrer"
            style={{ color: '#93c5fd', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}
          >
            Open in Google Maps ↗
          </a>
        </div>
      )}
    </div>,
    document.body
  );
}
