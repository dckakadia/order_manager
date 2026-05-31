const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { clearAuthCookie } = require('./cookieAuth');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
  let token = req.cookies?.auth_token;

  if (!token) {
    token = req.headers['authorization']?.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      clearAuthCookie(res);
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser || !dbUser.isActive) {
        clearAuthCookie(res);
        return res.status(401).json({ success: false, error: 'User account is disabled' });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
};

module.exports = {
  authMiddleware,
  requireRole
};
