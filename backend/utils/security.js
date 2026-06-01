/**
 * Security Utilities for Backend
 */

const path = require('path');

/**
 * Validate file path is within allowed directory (prevents path traversal)
 */
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

exports.validateFilePath = (filePath) => {
  const normalizedPath = path.normalize(filePath);
  const absolutePath = path.resolve(UPLOADS_DIR, normalizedPath);
  
  // Ensure resolved path is still within UPLOADS_DIR
  if (!absolutePath.startsWith(UPLOADS_DIR)) {
    throw new Error('Invalid file path - path traversal attempt');
  }
  
  // Ensure no .. in path
  if (normalizedPath.includes('..')) {
    throw new Error('Invalid file path - contains ..');
  }
  
  return absolutePath;
};

/**
 * Validate backup data structure
 */
exports.validateBackupData = (data) => {
  const errors = [];
  
  if (!data.users || !Array.isArray(data.users)) {
    errors.push('Missing or invalid users array');
  }
  
  if (!data.customers || !Array.isArray(data.customers)) {
    errors.push('Missing or invalid customers array');
  }
  
  if (!data.items || !Array.isArray(data.items)) {
    errors.push('Missing or invalid items array');
  }
  
  if (!data.orders || !Array.isArray(data.orders)) {
    errors.push('Missing or invalid orders array');
  }
  
  // Validate users
  data.users?.forEach((u, i) => {
    if (!u.id || typeof u.id !== 'number') {
      errors.push(`User[${i}] missing or invalid id`);
    }
    if (!u.username) {
      errors.push(`User[${i}] missing username`);
    }
  });
  
  // Validate customers
  data.customers?.forEach((c, i) => {
    if (!c.id || typeof c.id !== 'number') {
      errors.push(`Customer[${i}] missing or invalid id`);
    }
    if (!c.name) {
      errors.push(`Customer[${i}] missing name`);
    }
  });
  
  // Validate items
  data.items?.forEach((item, i) => {
    if (!item.id || typeof item.id !== 'number') {
      errors.push(`Item[${i}] missing or invalid id`);
    }
    if (!item.name) {
      errors.push(`Item[${i}] missing name`);
    }
  });
  
  // Validate orders reference valid customers and items
  data.orders?.forEach((o, i) => {
    if (o.customerId) {
      const validCustomer = data.customers.find(c => c.id === o.customerId);
      if (!validCustomer) {
        errors.push(`Order[${i}] references invalid customerId ${o.customerId}`);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Sanitize error messages (don't leak system details)
 */
exports.sanitizeError = (error) => {
  if (error.code === 'ENOENT') {
    return 'File not found';
  }
  if (error.code === 'EACCES') {
    return 'Permission denied';
  }
  if (error.message?.includes('UNIQUE constraint failed')) {
    return 'Record already exists';
  }
  // Return generic message for unknown errors
  return 'An error occurred. Please try again.';
};

/**
 * Retry async function with exponential backoff
 */
exports.retryAsync = async (fn, maxRetries = 3, delayMs = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = delayMs * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

module.exports = exports;
