const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const prisma = new PrismaClient();

// Setup local backups directory
const BACKUPS_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

let lastBackupTime = null;

async function performBackup() {
  console.log('Starting automated local database backup...');
  try {
    const orders = await prisma.order.findMany();
    const customers = await prisma.customer.findMany();
    const items = await prisma.item.findMany();
    const users = await prisma.user.findMany();
    
    const backupData = {
      orders,
      customers,
      items,
      users
    };
    
    const now = new Date();
    const dateStr = String(now.getDate()).padStart(2, '0') + '-' + 
                    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                    now.getFullYear();
    const fileName = `OceanSpas_Backup_${dateStr}.json`;
    const filePath = path.join(BACKUPS_DIR, fileName);
    
    // Write full backup to local disk
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
    console.log(`Local backup saved successfully: ${fileName}`);
    
    lastBackupTime = new Date().toISOString();

    // Delete backups older than 30 days
    await deleteOldBackups();
    
    return lastBackupTime;
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
}

async function deleteOldBackups() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const files = fs.readdirSync(BACKUPS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        if (stats.mtime < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          console.log(`Deleted old local backup: ${file}`);
        }
      }
    }
  } catch (err) {
    console.error('Error cleaning old local backups:', err);
  }
}

// Start cron job (Run daily at midnight)
cron.schedule('0 0 * * *', () => {
  performBackup().catch(console.error);
});

module.exports = {
  performBackup,
  getLastBackupTime: () => lastBackupTime
};
