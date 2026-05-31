const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireRole } = require('../middleware/authUtils');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({ where: { isActive: true } });
    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.post('/', authMiddleware, requireRole(['ADMIN', 'SALES']), [
  body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Invalid customer name'),
  body('phone').trim().isLength({ min: 5, max: 20 }).withMessage('Invalid phone number'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('shippingAddress').trim().isLength({ max: 500 }).withMessage('Address too long'),
  body('taxNumber').trim().isLength({ max: 50 }).withMessage('Invalid tax number')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  
  try {
    const { name, phone, email, shippingAddress, taxNumber } = req.body;
    const customer = await prisma.customer.create({
      data: { name, phone, email, shippingAddress, taxNumber }
    });
    if (req.auditLog) await req.auditLog('CREATE_CUSTOMER', 'Customer', customer.id, { name, email }, 'success');
    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Create customer error:', error);
    if (req.auditLog) await req.auditLog('CREATE_CUSTOMER', 'Customer', null, req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.get('/:id/check-links', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    
    const count = await prisma.order.count({
      where: {
        OR: [
          { customerId: id }
        ]
      }
    });
    
    res.json({ success: true, count, name: customer.name });
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
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    const orderCount = await prisma.order.count({
      where: {
        OR: [
          { customerId: id }
        ]
      }
    });

    if (orderCount > 0) {
      return res.status(400).json({ success: false, error: `Cannot delete. '${customer.name}' is used in ${orderCount} Sales Orders.` });
    }

    await prisma.customer.delete({ where: { id } });
    if (req.auditLog) await req.auditLog('DELETE_CUSTOMER', 'Customer', id, null, 'success');
    res.json({ success: true });
  } catch (error) {
    console.error('Delete customer error:', error);
    if (req.auditLog) await req.auditLog('DELETE_CUSTOMER', 'Customer', parseInt(req.params.id), null, 'failure', error.message);
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
    const { name, phone, email, shippingAddress, taxNumber } = req.body;
    const customer = await prisma.customer.update({
      where: { id },
      data: { name, phone, email, shippingAddress, taxNumber }
    });
    if (req.auditLog) await req.auditLog('UPDATE_CUSTOMER', 'Customer', id, { name, email }, 'success');
    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Update customer error:', error);
    if (req.auditLog) await req.auditLog('UPDATE_CUSTOMER', 'Customer', parseInt(req.params.id), req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
