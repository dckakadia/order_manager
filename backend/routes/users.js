const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authMiddleware, requireRole } = require('../middleware/authUtils');
const userService = require('../services/userService');

const router = express.Router();

router.get('/', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.get('/me/permissions', authMiddleware, async (req, res) => {
  try {
    const permissions = await userService.getMyPermissions(req.user.id);
    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error('Get my permissions error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.post('/', authMiddleware, requireRole(['ADMIN']), [
  body('username').trim().isLength({ min: 2 }).withMessage('Username must be at least 2 characters long'),
  body('pin').trim().isLength({ min: 4 }).withMessage('PIN must be at least 4 characters long'),
  body('role').isIn(['ADMIN', 'MANAGER', 'SALES']).withMessage('Invalid role'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const user = await userService.createUser(req.body);

    if (req.auditLog) await req.auditLog('CREATE_USER', 'User', user.id, { role: user.role }, 'success');

    const io = req.app.get('io');
    if (io) io.emit('users_updated');

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Create user error:', error);
    if (req.auditLog) await req.auditLog('CREATE_USER', 'User', null, req.body, 'failure', error.message);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }
    res.status(400).json({ success: false, error: error.message || 'An error occurred. Please try again.' });
  }
});

router.put('/:id', authMiddleware, requireRole(['ADMIN']), [
  param('id').isInt(),
  body('username').optional().trim().isLength({ min: 2 }),
  body('pin').optional({ checkFalsy: true }).trim().isLength({ min: 4 }),
  body('role').optional().isIn(['ADMIN', 'MANAGER', 'SALES']),
  body('isActive').optional().isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const user = await userService.updateUser(req.params.id, req.body);

    if (req.auditLog) await req.auditLog('UPDATE_USER', 'User', parseInt(req.params.id), { role: req.body.role }, 'success');

    const io = req.app.get('io');
    if (io) io.emit('users_updated');

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Update user error:', error);
    if (req.auditLog) await req.auditLog('UPDATE_USER', 'User', parseInt(req.params.id), req.body, 'failure', error.message);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }
    res.status(400).json({ success: false, error: error.message || 'An error occurred. Please try again.' });
  }
});

router.delete('/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    await userService.deleteUser(req.params.id, req.user.id);

    if (req.auditLog) await req.auditLog('DELETE_USER', 'User', parseInt(req.params.id), null, 'success');

    const io = req.app.get('io');
    if (io) io.emit('users_updated');

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    if (req.auditLog) await req.auditLog('DELETE_USER', 'User', parseInt(req.params.id), null, 'failure', error.message);
    res.status(400).json({ success: false, error: error.message || 'An error occurred. Please try again.' });
  }
});

module.exports = router;
