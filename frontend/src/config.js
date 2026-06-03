/**
 * Frontend Configuration
 * Centralized environment and configuration settings
 */

export const getCsrfToken = () => {
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]+)'));
  return match ? match[2] : null;
};

export const apiFetch = async (url, options = {}) => {
  const headers = new Headers(options.headers || {});
  
  // For POST/PUT/DELETE, add CSRF token
  if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase())) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set('x-csrf-token', csrf);
    }
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include' // This ensures cookies (session & HttpOnly) are sent
  });
};

export const uploadWithProgress = async (url, payload, onProgress) => {
  try {
    const headers = new Headers();
    const csrf = getCsrfToken();
    if (csrf) headers.set('x-csrf-token', csrf);

    if (typeof payload === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    // Provide an immediate progress update for UI feedback
    if (onProgress) onProgress(50);

    const response = await fetch(url, {
      method: 'POST',
      body: payload,
      headers: headers,
      credentials: 'include'
    });

    if (onProgress) onProgress(100);

    const textData = await response.text();
    let data;
    try {
      data = JSON.parse(textData);
    } catch (e) {
      data = textData;
    }

    if (response.ok) {
      return { ok: true, data };
    } else {
      return { ok: false, data: data || { error: response.statusText } };
    }
  } catch (error) {
    console.error("Upload error:", error);
    return { ok: false, data: { error: error.message || 'Upload failed due to network error' } };
  }
};



const config = {
  // API Configuration
  api: {
    baseURL: import.meta.env.VITE_API_BASE || '',
    socketURL: import.meta.env.VITE_SOCKET_URL || '',
    timeout: 30000
  },

  // Storage Keys
  storage: {
    userRole: 'ocean_spas_role',
    userId: 'ocean_spas_user_id'
  },

  // Environment
  env: import.meta.env.VITE_ENV || 'development',
  isDevelopment: import.meta.env.VITE_ENV === 'development',
  isProduction: import.meta.env.VITE_ENV === 'production',

  // Version
  appVersion: '1.0.27'
};

export default config;
