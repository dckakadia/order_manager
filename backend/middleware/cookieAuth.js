/**
 * HttpOnly Cookie Authentication
 * PHASE 2: Replaces localStorage for secure token storage
 */

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '24h'; // Token expiration time

// Set secure HttpOnly cookie with JWT token
// `role` is optional; when provided we set a readable role cookie for frontend UI
const setAuthCookie = (res, token, role = null) => {
  res.cookie('auth_token', token, {
    httpOnly: true,           // Cannot be accessed by JavaScript (XSS protection)
    secure: process.env.SECURE_COOKIES === 'true', // Configurable for non-HTTPS dev/prod
    sameSite: 'strict',       // CSRF protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
  });

  // Also set role cookie for frontend convenience (not sensitive data)
  // This cookie is readable by frontend JS so UI can adapt (but contains only role)
  if (role) {
    res.cookie('user_role', role, {
      httpOnly: false,
      secure: process.env.SECURE_COOKIES === 'true',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });
  }
};

// Clear authentication cookies on logout
const clearAuthCookie = (res) => {
  res.clearCookie('auth_token', { path: '/' });
  res.clearCookie('user_role', { path: '/' });
};

// Middleware to verify HttpOnly cookie token
const cookieAuthMiddleware = async (req, res, next) => {
  const token = req.cookies?.auth_token;
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      // Token expired or invalid
      clearAuthCookie(res);
      return res.status(401).json({ success: false, error: 'Unauthorized - Please login again' });
    }

    try {
      // PHASE 2: Check if user is still active
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser || !dbUser.isActive) {
        clearAuthCookie(res);
        return res.status(401).json({ success: false, error: 'User account is disabled' });
      }

      // PHASE 2: Check token expiry
      const tokenExp = user.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = tokenExp - now;

      // If token expires in less than 1 minute, it's effectively expired
      if (timeUntilExpiry < 60000) {
        clearAuthCookie(res);
        return res.status(401).json({ success: false, error: 'Token expired - Please login again' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });
};

module.exports = {
  setAuthCookie,
  clearAuthCookie,
  cookieAuthMiddleware,
  TOKEN_EXPIRY
};
