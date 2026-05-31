const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireRole } = require('../middleware/authUtils');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const items = await prisma.item.findMany({ where: { isActive: true } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authMiddleware, requireRole(['ADMIN']), [
  body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Invalid item name'),
  body('price').isFloat({ min: 0 }).withMessage('Invalid price')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const { category, name, price, silverPrice, goldPrice, platinumPrice, titaniumPrice } = req.body;
    const item = await prisma.item.create({
      data: { 
        category: category || 'Model', 
        name, 
        price: parseFloat(price) || 0,
        silverPrice: silverPrice !== undefined && silverPrice !== null ? parseFloat(silverPrice) : null,
        goldPrice: goldPrice !== undefined && goldPrice !== null ? parseFloat(goldPrice) : null,
        platinumPrice: platinumPrice !== undefined && platinumPrice !== null ? parseFloat(platinumPrice) : null,
        titaniumPrice: titaniumPrice !== undefined && titaniumPrice !== null ? parseFloat(titaniumPrice) : null
      }
    });
    if (req.auditLog) await req.auditLog('CREATE_ITEM', 'Item', item.id, { name, price }, 'success');
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Create item error:', error);
    if (req.auditLog) await req.auditLog('CREATE_ITEM', 'Item', null, req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.get('/:id/check-links', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
    
    const count = await prisma.order.count({
      where: {
        OR: [
          { itemId: id },
          { baseModel: item.name }
        ]
      }
    });
    
    res.json({ success: true, count, name: item.name });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const id = parseInt(req.params.id);
    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });

    const orderCount = await prisma.order.count({
      where: {
        OR: [
          { itemId: id },
          { baseModel: item.name }
        ]
      }
    });

    if (orderCount > 0) {
      return res.status(400).json({ success: false, error: `Cannot delete. '${item.name}' is used in ${orderCount} Sales Orders.` });
    }

    await prisma.item.delete({ where: { id } });
    if (req.auditLog) await req.auditLog('DELETE_ITEM', 'Item', id, null, 'success');
    res.json({ success: true });
  } catch (error) {
    console.error('Delete item error:', error);
    if (req.auditLog) await req.auditLog('DELETE_ITEM', 'Item', parseInt(req.params.id), null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.put('/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const id = parseInt(req.params.id);
    const { category, name, price, silverPrice, goldPrice, platinumPrice, titaniumPrice } = req.body;
    const item = await prisma.item.update({
      where: { id },
      data: { 
        category: category || 'Model', 
        name, 
        price: parseFloat(price) || 0,
        silverPrice: silverPrice !== undefined && silverPrice !== null ? parseFloat(silverPrice) : null,
        goldPrice: goldPrice !== undefined && goldPrice !== null ? parseFloat(goldPrice) : null,
        platinumPrice: platinumPrice !== undefined && platinumPrice !== null ? parseFloat(platinumPrice) : null,
        titaniumPrice: titaniumPrice !== undefined && titaniumPrice !== null ? parseFloat(titaniumPrice) : null
      }
    });
    if (req.auditLog) await req.auditLog('UPDATE_ITEM', 'Item', id, { name, price }, 'success');
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Update item error:', error);
    if (req.auditLog) await req.auditLog('UPDATE_ITEM', 'Item', parseInt(req.params.id), req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
