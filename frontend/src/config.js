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
  isProduction: import.meta.env.VITE_ENV === 'production'
};

export default config;
