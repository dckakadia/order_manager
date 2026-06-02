/**
 * API Utilities
 * Centralized fetch wrapper with error handling and retry logic
 */

import config, { getCsrfToken } from './config';
import { ERROR_MESSAGES, RETRY_CONFIG, STORAGE_KEYS } from './constants';

/**
 * Fetch wrapper with proper error handling
 * - Checks response status before parsing JSON
 * - Handles network errors gracefully
 * - Includes automatic retry with exponential backoff
 * - Handles 401 (Unauthorized) by clearing auth and redirecting to login
 */
export const apiFetch = async (url, options = {}, retryCount = 0) => {
  try {
    const headers = new Headers(options.headers || {});
    
    // For POST/PUT/DELETE, add CSRF token
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase())) {
      const csrf = getCsrfToken();
      if (csrf) {
        headers.set('x-csrf-token', csrf);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // Include cookies for HttpOnly auth
    });

    // Handle 401 Unauthorized - clear auth and redirect to login
    if (response.status === 401) {
      clearAuthStorage();
      window.location.href = '/login';
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }

    // Check if response is OK (status 200-299)
    if (!response.ok) {
      const errorData = await tryParseJSON(response);
      const errorMsg = errorData?.error || errorData?.message || 
                       `${response.status} ${response.statusText}`;
      
      const error = new Error(errorMsg);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    // Parse and return response
    const data = await tryParseJSON(response);
    return { ok: true, status: response.status, data };
  } catch (error) {
    // Retry logic for network errors (not 4xx/5xx from server)
    if (!error.status && retryCount < RETRY_CONFIG.MAX_RETRIES) {
      const delay = RETRY_CONFIG.INITIAL_DELAY_MS * 
                    Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return apiFetch(url, options, retryCount + 1);
    }

    console.error('API Error:', error);
    return { 
      ok: false, 
      error: error.message || ERROR_MESSAGES.NETWORK_ERROR,
      status: error.status || 0,
      data: error.data
    };
  }
};

/**
 * Safely parse JSON response, fallback to text if invalid
 */
const tryParseJSON = async (response) => {
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    try {
      return await response.json();
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      return { error: ERROR_MESSAGES.INVALID_RESPONSE };
    }
  }
  
  const text = await response.text();
  return { error: text || ERROR_MESSAGES.SERVER_ERROR };
};

/**
 * Clear only auth-related storage, preserve user preferences
 */
export const clearAuthStorage = () => {
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
  localStorage.removeItem(STORAGE_KEYS.USER_ID);
};

/**
 * Set auth tokens in storage
 */
export const setAuthStorage = (token, role, userId) => {
  localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
  localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
};

/**
 * Get auth data from storage
 */
export const getAuthStorage = () => ({
  token: localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
  role: localStorage.getItem(STORAGE_KEYS.USER_ROLE),
  userId: localStorage.getItem(STORAGE_KEYS.USER_ID)
});

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  return !!localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
};

/**
 * Check if user has specific role
 */
export const hasRole = (requiredRoles) => {
  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return rolesArray.includes(role);
};

export default {
  apiFetch,
  clearAuthStorage,
  setAuthStorage,
  getAuthStorage,
  isAuthenticated,
  hasRole
};
