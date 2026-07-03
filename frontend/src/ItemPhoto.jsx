import { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';
import config, { apiFetch } from './config';

export default function ItemPhoto({ photoFilename, onClick, size = 40, style = {} }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!photoFilename) {
      if (isMounted) setHasError(true);
      return;
    }

    const getImageUrl = (filename) => {
      if (filename.startsWith('http')) return filename;
      let cleanPath = filename;
      if (!cleanPath.includes('/api/uploads/items/')) {
          cleanPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
          cleanPath = `/api/uploads/items${cleanPath}`;
      } else if (!cleanPath.startsWith('/')) {
          cleanPath = `/${cleanPath}`;
      }
      const baseUrl = (config.api.baseURL || '').replace(/\/$/, '');
      return `${baseUrl}${cleanPath}`;
    };

    const imageUrl = getImageUrl(photoFilename);
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
  }, [photoFilename]);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f1f5f9',
    flexShrink: 0,
    cursor: onClick ? 'pointer' : 'default',
    border: '1px solid #e2e8f0',
    ...style
  };

  if (!photoFilename || hasError || !blobUrl) {
    return (
      <div style={containerStyle} onClick={onClick}>
        <Camera size={size * 0.5} color="#94a3b8" />
      </div>
    );
  }

  return (
    <div style={containerStyle} onClick={onClick}>
      <img
        src={blobUrl}
        alt="Item thumbnail"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
}
