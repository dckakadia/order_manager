const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireRole } = require('../middleware/authUtils');
const backupService = require('../backup');

const router = express.Router();
const prisma = new PrismaClient();

// Track live backup state so frontend can poll
let backupState = {
  running: false, lastStatus: null, lastError: null, lastTimestamp: null,
  stage: null, overallPct: 0, stageLabel: null
};

router.get('/download', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const orders = await prisma.order.findMany();
    const customers = await prisma.customer.findMany();
    const items = await prisma.item.findMany();
    const users = await prisma.user.findMany();
    const attachments = await prisma.orderAttachment.findMany();
    const histories = await prisma.orderStatusHistory.findMany();
    if (req.auditLog) await req.auditLog('BACKUP_DOWNLOAD', 'Backup', null, { ordersCount: orders.length }, 'success');
    res.json({ success: true, data: { orders, customers, items, users, attachments, histories } });
  } catch (error) {
    console.error('Backup download error:', error);
    if (req.auditLog) await req.auditLog('BACKUP_DOWNLOAD', 'Backup', null, null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.post('/restore', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { orders, customers, items, users, attachments, histories } = req.body;
    
    if (!orders || !customers || !items || !users) {
      return res.status(400).json({ success: false, error: 'Invalid backup format' });
    }
    
    // CRITICAL: Auto-backup before overwrite
    await backupService.performBackup();
    
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing records
      await tx.orderAttachment.deleteMany();
      await tx.orderStatusHistory.deleteMany();
      await tx.order.deleteMany();
      await tx.customer.deleteMany();
      await tx.item.deleteMany();
      await tx.user.deleteMany();
      
      // 2. Insert records with their original IDs
      if (users.length) await tx.user.createMany({ data: users });
      if (items.length) await tx.item.createMany({ data: items });
      if (customers.length) await tx.customer.createMany({ data: customers });
      if (orders.length) await tx.order.createMany({ data: orders });
      if (attachments && attachments.length) await tx.orderAttachment.createMany({ data: attachments });
      if (histories && histories.length) await tx.orderStatusHistory.createMany({ data: histories });
      
      // 3. Reset PostgreSQL sequence generators so future inserts work properly
      await tx.$executeRawUnsafe(`SELECT setval('"User_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "User"), 1), false)`);
      await tx.$executeRawUnsafe(`SELECT setval('"Item_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "Item"), 1), false)`);
      await tx.$executeRawUnsafe(`SELECT setval('"Customer_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "Customer"), 1), false)`);
      await tx.$executeRawUnsafe(`SELECT setval('"Order_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "Order"), 1), false)`);
      await tx.$executeRawUnsafe(`SELECT setval('"OrderAttachment_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "OrderAttachment"), 1), false)`);
      await tx.$executeRawUnsafe(`SELECT setval('"OrderStatusHistory_id_seq"', COALESCE((SELECT MAX(id)+1 FROM "OrderStatusHistory"), 1), false)`);

    });
    
    if (req.auditLog) await req.auditLog('BACKUP_RESTORE', 'Backup', null, { ordersCount: orders.length }, 'success');

    const io = req.app.get('io');
    if (io) {
      io.emit('full_backup_restored');
    }
    res.json({ success: true, message: 'Database fully restored' });
  } catch (error) {
    console.error('Backup restore error:', error);
    if (req.auditLog) await req.auditLog('BACKUP_RESTORE', 'Backup', null, null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.post('/', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  // Prevent duplicate concurrent backups
  if (backupState.running) {
    return res.json({ success: true, message: 'Backup already in progress.', running: true, progress: backupState });
  }

  const io = req.app.get('io');

  // Reset state
  backupState = {
    running: true, lastStatus: 'running', lastError: null, lastTimestamp: null,
    stage: 'Starting…', overallPct: 0, stageLabel: 'Preparing'
  };

  // Intercept socket events to also keep backupState in sync for HTTP polling
  const wrappedIo = io ? {
    emit: (event, data) => {
      if (event === 'backup_progress') {
        backupState.stage = data.stage;
        backupState.overallPct = data.overallPct ?? backupState.overallPct;
        backupState.stageLabel = data.stageLabel ?? backupState.stageLabel;
      }
      io.emit(event, data);
    }
  } : null;

  // Respond immediately — avoids 504 Gateway Timeout
  res.json({ success: true, message: 'Backup started.', running: true });

  // Run in background
  backupService.performBackup(wrappedIo)
    .then((timestamp) => {
      backupState.running = false;
      backupState.lastStatus = 'success';
      backupState.lastTimestamp = timestamp;
      backupState.overallPct = 100;
      if (req.auditLog) req.auditLog('BACKUP_LOCAL', 'Backup', null, { timestamp }, 'success').catch(() => {});
      console.log('Background backup completed:', timestamp);
    })
    .catch((error) => {
      backupState.running = false;
      backupState.lastStatus = 'failed';
      backupState.lastError = error.message || 'Backup failed';
      backupState.overallPct = 0;
      if (req.auditLog) req.auditLog('BACKUP_LOCAL', 'Backup', null, null, 'failure', error.message).catch(() => {});
      console.error('Background backup failed:', error);
    });
});

router.get('/status', authMiddleware, requireRole(['ADMIN']), (req, res) => {
  res.json({ 
    success: true,
    running: backupState.running,
    lastStatus: backupState.lastStatus,
    lastError: backupState.lastError,
    lastTimestamp: backupState.lastTimestamp || backupService.getLastBackupTime(),
    stage: backupState.stage,
    overallPct: backupState.overallPct,
    stageLabel: backupState.stageLabel
  });
});

module.exports = router;
