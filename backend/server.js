const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { csrfProtection, getCsrfToken } = require('./middleware/csrf');
const { attachAuditLogger } = require('./middleware/auditLog');

const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const customerRoutes = require('./routes/customers');
const orderRoutes = require('./routes/orders');
const backupRoutes = require('./routes/backup');

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('ERROR: JWT_SECRET not set or too short in .env file. Min 32 characters required.');
  process.exit(1);
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim());
const io = new Server(server, {
  cors: { 
    origin: ALLOWED_ORIGINS,
    credentials: true
  }
});
app.set('io', io);

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token']
}));

app.use(cookieParser());
app.use(express.json());
app.use(attachAuditLogger);

// CSRF Protection Middleware for all state-changing routes except specific ones
app.use((req, res, next) => {
  const hasBearerToken = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && 
      !['/api/auth/login', '/health'].includes(req.path) &&
      !hasBearerToken) {
    csrfProtection(req, res, next);
  } else {
    next();
  }
});

// GET /api/csrf-token
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ 
    success: true, 
    csrfToken: req.csrfToken()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/backup', backupRoutes);

io.on('connection', (socket) => {
  console.log('A client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

// Serve uploads directory statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  } else {
    next();
  }
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, server };
