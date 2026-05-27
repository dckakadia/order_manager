const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const MANAGER_PIN = '1234';

// Basic Auth Middleware for simple PIN
const authMiddleware = (req, res, next) => {
  const pin = req.headers['x-pin'];
  if (pin === MANAGER_PIN) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

app.post('/api/login', (req, res) => {
  const { pin } = req.body;
  if (pin === MANAGER_PIN) {
    res.json({ success: true, message: 'Authenticated' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid PIN' });
  }
});

// ==================================
// ITEM MASTER API
// ==================================

app.get('/api/items', async (req, res) => {
  try {
    const items = await prisma.item.findMany({ where: { isActive: true } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/items', authMiddleware, async (req, res) => {
  try {
    const { category, name, price } = req.body;
    const item = await prisma.item.create({
      data: { category, name, price: parseFloat(price) || 0 }
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/items/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.item.update({
      where: { id },
      data: { isActive: false }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================================
// CUSTOMERS API
// ==================================

app.get('/api/customers', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({ where: { isActive: true } });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', async (req, res) => {
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

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.customer.update({
      where: { id },
      data: { isActive: false }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================================
// ORDERS API
// ==================================

app.post('/api/orders', async (req, res) => {
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
        basePrice: parseFloat(data.basePrice) || 0,
        totalPrice: parseFloat(data.totalPrice) || 0,
        locationLat: data.locationLat,
        locationLng: data.locationLng,
        checkInTime: data.checkInTime ? new Date(data.checkInTime) : null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        status: 'Order Form Received'
      }
    });

    // Broadcast new order to connected manager clients
    io.emit('new_order', order);
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:id/status', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    const order = await prisma.order.update({
      where: { id },
      data: { status }
    });
    
    // Broadcast status update
    io.emit('order_status_updated', order);
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('A client connected');
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
