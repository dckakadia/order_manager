const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/authUtils');
const pushService = require('../services/pushService');

const router = express.Router();

router.post('/register', authMiddleware, [
  body('token').trim().notEmpty().withMessage('Device token required'),
  body('platform').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const device = await pushService.registerDeviceToken(req.user.id, req.body.token, req.body.platform || 'android');
    res.json({ success: true, data: { id: device.id, userId: device.userId } });
  } catch (error) {
    console.error('Register device token error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.post('/unregister', authMiddleware, [
  body('token').trim().notEmpty().withMessage('Device token required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    await pushService.unregisterDeviceToken(req.body.token);
    res.json({ success: true });
  } catch (error) {
    console.error('Unregister device token error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
