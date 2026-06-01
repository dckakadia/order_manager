import { X } from 'lucide-react';
import config from './config';

export default function PhotoModal({ photoFilename, onClose }) {
  if (!photoFilename) return null;
  
  const [blobUrl, setBlobUrl] = React.useState('');
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    if (!photoFilename) {
      if (isMounted) setError(true);
      return;
    }

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

    const imageUrl = getImageUrl(photoFilename);
    if (imageUrl.startsWith('blob:')) {
      if (isMounted) setBlobUrl(imageUrl);
      return;
    }

    import('./config').then(({ apiFetch }) => {
      apiFetch(imageUrl)
        .then(res => {
          if (!res.ok) throw new Error('Image fetch failed');
          return res.blob();
        })
        .then(blob => {
          if (isMounted) setBlobUrl(URL.createObjectURL(blob));
        })
        .catch(() => {
          if (isMounted) setError(true);
        });
    });

    return () => { isMounted = false; };
  }, [photoFilename]);

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          color: 'white',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10000
        }}
      >
        <X size={24} />
      </button>
      
      {error ? (
        <div style={{ color: 'white', textAlign: 'center' }}>
          <X size={48} color="red" />
          <p>Failed to load image</p>
        </div>
      ) : blobUrl ? (
        <img 
          src={blobUrl} 
          alt="Full size item" 
          style={{
            maxWidth: '90vw',
            maxHeight: '80vh',
            objectFit: 'contain',
            borderRadius: '8px'
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div style={{ color: 'white' }}>Loading...</div>
      )}
    </div>
  );
}
