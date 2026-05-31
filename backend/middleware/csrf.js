/**
 * CSRF Protection Middleware
 * PHASE 2: Prevents Cross-Site Request Forgery attacks
 */

const csrf = require('csurf');
const cookieParser = require('cookie-parser');

// CSRF protection using cookies
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict'
  }
});

// Middleware to generate CSRF token for GET requests
const getCsrfToken = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
};

// Middleware to validate CSRF token for state-changing requests
const validateCsrf = (req, res, next) => {
  // Skip CSRF check for specific routes if needed (e.g., login)
  const skipCsrfRoutes = ['/api/login', '/api/health'];
  if (skipCsrfRoutes.includes(req.path)) {
    return next();
  }
  
  // CSRF validation happens automatically with csrfProtection middleware
  next();
};

module.exports = {
  cookieParser,
  csrfProtection,
  getCsrfToken,
  validateCsrf
};
