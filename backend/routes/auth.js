const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const rateLimit = require('express-rate-limit');
const { setAuthCookie, clearAuthCookie, TOKEN_EXPIRY } = require('../middleware/cookieAuth');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/login', loginLimiter, [
  body('username').trim().isLength({ min: 1, max: 100 }).withMessage('Invalid username'),
  body('pin').trim().isLength({ min: 1 }).withMessage('PIN required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, pin } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const pinMatch = await bcrypt.compare(pin, user.pin);
    if (!pinMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    setAuthCookie(res, token, user.role);

    if (req.auditLog) {
      await req.auditLog('LOGIN', 'User', user.id, null, 'success');
    }

    res.json({ 
      success: true, 
      token, 
      role: user.role, 
      expiresIn: TOKEN_EXPIRY,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    clearAuthCookie(res);
    if (req.user && req.auditLog) {
      await req.auditLog('LOGOUT', 'User', req.user.id, null, 'success');
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'An error occurred' });
  }
});

module.exports = router;
