/**
 * Utility functions for client-side image manipulation and compression.
 */

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const MAX_DIMENSION = 2000;
const QUALITIES = [0.85, 0.7, 0.5];

/**
 * Compresses an image blob or file to ensure it's under 5MB.
 * If already under 5MB, returns the original blob.
 * @param {Blob|File} fileOrBlob The image to compress.
 * @returns {Promise<Blob>} The compressed image blob.
 */
export async function compressImage(fileOrBlob) {
  // 1. If size is known and explicitly under size limit, we can return original
  // BUT if size is missing/0 (common in Capacitor fetch), we MUST process it!
  if (fileOrBlob.size && fileOrBlob.size <= MAX_SIZE_BYTES) {
    return fileOrBlob;
  }

  // We remove the strict `type.startsWith('image/')` check because Capacitor 
  // sometimes returns blobs with empty types (`""`) for local files.
  // We will just attempt to load it into an Image object. If it fails, it's not an image.

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression.'));
    };

    img.onload = () => {
      URL.revokeObjectURL(url);

      // 2. Calculate new dimensions preserving aspect ratio
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      // 3. Prepare canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // 4. Try exporting with decreasing qualities
      const tryCompress = (qualityIndex) => {
        if (qualityIndex >= QUALITIES.length) {
          // Fallback: if lowest quality still exceeds limit, resolve with the lowest quality result anyway.
          canvas.toBlob((blob) => {
            resolve(blob || fileOrBlob);
          }, 'image/jpeg', QUALITIES[QUALITIES.length - 1]);
          return;
        }

        const quality = QUALITIES[qualityIndex];
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(fileOrBlob);
            return;
          }

          if (blob.size <= MAX_SIZE_BYTES) {
            resolve(blob);
          } else {
            // Try next lower quality
            tryCompress(qualityIndex + 1);
          }
        }, 'image/jpeg', quality);
      };

      tryCompress(0);
    };

    img.src = url;
  });
}
