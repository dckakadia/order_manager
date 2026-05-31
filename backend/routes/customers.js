const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { authMiddleware, requireRole } = require('../middleware/authUtils');
const customerService = require('../services/customerService');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const customers = await customerService.getActiveCustomers();
    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.post('/', authMiddleware, [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('phone').optional().trim(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const customer = await customerService.createCustomer(req.body);
    
    if (req.auditLog) await req.auditLog('CREATE_CUSTOMER', 'Customer', customer.id, null, 'success');
    
    const io = req.app.get('io');
    if (io) io.emit('customer_updated');

    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Create customer error:', error);
    if (req.auditLog) await req.auditLog('CREATE_CUSTOMER', 'Customer', null, null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.get('/:id/check-links', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const result = await customerService.checkCustomerLinks(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Check customer links error:', error);
    res.status(500).json({ success: false, error: error.message || 'An error occurred. Please try again.' });
  }
});

router.delete('/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    await customerService.deleteCustomer(req.params.id);
    
    if (req.auditLog) await req.auditLog('DELETE_CUSTOMER', 'Customer', parseInt(req.params.id), null, 'success');
    
    const io = req.app.get('io');
    if (io) io.emit('customer_updated');

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    if (req.auditLog) await req.auditLog('DELETE_CUSTOMER', 'Customer', parseInt(req.params.id), null, 'failure', error.message);
    res.status(400).json({ success: false, error: error.message || 'An error occurred. Please try again.' });
  }
});

router.put('/:id', authMiddleware, requireRole(['ADMIN']), [
  param('id').isInt(),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('phone').optional().trim(),
  body('email').optional().isEmail().withMessage('Valid email is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const customer = await customerService.updateCustomer(req.params.id, req.body);
    
    if (req.auditLog) await req.auditLog('UPDATE_CUSTOMER', 'Customer', parseInt(req.params.id), null, 'success');
    
    const io = req.app.get('io');
    if (io) io.emit('customer_updated');

    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Update customer error:', error);
    if (req.auditLog) await req.auditLog('UPDATE_CUSTOMER', 'Customer', parseInt(req.params.id), null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

module.exports = router;
