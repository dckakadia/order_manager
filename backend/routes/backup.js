const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireRole } = require('../middleware/authUtils');
const backupService = require('../backup');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/download', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const orders = await prisma.order.findMany();
    const customers = await prisma.customer.findMany();
    const items = await prisma.item.findMany();
    const users = await prisma.user.findMany();
    if (req.auditLog) await req.auditLog('BACKUP_DOWNLOAD', 'Backup', null, { ordersCount: orders.length }, 'success');
    res.json({ success: true, data: { orders, customers, items, users } });
  } catch (error) {
    console.error('Backup download error:', error);
    if (req.auditLog) await req.auditLog('BACKUP_DOWNLOAD', 'Backup', null, null, 'failure', error.message);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
  }
});

router.post('/restore', authMiddleware, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { orders, customers, items, users } = req.body;
    
    if (!orders || !customers || !items || !users) {
      return res.status(400).json({ success: false, error: 'Invalid backup format' });
    }
    
    // CRITICAL: Auto-backup before overwrite
    await backupService.performBackup();
    
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
  try {
    const timestamp = await backupService.performBackup();
    if (req.auditLog) await req.auditLog('BACKUP_LOCAL', 'Backup', null, { timestamp }, 'success');
    res.json({ success: true, timestamp });
  } catch (error) {
    console.error('Backup error:', error);
    if (req.auditLog) await req.auditLog('BACKUP_LOCAL', 'Backup', null, null, 'failure', error.message);
    res.status(500).json({ success: false, error: error.message || 'An error occurred. Please try again.' });
  }
});

router.get('/status', authMiddleware, requireRole(['ADMIN']), (req, res) => {
  res.json({ 
    success: true,
    lastBackup: backupService.getLastBackupTime() 
  });
});

module.exports = router;
