const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { authMiddleware, requireRole } = require('../middleware/authUtils');
const orderService = require('../services/orderService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const sharp = require('sharp');

const prisma = new PrismaClient();
const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = path.join(__dirname, '../uploads/order_attachments');
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const orderId = req.params.id;
    const timestamp = Date.now();
    // Sanitize originalname to avoid spaces/special chars issues
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `${orderId}_${timestamp}_${sanitizedName}`);
  }
});
const upload = multer({ storage: storage });


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
        customerName: order.customer?.name,
        phone: order.customer?.phone,
        itemPhoto: order.item?.photo_filename
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
    const filters = {
      status: req.query.status,
      excludeStatus: req.query.excludeStatus
    };

    const result = await orderService.getOrders(page, limit, includeDeleted, filters);

    const flatOrders = result.orders.map(o => ({
      ...o,
      customerName: o.customer?.name,
      phone: o.customer?.phone,
      itemPhoto: o.item?.photo_filename
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
        phone: order.customer?.phone,
        itemPhoto: order.item?.photo_filename
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
        phone: order.customer?.phone,
        itemPhoto: order.item?.photo_filename
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

// GET /api/orders/:id/attachments
router.get('/:id/attachments', authMiddleware, [param('id').isInt()], async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const attachments = await prisma.orderAttachment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: attachments });
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({ success: false, error: 'Failed to load attachments' });
  }
});

// POST /api/orders/:id/attachments
router.post('/:id/attachments', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    
    let filename, destination, originalname, filepath;

    if (req.body.imageBase64) {
      // Handle Base64 Upload from JSON
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      destination = path.join(__dirname, '../uploads/order_attachments');
      if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
      originalname = req.body.fileName || `photo_${Date.now()}.jpg`;
      const sanitizedName = originalname.replace(/[^a-zA-Z0-9.]/g, '_');
      filename = `${orderId}_${Date.now()}_${sanitizedName}`;
      filepath = path.join(destination, filename);
      fs.writeFileSync(filepath, buffer);
    } else if (req.file) {
      // Handle standard multipart/form-data upload
      destination = req.file.destination;
      filename = req.file.filename;
      originalname = req.file.originalname;
      filepath = req.file.path;
    } else {
      return res.status(400).json({ success: false, error: 'No photo file provided' });
    }

    // Parse optional geo fields from form data or JSON body
    const photoLat = req.body.lat ? parseFloat(req.body.lat) : null;
    const photoLng = req.body.lng ? parseFloat(req.body.lng) : null;
    const photoType = req.body.photoType || "general";

    try {
      const thumbFilename = `thumb_${filename}`;
      const thumbPath = path.join(destination, thumbFilename);
      await sharp(filepath)
        .resize(250, 250, { fit: 'cover' })
        .jpeg({ quality: 70 })
        .toFile(thumbPath);
    } catch (err) {
      console.warn("Failed to generate thumbnail:", err);
    }

    const attachment = await prisma.orderAttachment.create({
      data: {
        orderId,
        fileName: originalname,
        filePath: `/api/uploads/order_attachments/${filename}`,
        uploadedBy: req.user.id,
        photoLat,
        photoLng,
        photoType
      }
    });

    res.json({ success: true, data: attachment });
  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload photo' });
  }
});

// DELETE /api/orders/:id/attachments/:attachmentId
router.delete('/:id/attachments/:attachmentId', authMiddleware, async (req, res) => {
  try {
    if (req.user && req.user.username === 'sunil') {
      return res.status(403).json({ success: false, error: 'You do not have permission to delete photos' });
    }
    
    const attachmentId = parseInt(req.params.attachmentId);
    
    // Find attachment first
    const attachment = await prisma.orderAttachment.findUnique({
      where: { id: attachmentId }
    });
    
    if (!attachment || attachment.orderId !== parseInt(req.params.id)) {
      return res.status(404).json({ success: false, error: 'Attachment not found for this order' });
    }

    // Delete from DB
    await prisma.orderAttachment.delete({
      where: { id: attachmentId }
    });

    // Delete file from disk
    const absolutePath = path.join(__dirname, '..', attachment.filePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
    const thumbAbsolutePath = absolutePath.replace(/([\\\/])([^\\\/]+)$/, '$1thumb_$2');
    if (fs.existsSync(thumbAbsolutePath)) {
      fs.unlinkSync(thumbAbsolutePath);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete attachment' });
  }
});

module.exports = router;
