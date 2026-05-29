const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const backupService = require('./backup');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_ocean_spas_key';

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  });
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// LOGIN
app.post('/api/login', async (req, res) => {
  const { username, pin } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (user && user.pin === pin && user.isActive) {
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ success: true, token, role: user.role });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

app.post('/api/items', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
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
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/items/:id', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.item.update({ where: { id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/items/:id', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
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
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// CUSTOMERS
// ============================================================
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({ where: { isActive: true } });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', authMiddleware, requireRole(['ADMIN', 'SALES']), async (req, res) => {
  try {
    const { name, phone, email, shippingAddress, taxNumber } = req.body;
    const customer = await prisma.customer.create({
      data: { name, phone, email, shippingAddress, taxNumber }
    });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// BUG FIX #7: Only ADMIN can delete
app.delete('/api/customers/:id', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.customer.update({ where: { id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/customers/:id', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, email, shippingAddress, taxNumber } = req.body;
    const customer = await prisma.customer.update({
      where: { id },
      data: { name, phone, email, shippingAddress, taxNumber }
    });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ORDERS
// ============================================================
app.post('/api/orders', authMiddleware, async (req, res) => {
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

    io.emit('new_order', order);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/backup/download', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const orders = await prisma.order.findMany();
    const customers = await prisma.customer.findMany();
    const items = await prisma.item.findMany();
    const users = await prisma.user.findMany();
    res.json({ orders, customers, items, users });
  } catch (error) {
    console.error('Backup download error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backup/restore', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { orders, customers, items, users } = req.body;
    
    if (!orders || !customers || !items || !users) {
      return res.status(400).json({ error: 'Invalid backup format' });
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
    
    // Broadcast general update to connected clients
    io.emit('full_backup_restored');
    res.json({ success: true, message: 'Database fully restored' });
  } catch (error) {
    console.error('Backup restore error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:id/status', authMiddleware, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (status === 'Cancelled' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only ADMIN can cancel orders' });
    }

    const order = await prisma.order.update({ where: { id }, data: { status } });
    io.emit('order_status_updated', order);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/orders/:id', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.order.delete({ where: { id } });
    io.emit('order_deleted', id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:id', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
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
    
    io.emit('order_status_updated', order);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// BACKUP (Google Drive)
// ============================================================
app.post('/api/backup', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const timestamp = await backupService.performBackup();
    res.json({ success: true, timestamp });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/backup/status', authMiddleware, requireRole(['ADMIN']), (req, res) => {
  res.json({ lastBackup: backupService.getLastBackupTime() });
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
