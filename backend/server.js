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
const deviceRoutes = require('./routes/devices');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');

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
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
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

// GET /api/system/update-check
app.get('/api/system/update-check', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const releasePath = path.join(__dirname, 'uploads/releases/release.json');
    if (fs.existsSync(releasePath)) {
      const data = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
      if (data.latestVersion) {
        const apkPath = path.join(__dirname, 'uploads', 'releases', `MivoxSpas-OrderManager-v${data.latestVersion}.apk`);
        if (!fs.existsSync(apkPath)) {
          return res.json({ success: true, data: null });
        }
      }
      res.json({ success: true, data });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (error) {
    res.json({ success: false, error: 'Failed to check for updates' });
  }
});

// GET /api/version
app.get('/api/version', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const releasePath = path.join(__dirname, 'uploads/releases/release.json');
    if (!fs.existsSync(releasePath)) {
      return res.status(404).json({ success: false, error: 'Release metadata not found' });
    }

    const data = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
    const latestVersion = data.latestVersion || data.version || null;
    if (!latestVersion) {
      return res.status(404).json({ success: false, error: 'Release version not available' });
    }

    const apkPath = path.join(__dirname, 'uploads', 'releases', `MivoxSpas-OrderManager-v${latestVersion}.apk`);
    if (!fs.existsSync(apkPath)) {
      return res.status(404).json({ success: false, error: 'Release APK not available' });
    }

    const PUBLIC_API_URL = process.env.PUBLIC_API_URL || 'http://localhost:3001';
    const apkUrl = `${PUBLIC_API_URL}/api/uploads/releases/MivoxSpas-OrderManager-v${latestVersion}.apk`;

    res.json({
      success: true,
      version: latestVersion,
      apk_url: apkUrl
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to read release metadata' });
  }
});

// GET /api/system/update-page
// This provides a fallback HTML page for users on v1.0.5 (or older) where window.location.href directly to an APK fails inside Capacitor.
app.get('/api/system/update-page', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  let latestVersion = '1.0.0';
  try {
    const releasePath = path.join(__dirname, 'uploads/releases/release.json');
    if (fs.existsSync(releasePath)) {
      const data = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
      if (data.latestVersion) latestVersion = data.latestVersion;
    }
  } catch (e) {}

  const v = Date.now();
  const apkName = `MivoxSpas-OrderManager-v${latestVersion}.apk`;
  const apkPath = path.join(__dirname, 'uploads', 'releases', apkName);
  if (!fs.existsSync(apkPath)) {
    return res.status(404).send('<h1>Update unavailable</h1><p>The requested APK is not available on the server.</p>');
  }
  const PUBLIC_API_URL = process.env.PUBLIC_API_URL || 'http://localhost:3001';
  const apkUrl = `${PUBLIC_API_URL}/api/uploads/releases/${apkName}?v=${v}`;
  // Build intent URL correctly by stripping protocol from PUBLIC_API_URL
  const intentHost = PUBLIC_API_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const intentUrl = `intent://${intentHost}/api/uploads/releases/${apkName}?v=${v}#Intent;scheme=http;package=com.android.chrome;end`;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Download Update</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #0f172a; color: white; text-align: center; padding: 20px; }
        .btn { background: #3b82f6; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-size: 18px; font-weight: bold; margin-top: 20px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .btn-alt { background: #475569; margin-top: 15px; }
        h1 { margin-bottom: 10px; }
        p { color: #94a3b8; margin-bottom: 30px; }
      </style>
    </head>
    <body>
      <h1>Update Available</h1>
      <p>Please click the button below to download the latest version in your browser.</p>
      <a href="${intentUrl}" class="btn">Download Update Now</a>
      <a href="${apkUrl}" class="btn btn-alt">Alternative Download Link</a>
    </body>
    </html>
  `);
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
app.use('/api/devices', deviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/debug-items', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const itemsPath = path.join(__dirname, 'uploads/items');
    const attachmentsPath = path.join(__dirname, 'uploads/order_attachments');
    const attachments = fs.existsSync(attachmentsPath) ? fs.readdirSync(attachmentsPath) : [];
    const attachmentsStats = attachments.map(f => { const st = fs.statSync(path.join(attachmentsPath, f)); return { name: f, size: st.size }; });
    const items = fs.existsSync(itemsPath) ? fs.readdirSync(itemsPath) : [];
    const itemsStats = items.map(f => {
      const st = fs.statSync(path.join(itemsPath, f));
      return { name: f, size: st.size, time: st.mtime };
    });
    res.json({ success: true, itemsPath, __dirname, cwd: process.cwd(), files: itemsStats, attachments: attachmentsStats });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});


io.on('connection', (socket) => {
  console.log('A client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

// Serve uploads directory statically via /api to bypass Nginx SPA intercept
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  } else {
    next();
  }
});

// Global error handler — catches PayloadTooLargeError and other Express errors
// so they return a clean JSON response instead of crashing the process
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      error: 'File too large. Maximum upload size is 25MB.'
    });
  }
  console.error('Unhandled Express error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Safety net for truly unexpected errors — log but don't exit
// IMPORTANT: exit on EADDRINUSE so PM2 can cleanly restart
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  if (err.code === 'EADDRINUSE') {
    console.error('Port already in use — exiting so PM2 can restart cleanly.');
    process.exit(1);
  }
  // For other errors, keep alive
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION (server kept alive):', reason);
});

// Nginx listens on port 3000 externally and proxies to this Node server.
// PORT env var in .env is set to 3001 — respect it, fallback to 3001.
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, server };
