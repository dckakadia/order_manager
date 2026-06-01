import { useState } from 'react';
import { Camera } from 'lucide-react';
import config from './config';

export default function ItemPhoto({ photoFilename, onClick, size = 40, style = {} }) {
  const [hasError, setHasError] = useState(false);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f1f5f9', // light grey placeholder
    flexShrink: 0,
    cursor: onClick ? 'pointer' : 'default',
    border: '1px solid #e2e8f0',
    ...style
  };

  if (!photoFilename || hasError) {
    return (
      <div style={containerStyle} onClick={onClick}>
        <Camera size={size * 0.5} color="#94a3b8" />
      </div>
    );
  }

  const getImageUrl = (filename) => {
    if (!filename) return '';
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

  return (
    <div style={containerStyle} onClick={onClick}>
      <img
        src={imageUrl}
        alt="Item thumbnail"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
}
