const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const prisma = new PrismaClient();

// Setup local backups directory
const BACKUPS_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

let lastBackupTime = null;

async function runRcloneBackup() {
  // Check if rclone is installed
  try {
    await execPromise('rclone --version');
  } catch (err) {
    console.warn('rclone is not installed or not in PATH. Skipping remote backup.');
    return;
  }

  const dbPath = path.join(__dirname, 'prisma', 'dev.db');
  const uploadsPath = path.join(__dirname, 'uploads');
  const localBackupsPath = BACKUPS_DIR;
  
  const rcloneConfigPath = process.platform === 'win32'
    ? path.join(process.env.USERPROFILE || 'C:', '.config', 'rclone', 'rclone.conf')
    : '/home/dckakadia/.config/rclone/rclone.conf';

  try {
    console.log('Starting Google Drive backup via rclone...');
    
    // 1. Copy SQLite db file (if exists)
    if (fs.existsSync(dbPath)) {
      const dbCmd = `rclone --config ${rcloneConfigPath} copy "${dbPath}" gdrive:backups/db`;
      console.log(`Running: ${dbCmd}`);
      await execPromise(dbCmd);
    } else {
      console.log('SQLite dev.db file does not exist, skipping SQLite database backup.');
    }
    
    // 2. Copy uploads folder (attachment photos)
    const uploadsCmd = `rclone --config ${rcloneConfigPath} copy "${uploadsPath}" gdrive:backups/uploads`;
    console.log(`Running: ${uploadsCmd}`);
    await execPromise(uploadsCmd);

    // 3. Copy JSON backups folder
    const jsonCmd = `rclone --config ${rcloneConfigPath} copy "${localBackupsPath}" gdrive:backups/json`;
    console.log(`Running: ${jsonCmd}`);
    await execPromise(jsonCmd);

    console.log('Google Drive backup completed successfully!');
  } catch (error) {
    console.error('Rclone backup failed:', error);
    const errorMsg = error.message || error.stderr || '';
    if (errorMsg.includes('invalid_grant') || errorMsg.includes('Invalid JWT Signature') || errorMsg.includes('token: 400 Bad Request')) {
      throw new Error('Google Drive service account key is invalid or revoked. Please update backend/google-credentials.json on the Ubuntu server.');
    }
    throw new Error(`Rclone backup failed: ${errorMsg}`);
  }
}

async function performBackup() {
  console.log('Starting automated database backup...');
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
    
    // Trigger Google Drive backup using rclone
    await runRcloneBackup();
    
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
