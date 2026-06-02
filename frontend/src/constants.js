/**
 * Application Constants
 * Centralized storage keys and configuration constants
 */

// Storage Keys - Used for localStorage
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'ocean_spas_auth_token',
  USER_ROLE: 'ocean_spas_user_role',
  USER_ID: 'ocean_spas_user_id',
  SELECTED_CUSTOMER: 'ocean_spas_selected_customer'
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SERVER_ERROR: 'Server error. Please try again later.',
  INVALID_RESPONSE: 'Invalid server response. Please try again.',
  UNAUTHORIZED: 'Unauthorized. Please login again.',
  FORBIDDEN: 'You do not have permission for this action.',
  NOT_FOUND: 'Resource not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UPLOAD_FAILED: 'Upload failed. Please try again.',
  COMPRESSION_FAILED: 'Could not compress photo. Please try a smaller image.'
};

// Max File Sizes
export const FILE_LIMITS = {
  MAX_ORIGINAL_SIZE: 5 * 1024 * 1024,      // 5MB before compression
  MAX_COMPRESSED_SIZE: 1 * 1024 * 1024,    // 1MB after compression
  MAX_UPLOADS_PER_ORDER: 20
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

// Roles
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SALES: 'SALES'
};

// Routes
export const ROUTES = {
  LOGIN: '/login',
  SALES: '/sales',
  STATUS: '/status',
  ADMIN: '/admin',
  CUSTOMERS: '/customers'
};

// API Endpoints (for reference)
export const API_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  ORDERS: '/api/orders',
  CUSTOMERS: '/api/customers',
  ITEMS: '/api/items',
  BACKUP: '/api/backup',
  CSRF_TOKEN: '/api/csrf-token'
};

// Toast/Notification Duration (ms)
export const NOTIFICATION_DURATION = 3000;

// Retry Configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2
};

export default {
  STORAGE_KEYS,
  ERROR_MESSAGES,
  FILE_LIMITS,
  PAGINATION,
  USER_ROLES,
  ROUTES,
  API_ENDPOINTS,
  NOTIFICATION_DURATION,
  RETRY_CONFIG
};
