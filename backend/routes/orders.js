const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { authMiddleware, requireRole } = require('../middleware/authUtils');
const orderService = require('../services/orderService');

const router = express.Router();

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
    const order = await orderService.createOrder(req.body, req.user.id);

    if (req.auditLog) await req.auditLog('CREATE_ORDER', 'Order', order.id, { customerId: req.body.customerId, totalPrice: req.body.totalPrice }, 'success');

    const io = req.app.get('io');
    if (io) {
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
    const includeDeleted = req.query.includeDeleted === 'true';

    const result = await orderService.getOrders(page, limit, includeDeleted);

    const flatOrders = result.orders.map(o => ({
      ...o,
      customerName: o.customer?.name,
      phone: o.customer?.phone
    }));

    res.json({
      success: true,
      data: flatOrders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.get('/:id/history', authMiddleware, [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const history = await orderService.getOrderHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Get order history error:', error);
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

    const order = await orderService.updateOrderStatus(id, status, req.user.id);

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
    await orderService.softDeleteOrder(id);
    
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
    const order = await orderService.updateOrder(id, req.body);
    
    if (req.auditLog) await req.auditLog('UPDATE_ORDER', 'Order', id, { totalPrice: req.body.totalPrice }, 'success');
    
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
