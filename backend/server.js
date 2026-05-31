const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { body, validationResult, param } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const backupService = require('./backup');

// PHASE 2: Import cookie auth and CSRF middleware
const { setAuthCookie, clearAuthCookie, cookieAuthMiddleware, TOKEN_EXPIRY } = require('./middleware/cookieAuth');
const { csrfProtection, getCsrfToken } = require('./middleware/csrf');

// PHASE 3: Import audit logging
const { attachAuditLogger } = require('./middleware/auditLog');

const app = express();
const server = http.createServer(app);

// CRITICAL FIX: Validate JWT_SECRET exists
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('ERROR: JWT_SECRET not set or too short in .env file. Min 32 characters required.');
  process.exit(1);
}

// CRITICAL FIX: Configure CORS to restrict origins
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim());
const io = new Server(server, {
  cors: { 
    origin: ALLOWED_ORIGINS,
    credentials: true
  }
});
const prisma = new PrismaClient();

// CRITICAL FIX: Only allow specified origins
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// PHASE 2: Add cookie parser for HttpOnly cookie support
app.use(cookieParser());

app.use(express.json());

// PHASE 3: Attach audit logger to all requests
app.use(attachAuditLogger);

// PHASE 2: Apply CSRF protection to state-changing routes
// Note: Login and health check are exempt
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && 
      !['/api/login', '/health'].includes(req.path)) {
    csrfProtection(req, res, next);
  } else {
    next();
  }
});

// Rate limiting: Login endpoint protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// PHASE 2: Use cookie-based authentication instead of Bearer tokens
// For backward compatibility, support both cookies and Bearer tokens
const authMiddleware = async (req, res, next) => {
  let token = req.cookies?.auth_token;

  // Fallback: Check for Bearer token in Authorization header (for API clients)
  if (!token) {
    token = req.headers['authorization']?.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      clearAuthCookie(res);
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser || !dbUser.isActive) {
        clearAuthCookie(res);
        return res.status(401).json({ success: false, error: 'User account is disabled' });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
};

// LOGIN - CRITICAL FIX: Add rate limiting and bcrypt PIN verification
app.post('/api/login', loginLimiter, [
  body('username').trim().isLength({ min: 1, max: 100 }).withMessage('Invalid username'),
  body('pin').trim().isLength({ min: 1 }).withMessage('PIN required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, pin } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // CRITICAL FIX: Compare hashed PIN with bcrypt
    const pinMatch = await bcrypt.compare(pin, user.pin);
    if (!pinMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // PHASE 2: Set HttpOnly cookie for secure authentication and set readable role cookie
    setAuthCookie(res, token, user.role);

    // PHASE 3: Audit log successful login
    await req.auditLog('LOGIN', 'User', user.id, null, 'success');

    res.json({ 
      success: true, 
      token,  // Also return token for backward compatibility
      role: user.role, 
      expiresIn: TOKEN_EXPIRY,
      message: 'Login successful - Secure HttpOnly cookie set'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

// PHASE 2: Logout endpoint - clear HttpOnly cookies
app.post('/api/logout', authMiddleware, async (req, res) => {
  try {
    clearAuthCookie(res);
    // PHASE 3: Audit log logout
    await req.auditLog('LOGOUT', 'User', req.user.id, null, 'success');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'An error occurred' });
  }
});

// PHASE 2: Get CSRF token for state-changing operations
// Provide CSRF token (applies csrfProtection to generate token cookie)
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ 
    success: true, 
    csrfToken: req.csrfToken()
  });
});

// Health check endpoint (not protected)
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================================
// ITEM MASTER
// ============================================================
app.get('/api/items', authMiddleware, async (req, res) => {
  try {
    const items = await prisma.item.findMany({ where: { isActive: true } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/items', authMiddleware, requireRole(['ADMIN']), [
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
    // PHASE 3: Audit log item creation
    await req.auditLog('CREATE_ITEM', 'Item', item.id, { name, price }, 'success');
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Create item error:', error);
    // PHASE 3: Audit log failed creation
    await req.auditLog('CREATE_ITEM', 'Item', null, req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

app.delete('/api/items/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const id = parseInt(req.params.id);
    await prisma.item.update({ where: { id }, data: { isActive: false } });
    // PHASE 3: Audit log item deletion
    await req.auditLog('DELETE_ITEM', 'Item', id, null, 'success');
    res.json({ success: true });
  } catch (error) {
    console.error('Delete item error:', error);
    await req.auditLog('DELETE_ITEM', 'Item', id, null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

app.put('/api/items/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
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
    // PHASE 3: Audit log item update
    await req.auditLog('UPDATE_ITEM', 'Item', id, { name, price }, 'success');
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Update item error:', error);
    await req.auditLog('UPDATE_ITEM', 'Item', id, req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

// ============================================================
// CUSTOMERS
// ============================================================
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({ where: { isActive: true } });
    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

app.post('/api/customers', authMiddleware, requireRole(['ADMIN', 'SALES']), [
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
    // PHASE 3: Audit log customer creation
    await req.auditLog('CREATE_CUSTOMER', 'Customer', customer.id, { name, email }, 'success');
    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Create customer error:', error);
    // PHASE 3: Audit log failed creation
    await req.auditLog('CREATE_CUSTOMER', 'Customer', null, req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

// BUG FIX #7: Only ADMIN can delete
app.delete('/api/customers/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const id = parseInt(req.params.id);
    await prisma.customer.update({ where: { id }, data: { isActive: false } });
    // PHASE 3: Audit log customer deletion
    await req.auditLog('DELETE_CUSTOMER', 'Customer', id, null, 'success');
    res.json({ success: true });
  } catch (error) {
    console.error('Delete customer error:', error);
    await req.auditLog('DELETE_CUSTOMER', 'Customer', id, null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

app.put('/api/customers/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
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
    // PHASE 3: Audit log customer update
    await req.auditLog('UPDATE_CUSTOMER', 'Customer', id, { name, email }, 'success');
    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Update customer error:', error);
    await req.auditLog('UPDATE_CUSTOMER', 'Customer', id, req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

// ============================================================
// ORDERS
// ============================================================
app.post('/api/orders', authMiddleware, [
  body('customerName').trim().isLength({ min: 1, max: 200 }).withMessage('Invalid customer name'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('phone').trim().isLength({ min: 5, max: 20 }).withMessage('Invalid phone'),
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
        customerName: data.customerName,
        phone: data.phone,
        email: data.email,
        shippingAddress: data.shippingAddress,
        taxNumber: data.taxNumber,
        baseModel: data.baseModel,
        variant: data.variant || null,
        basePrice: parseFloat(data.basePrice) || 0,
        totalPrice: parseFloat(data.totalPrice) || 0,
        // NEW FEATURE: Save notes field
        notes: data.notes || null,
        faucetPosition: data.faucetPosition || null,
        sidePanel: data.sidePanel || null,
        orderBy: data.orderBy || null,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        checkInTime: data.checkInTime ? new Date(data.checkInTime) : null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        status: 'Order Form Received'
      }
    });

    // PHASE 3: Audit log order creation
    await req.auditLog('CREATE_ORDER', 'Order', order.id, 
      { customerName: data.customerName, totalPrice: data.totalPrice }, 'success');

    io.emit('new_order', order);
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Create order error:', error);
    // PHASE 3: Audit log failed order creation
    await req.auditLog('CREATE_ORDER', 'Order', null, req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    // BUG FIX #8: Add pagination to prevent memory issues
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 1000);
    const skip = (page - 1) * limit;

    const orders = await prisma.order.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.order.count();
    res.json({
      success: true,
      data: orders,
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

app.get('/api/backup/download', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const orders = await prisma.order.findMany();
    const customers = await prisma.customer.findMany();
    const items = await prisma.item.findMany();
    const users = await prisma.user.findMany();
    // PHASE 3: Audit log backup download
    await req.auditLog('BACKUP_DOWNLOAD', 'Backup', null, 
      { ordersCount: orders.length }, 'success');
    res.json({ success: true, data: { orders, customers, items, users } });
  } catch (error) {
    console.error('Backup download error:', error);
    await req.auditLog('BACKUP_DOWNLOAD', 'Backup', null, null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

app.post('/api/backup/restore', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { orders, customers, items, users } = req.body;
    
    if (!orders || !customers || !items || !users) {
      return res.status(400).json({ success: false, error: 'Invalid backup format' });
    }
    
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing records
      await tx.order.deleteMany();
      await tx.customer.deleteMany();
      await tx.item.deleteMany();
      await tx.user.deleteMany();
      
      // 2. Insert records with their original IDs
      if (users.length) await tx.user.createMany({ data: users });
      if (items.length) await tx.item.createMany({ data: items });
      if (customers.length) await tx.customer.createMany({ data: customers });
      if (orders.length) await tx.order.createMany({ data: orders });
      
      // 3. Reset PostgreSQL sequence generators so future inserts work properly
      await tx.$executeRawUnsafe(`SELECT setval('"User_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "User"), 1), false)`);
      await tx.$executeRawUnsafe(`SELECT setval('"Item_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "Item"), 1), false)`);
      await tx.$executeRawUnsafe(`SELECT setval('"Customer_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "Customer"), 1), false)`);
      await tx.$executeRawUnsafe(`SELECT setval('"Order_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "Order"), 1), false)`);
    });
    
    // PHASE 3: Audit log backup restore
    await req.auditLog('BACKUP_RESTORE', 'Backup', null,
      { ordersCount: orders.length }, 'success');

    // Broadcast general update to connected clients
    io.emit('full_backup_restored');
    res.json({ success: true, message: 'Database fully restored' });
  } catch (error) {
    console.error('Backup restore error:', error);
    await req.auditLog('BACKUP_RESTORE', 'Backup', null, null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

app.put('/api/orders/:id/status', authMiddleware, requireRole(['ADMIN', 'MANAGER']), [param('id').isInt()], async (req, res) => {
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

    const order = await prisma.order.update({ where: { id }, data: { status } });
    // PHASE 3: Audit log order status update
    await req.auditLog('UPDATE_ORDER_STATUS', 'Order', id, { status }, 'success');
    io.emit('order_status_updated', order);
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Update order status error:', error);
    await req.auditLog('UPDATE_ORDER_STATUS', 'Order', id, { status: req.body.status }, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

app.delete('/api/orders/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const id = parseInt(req.params.id);
    await prisma.order.delete({ where: { id } });
    // PHASE 3: Audit log order deletion
    await req.auditLog('DELETE_ORDER', 'Order', id, null, 'success');
    io.emit('order_deleted', id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete order error:', error);
    await req.auditLog('DELETE_ORDER', 'Order', id, null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

app.put('/api/orders/:id', authMiddleware, requireRole(['ADMIN']), [param('id').isInt()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const id = parseInt(req.params.id);
    const data = req.body;
    
    const updateData = {};
    if (data.customerName !== undefined) updateData.customerName = data.customerName;
    if (data.phone !== undefined) updateData.phone = data.phone;
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
      data: updateData
    });
    
    // PHASE 3: Audit log order update
    await req.auditLog('UPDATE_ORDER', 'Order', id, 
      { customerName: data.customerName, totalPrice: data.totalPrice }, 'success');
    
    io.emit('order_status_updated', order);
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Update order error:', error);
    await req.auditLog('UPDATE_ORDER', 'Order', id, req.body, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

// ============================================================
// BACKUP (Google Drive)
// ============================================================
app.post('/api/backup', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const timestamp = await backupService.performBackup();
    // PHASE 3: Audit log backup
    await req.auditLog('BACKUP_GOOGLE_DRIVE', 'Backup', null, 
      { timestamp }, 'success');
    res.json({ success: true, timestamp });
  } catch (error) {
    console.error('Backup error:', error);
    await req.auditLog('BACKUP_GOOGLE_DRIVE', 'Backup', null, null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

app.get('/api/backup/status', authMiddleware, requireRole(['ADMIN']), (req, res) => {
  res.json({ 
    success: true,
    lastBackup: backupService.getLastBackupTime() 
  });
});

io.on('connection', (socket) => {
  console.log('A client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

// Ensure manish user exists for customer creation
prisma.user.upsert({
  where: { username: 'manish' },
  update: {},
  create: {
    username: 'manish',
    pin: '7411',
    role: 'SALES'
  }
}).catch(err => console.error('Error ensuring manish user exists:', err));

// BUG FIX #4: Default port changed to 3001 to match Nginx proxy configuration
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
