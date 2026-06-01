const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { authMiddleware, requireRole } = require('../middleware/authUtils');
const itemService = require('../services/itemService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = path.join(__dirname, '../uploads/items');
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    // Use item id from params if available, else just timestamp
    const itemId = req.params.id ? `item_${req.params.id}` : 'new_item';
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${itemId}_${timestamp}${ext}`);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG or WEBP files are allowed.'));
    }
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const items = await itemService.getActiveItems();
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.post('/', authMiddleware, requireRole(['ADMIN']), upload.single('photo'), [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    if (req.file) {
      req.body.photo_filename = req.file.filename;
    }
    const item = await itemService.createItem(req.body);
    
    if (req.auditLog) await req.auditLog('CREATE_ITEM', 'Item', item.id, null, 'success');
    
    const io = req.app.get('io');
    if (io) io.emit('item_updated');

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Create item error:', error);
    if (req.auditLog) await req.auditLog('CREATE_ITEM', 'Item', null, null, 'failure', error.message);
    if (req.file) fs.unlinkSync(req.file.path);
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
    const deletedItem = await itemService.deleteItem(req.params.id);
    
    if (deletedItem && deletedItem.photo_filename) {
      const filePath = path.join(__dirname, '../uploads/items', deletedItem.photo_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
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

router.put('/:id', authMiddleware, requireRole(['ADMIN']), upload.single('photo'), [
  param('id').isInt(),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    // Fetch old item to get old photo filename
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const oldItem = await prisma.item.findUnique({ where: { id: parseInt(req.params.id) } });

    if (req.file) {
      req.body.photo_filename = req.file.filename;
      // Delete old photo if exists
      if (oldItem && oldItem.photo_filename) {
        const oldPath = path.join(__dirname, '../uploads/items', oldItem.photo_filename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    } else if (req.body.remove_photo === 'true') {
      req.body.photo_filename = null;
      if (oldItem && oldItem.photo_filename) {
        const oldPath = path.join(__dirname, '../uploads/items', oldItem.photo_filename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }
    const item = await itemService.updateItem(req.params.id, req.body);
    
    if (req.auditLog) await req.auditLog('UPDATE_ITEM', 'Item', parseInt(req.params.id), null, 'success');
    
    const io = req.app.get('io');
    if (io) io.emit('item_updated');

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Update item error:', error);
    if (req.auditLog) await req.auditLog('UPDATE_ITEM', 'Item', parseInt(req.params.id), null, 'failure', error.message);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
