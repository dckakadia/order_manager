/**
 * Frontend Configuration
 * Centralized environment and configuration settings
 */

const config = {
  // API Configuration
  api: {
    baseURL: import.meta.env.VITE_API_BASE || '',
    socketURL: import.meta.env.VITE_SOCKET_URL || '',
    timeout: 30000
  },

  // Storage Keys
  storage: {
    authToken: 'ocean_spas_auth_token',
    userRole: 'ocean_spas_role',
    userId: 'ocean_spas_user_id'
  },

  // Environment
  env: import.meta.env.VITE_ENV || 'development',
  isDevelopment: import.meta.env.VITE_ENV === 'development',
  isProduction: import.meta.env.VITE_ENV === 'production'
};

export default config;
