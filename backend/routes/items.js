const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { authMiddleware, requireRole } = require('../middleware/authUtils');
const itemService = require('../services/itemService');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const items = await itemService.getActiveItems();
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.post('/', authMiddleware, requireRole(['ADMIN']), [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const item = await itemService.createItem(req.body);
    
    if (req.auditLog) await req.auditLog('CREATE_ITEM', 'Item', item.id, null, 'success');
    
    const io = req.app.get('io');
    if (io) io.emit('item_updated');

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Create item error:', error);
    if (req.auditLog) await req.auditLog('CREATE_ITEM', 'Item', null, null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.get('/:id/check-links', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const result = await itemService.checkItemLinks(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Check item links error:', error);
    res.status(500).json({ success: false, error: error.message || 'An error occurred. Please try again.' });
  }
});

router.delete('/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    await itemService.deleteItem(req.params.id);
    
    if (req.auditLog) await req.auditLog('DELETE_ITEM', 'Item', parseInt(req.params.id), null, 'success');
    
    const io = req.app.get('io');
    if (io) io.emit('item_updated');

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete item error:', error);
    if (req.auditLog) await req.auditLog('DELETE_ITEM', 'Item', parseInt(req.params.id), null, 'failure', error.message);
    res.status(400).json({ success: false, error: error.message || 'An error occurred. Please try again.' });
  }
});

router.put('/:id', authMiddleware, requireRole(['ADMIN']), [
  param('id').isInt(),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const item = await itemService.updateItem(req.params.id, req.body);
    
    if (req.auditLog) await req.auditLog('UPDATE_ITEM', 'Item', parseInt(req.params.id), null, 'success');
    
    const io = req.app.get('io');
    if (io) io.emit('item_updated');

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Update item error:', error);
    if (req.auditLog) await req.auditLog('UPDATE_ITEM', 'Item', parseInt(req.params.id), null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
