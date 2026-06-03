const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { exec, spawn } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const prisma = new PrismaClient();

// Setup local backups directory
const BACKUPS_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

let lastBackupTime = null;

// ─── Rclone stats parser ────────────────────────────────────────────────────
// Parses the human-readable rclone stats line:
// "Transferred:   12.345 MiB / 1.234 GiB, 13%, 3.21 MiB/s, ETA 1m23s"
function parseRcloneStats(line) {
  const result = {};

  // Bytes transferred + percentage
  const transferMatch = line.match(
    /Transferred:\s+([\d.]+)\s*(\w+)\s*\/\s*([\d.]+)\s*(\w+),\s*(\d+)%/
  );
  if (transferMatch) {
    result.uploadedBytes = toBytes(parseFloat(transferMatch[1]), transferMatch[2]);
    result.totalBytes = toBytes(parseFloat(transferMatch[3]), transferMatch[4]);
    result.percentage = parseInt(transferMatch[5], 10);
  }

  // Transfer speed
  const speedMatch = line.match(/([\d.]+)\s*(\w+)\/s/);
  if (speedMatch) {
    result.speedBytes = toBytes(parseFloat(speedMatch[1]), speedMatch[2]);
  }

  // ETA
  const etaMatch = line.match(/ETA\s+(\S+)/);
  if (etaMatch) {
    result.etaSeconds = parseEta(etaMatch[1]);
  }

  // File counts: "Transferred:   5 / 100, 5%"  (second occurrence)
  const fileMatch = line.match(/Transferred:\s+(\d+)\s*\/\s*(\d+),/);
  if (fileMatch) {
    result.processedFiles = parseInt(fileMatch[1], 10);
    result.totalFiles = parseInt(fileMatch[2], 10);
  }

  return result;
}

function toBytes(value, unit) {
  const u = unit.toUpperCase();
  if (u === 'B' || u === 'BYTES') return value;
  if (u === 'KIB' || u === 'KB') return value * 1024;
  if (u === 'MIB' || u === 'MB') return value * 1024 * 1024;
  if (u === 'GIB' || u === 'GB') return value * 1024 * 1024 * 1024;
  if (u === 'TIB' || u === 'TB') return value * 1024 * 1024 * 1024 * 1024;
  return value;
}

function parseEta(etaStr) {
  // e.g. "1h2m3s", "45s", "2m30s", "-"
  if (!etaStr || etaStr === '-' || etaStr === 'N/A') return null;
  let seconds = 0;
  const h = etaStr.match(/(\d+)h/);
  const m = etaStr.match(/(\d+)m/);
  const s = etaStr.match(/(\d+)s/);
  if (h) seconds += parseInt(h[1], 10) * 3600;
  if (m) seconds += parseInt(m[1], 10) * 60;
  if (s) seconds += parseInt(s[1], 10);
  return seconds;
}

function formatBytes(bytes) {
  if (!bytes || bytes < 1) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── Rclone runner with live progress ────────────────────────────────────────
// Runs a single rclone copy command and emits real-time stats via progressCallback.
// stageWeight: 0-100 share of overall progress this stage occupies
// stageOffset: overall progress offset where this stage starts
function runRcloneWithProgress(args, progressCallback) {
  return new Promise((resolve, reject) => {
    const proc = spawn('rclone', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let lastStats = {};
    let multiLineBuffer = '';

    const processChunk = (chunk) => {
      multiLineBuffer += chunk.toString();
      const lines = multiLineBuffer.split('\n');
      multiLineBuffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        const trimmed = line.replace(/\x1b\[[0-9;]*m/g, '').trim(); // strip ANSI colors
        if (!trimmed) continue;
        stderr += trimmed + '\n';

        const stats = parseRcloneStats(trimmed);
        if (Object.keys(stats).length > 0) {
          lastStats = { ...lastStats, ...stats };
          if (progressCallback) progressCallback({ ...lastStats });
        }
      }
    };

    proc.stdout.on('data', processChunk);
    proc.stderr.on('data', processChunk);

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(lastStats);
      } else {
        const errMsg = stderr || `rclone exited with code ${code}`;
        if (errMsg.includes('invalid_grant') || errMsg.includes('Invalid JWT Signature') || errMsg.includes('token: 400 Bad Request')) {
          reject(new Error('Google Drive service account key is invalid or revoked. Please update backend/google-credentials.json on the Ubuntu server.'));
        } else {
          reject(new Error(`Rclone backup failed: ${errMsg.slice(0, 500)}`));
        }
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start rclone: ${err.message}`));
    });
  });
}

// ─── Main rclone backup with Socket.IO progress ──────────────────────────────
async function runRcloneBackup(io) {
  // Check rclone is available
  try {
    await execPromise('rclone --version');
  } catch (err) {
    console.warn('rclone not found in PATH. Skipping remote backup.');
    return;
  }

  const dbPath = path.join(__dirname, 'prisma', 'dev.db');
  const uploadsPath = path.join(__dirname, 'uploads');
  const localBackupsPath = BACKUPS_DIR;

  const rcloneConfigPath = process.platform === 'win32'
    ? path.join(process.env.USERPROFILE || 'C:', '.config', 'rclone', 'rclone.conf')
    : '/home/dckakadia/.config/rclone/rclone.conf';

  const emit = (stage, extra = {}) => {
    if (!io) return;
    io.emit('backup_progress', { stage, ...extra, ts: Date.now() });
  };

  // ── Stage 1: DB file (5% of total) ──────────────────────────────────────
  if (fs.existsSync(dbPath)) {
    emit('Backing up database file…', { overallPct: 2, stageLabel: 'Stage 1 / 3' });
    await runRcloneWithProgress([
      '--config', rcloneConfigPath,
      '--stats', '1s', '--stats-one-line',
      'copy', dbPath, 'gdrive:backups/db'
    ], () => {
      emit('Backing up database file…', { overallPct: 4, stageLabel: 'Stage 1 / 3' });
    });
    emit('Database backed up ✓', { overallPct: 5, stageLabel: 'Stage 1 / 3' });
  }

  // ── Stage 2: Uploads folder (90% of total — the big one) ────────────────
  emit('Scanning uploads folder…', { overallPct: 6, stageLabel: 'Stage 2 / 3' });
  await runRcloneWithProgress([
    '--config', rcloneConfigPath,
    '--stats', '2s', '--stats-one-line',
    'copy', uploadsPath, 'gdrive:backups/uploads'
  ], (stats) => {
    // Map rclone 0-100% into overall 6-93%
    const scaledPct = 6 + Math.round((stats.percentage || 0) * 0.87);
    emit('Uploading installation photos…', {
      overallPct: scaledPct,
      stageLabel: 'Stage 2 / 3',
      processedFiles: stats.processedFiles,
      totalFiles: stats.totalFiles,
      uploadedBytes: stats.uploadedBytes,
      totalBytes: stats.totalBytes,
      uploadedBytesLabel: formatBytes(stats.uploadedBytes),
      totalBytesLabel: formatBytes(stats.totalBytes),
      speedLabel: formatBytes(stats.speedBytes) + '/s',
      etaSeconds: stats.etaSeconds,
      rclonePct: stats.percentage
    });
  });
  emit('Photos uploaded ✓', { overallPct: 94, stageLabel: 'Stage 2 / 3' });

  // ── Stage 3: JSON backups folder (5% of total) ───────────────────────────
  emit('Uploading JSON backups…', { overallPct: 95, stageLabel: 'Stage 3 / 3' });
  await runRcloneWithProgress([
    '--config', rcloneConfigPath,
    '--stats', '1s', '--stats-one-line',
    'copy', localBackupsPath, 'gdrive:backups/json'
  ], () => {
    emit('Uploading JSON backups…', { overallPct: 97, stageLabel: 'Stage 3 / 3' });
  });
  emit('JSON backups uploaded ✓', { overallPct: 99, stageLabel: 'Stage 3 / 3' });
}

// ─── Main performBackup ───────────────────────────────────────────────────────
async function performBackup(io) {
  console.log('Starting automated database backup...');

  const emit = (stage, extra = {}) => {
    if (!io) return;
    io.emit('backup_progress', { stage, ...extra, ts: Date.now() });
  };

  try {
    emit('Preparing backup data…', { overallPct: 0, stageLabel: 'Preparing' });

    // Export all data from DB
    const [orders, customers, items, users] = await Promise.all([
      prisma.order.findMany(),
      prisma.customer.findMany(),
      prisma.item.findMany(),
      prisma.user.findMany()
    ]);

    const backupData = { orders, customers, items, users };

    const now = new Date();
    const dateStr = String(now.getDate()).padStart(2, '0') + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    now.getFullYear();
    const fileName = `OceanSpas_Backup_${dateStr}.json`;
    const filePath = path.join(BACKUPS_DIR, fileName);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
    console.log(`Local backup saved: ${fileName}`);
    emit('Local JSON backup saved ✓', { overallPct: 1, stageLabel: 'Preparing' });

    // Run rclone with progress
    await runRcloneBackup(io);

    lastBackupTime = new Date().toISOString();

    // Cleanup old backups
    await deleteOldBackups();

    // Final complete event
    emit('Backup completed successfully!', {
      overallPct: 100,
      stageLabel: 'Complete',
      status: 'success',
      timestamp: lastBackupTime,
      totalRecords: orders.length + customers.length + items.length + users.length
    });

    return lastBackupTime;
  } catch (error) {
    console.error('Backup failed:', error);
    if (io) {
      io.emit('backup_progress', {
        stage: 'Backup failed',
        status: 'failed',
        error: error.message,
        overallPct: 0
      });
    }
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
          console.log(`Deleted old backup: ${file}`);
        }
      }
    }
  } catch (err) {
    console.error('Error cleaning old backups:', err);
  }
}

// Cron: daily at midnight (no Socket.IO for scheduled runs)
cron.schedule('0 0 * * *', () => {
  performBackup(null).catch(console.error);
});

module.exports = {
  performBackup,
  getLastBackupTime: () => lastBackupTime
};
