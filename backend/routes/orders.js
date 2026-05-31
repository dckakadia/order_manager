const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireRole } = require('../middleware/authUtils');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/', authMiddleware, [
  body('customerId').isInt().withMessage('Valid customer ID required'),
  body('baseModel').trim().isLength({ min: 1 }).withMessage('Base model required'),
  body('totalPrice').isFloat({ min: 0 }).withMessage('Invalid price')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const data = req.body;
    const order = await prisma.order.create({
      data: {
        customerId: parseInt(data.customerId),
        baseModel: data.baseModel,
        itemId: data.itemId ? parseInt(data.itemId) : null,
        variant: data.variant || null,
        basePrice: parseFloat(data.basePrice) || 0,
        totalPrice: parseFloat(data.totalPrice) || 0,
        notes: data.notes || null,
        faucetPosition: data.faucetPosition || null,
        sidePanel: data.sidePanel || null,
        orderBy: data.orderBy || null,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        checkInTime: data.checkInTime ? new Date(data.checkInTime) : null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        status: 'Order Form Received'
      },
      include: { customer: true }
    });

    if (req.auditLog) await req.auditLog('CREATE_ORDER', 'Order', order.id, { customerId: data.customerId, totalPrice: data.totalPrice }, 'success');

    const io = req.app.get('io');
    if (io) {
      // Flatten the payload for clients expecting customerName directly
      const flatOrder = {
        ...order,
        customerName: order.customer.name,
        phone: order.customer.phone
      };
      io.emit('new_order', flatOrder);
    }
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Create order error:', error);
    if (req.auditLog) await req.auditLog('CREATE_ORDER', 'Order', null, req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 1000);
    const skip = (page - 1) * limit;
    const includeDeleted = req.query.includeDeleted === 'true';

    const orders = await prisma.order.findMany({
      where: includeDeleted ? {} : { deletedAt: null },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { customer: true }
    });

    const flatOrders = orders.map(o => ({
      ...o,
      customerName: o.customer?.name,
      phone: o.customer?.phone
    }));

    const total = await prisma.order.count({
      where: includeDeleted ? {} : { deletedAt: null }
    });

    res.json({
      success: true,
      data: flatOrders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.put('/:id/status', authMiddleware, requireRole(['ADMIN', 'MANAGER']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (status === 'Cancelled' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Only ADMIN can cancel orders' });
    }

    const order = await prisma.order.update({ 
      where: { id }, 
      data: { status },
      include: { customer: true }
    });

    if (req.auditLog) await req.auditLog('UPDATE_ORDER_STATUS', 'Order', id, { status }, 'success');
    
    const io = req.app.get('io');
    if (io) {
      const flatOrder = {
        ...order,
        customerName: order.customer?.name,
        phone: order.customer?.phone
      };
      io.emit('order_status_updated', flatOrder);
    }

    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Update order status error:', error);
    if (req.auditLog) await req.auditLog('UPDATE_ORDER_STATUS', 'Order', parseInt(req.params.id), { status: req.body.status }, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.delete('/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const id = parseInt(req.params.id);
    // Soft delete
    await prisma.order.update({ 
      where: { id },
      data: { deletedAt: new Date() }
    });
    
    if (req.auditLog) await req.auditLog('DELETE_ORDER', 'Order', id, null, 'success');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('order_deleted', id);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete order error:', error);
    if (req.auditLog) await req.auditLog('DELETE_ORDER', 'Order', parseInt(req.params.id), null, 'failure', error.message);
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
    const data = req.body;
    
    const updateData = {};
    if (data.customerId !== undefined) updateData.customerId = parseInt(data.customerId);
    if (data.baseModel !== undefined) updateData.baseModel = data.baseModel;
    if (data.variant !== undefined) updateData.variant = data.variant;
    if (data.totalPrice !== undefined) updateData.totalPrice = parseFloat(data.totalPrice) || 0;
    if (data.deliveryDate !== undefined) updateData.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.faucetPosition !== undefined) updateData.faucetPosition = data.faucetPosition;
    if (data.sidePanel !== undefined) updateData.sidePanel = data.sidePanel;
    if (data.orderBy !== undefined) updateData.orderBy = data.orderBy;
    
    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: { customer: true }
    });
    
    if (req.auditLog) await req.auditLog('UPDATE_ORDER', 'Order', id, { totalPrice: data.totalPrice }, 'success');
    
    const io = req.app.get('io');
    if (io) {
      const flatOrder = {
        ...order,
        customerName: order.customer?.name,
        phone: order.customer?.phone
      };
      io.emit('order_status_updated', flatOrder);
    }
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Update order error:', error);
    if (req.auditLog) await req.auditLog('UPDATE_ORDER', 'Order', parseInt(req.params.id), req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
