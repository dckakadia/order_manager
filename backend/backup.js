const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const prisma = new PrismaClient();

// Load credentials
const CREDENTIALS_PATH = path.join(__dirname, 'google-credentials.json');
const FOLDER_ID = '1hNDVZuTfK9yEXetR7-g57Izw5epmGkDA';

let lastBackupTime = null;

// Initialize Google Drive API
function getDriveService() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('Google credentials missing');
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

async function performBackup() {
  console.log('Starting automated Google Drive backup...');
  try {
    const drive = getDriveService();
    const orders = await prisma.order.findMany();
    
    const now = new Date();
    const dateStr = String(now.getDate()).padStart(2, '0') + '-' + 
                    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                    now.getFullYear();
    const fileName = `OceanSpas_Backup_${dateStr}.json`;
    
    // Create temporary file
    const tempPath = path.join(__dirname, fileName);
    fs.writeFileSync(tempPath, JSON.stringify(orders, null, 2));

    // Upload to Drive
    const fileMetadata = {
      name: fileName,
      parents: [FOLDER_ID]
    };
    const media = {
      mimeType: 'application/json',
      body: fs.createReadStream(tempPath)
    };
    
    await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });
    console.log(`Backup uploaded successfully: ${fileName}`);
    
    // Clean up local temp file
    fs.unlinkSync(tempPath);
    
    lastBackupTime = new Date().toISOString();

    // Delete backups older than 30 days
    await deleteOldBackups(drive);
    
    return lastBackupTime;
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
}

async function deleteOldBackups(drive) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and mimeType='application/json'`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc'
    });

    const files = res.data.files;
    if (files.length) {
      for (const file of files) {
        const fileDate = new Date(file.createdTime);
        if (fileDate < thirtyDaysAgo) {
          await drive.files.delete({ fileId: file.id });
          console.log(`Deleted old backup: ${file.name}`);
        }
      }
    }
  } catch (err) {
    console.error('Error cleaning old backups:', err);
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
