const express = require('express');
const { authMiddleware } = require('../middleware/authUtils');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Personal to req.user.id — no page-permission gate needed, same as /users/me/permissions.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const { items, unreadCount } = await notificationService.getNotifications(req.user.id, { limit });
    res.json({ success: true, data: items, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
