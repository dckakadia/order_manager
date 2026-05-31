/**
 * CSRF Protection Middleware
 * Custom Double Submit Cookie Pattern
 */

const crypto = require('crypto');

const csrfProtection = (req, res, next) => {
  // Check CSRF for state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const cookieToken = req.cookies?.csrf_token;
    const headerToken = req.headers['x-csrf-token'];
    
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({ success: false, error: 'Invalid CSRF token' });
    }
  } else if (req.path === '/api/csrf-token' && req.method === 'GET') {
    // Generate token and set cookie
    const token = crypto.randomUUID();
    res.cookie('csrf_token', token, {
      httpOnly: false, // Must be readable by frontend JS
      secure: process.env.SECURE_COOKIES === 'true',
      sameSite: 'strict'
    });
    // Add token to request so it can be returned in JSON
    req.csrfToken = () => token;
  }
  
  next();
};

const getCsrfToken = (req, res, next) => {
  next();
};

const validateCsrf = (req, res, next) => {
  next();
};

module.exports = {
  csrfProtection,
  getCsrfToken,
  validateCsrf
};
