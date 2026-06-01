import { X } from 'lucide-react';
import config from './config';

export default function PhotoModal({ photoFilename, onClose }) {
  if (!photoFilename) return null;
  
  const imageUrl = photoFilename?.startsWith('blob:') 
    ? photoFilename 
    : `${config.api.baseURL}/api/uploads/items/${photoFilename}`;

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
      
      <img 
        src={imageUrl} 
        alt="Full size item" 
        style={{
          maxWidth: '90vw',
          maxHeight: '80vh',
          objectFit: 'contain',
          borderRadius: '8px'
        }}
        onClick={e => e.stopPropagation()} // prevent closing when clicking the image itself
      />
    </div>
  );
}
