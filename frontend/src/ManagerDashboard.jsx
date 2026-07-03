import { useState, useEffect, useContext } from 'react';
import { X, CheckCircle2, AlertCircle, RefreshCw, Settings } from 'lucide-react';
import { SocketContext } from './App';
import config from './config';
import { apiFetch } from './apiUtils';
import { STORAGE_KEYS } from './constants';
import UserManagement from './UserManagement';

export default function ManagerDashboard() {
  const [lastBackup, setLastBackup] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(null); // null | { stage, overallPct, ... }
  const socket = useContext(SocketContext);

  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  const isAdmin = role === 'ADMIN';

  const fetchBackupStatus = async () => {
    if (!isAdmin) return;
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/backup/status`);
      if (result.ok) {
        const d = result.data;
        // Support both old (lastBackup) and new (lastTimestamp) response shapes
        const ts = d.lastTimestamp || d.lastBackup;
        if (ts) setLastBackup(ts);
      }
    } catch (err) {
      console.error('Fetch backup status error:', err);
    }
  };

  useEffect(() => {
    fetchBackupStatus();
  }, []);

  // ─── Socket.IO listener for real-time backup progress ───────────────────────
  useEffect(() => {
    if (!socket || !isAdmin) return;
    const handler = (data) => {
      setBackupProgress(data);
      if (data.status === 'success') {
        setIsBackingUp(false);
        if (data.timestamp) setLastBackup(data.timestamp);
      } else if (data.status === 'failed') {
        setIsBackingUp(false);
      }
    };
    socket.on('backup_progress', handler);
    return () => socket.off('backup_progress', handler);
  }, [socket, isAdmin]);

  const handleExportJson = async () => {
    try {
      const res = await apiFetch(`${config.api.baseURL}/api/backup/download`);
      if (!res.ok) throw new Error('Failed to download full backup');
      const data = res.data;

      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MivoxSpas_Full_Backup_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error exporting full backup.');
    }
  };

  const handleImportJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm("This will overwrite ALL data. A backup will be taken first. Are you sure?")) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        const res = await apiFetch(`${config.api.baseURL}/api/backup/restore`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(importedData)
        });
        const responseData = res.data || {};
        if (res.ok) {
          alert('Full database restored successfully!');
          window.location.reload(); // Reload to refresh all state
        } else {
          alert('Restore failed: ' + responseData.error);
        }
      } catch (err) {
        alert('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBackup = async () => {
    if (!isAdmin) return;
    setIsBackingUp(true);
    setBackupProgress({ stage: 'Starting…', overallPct: 0, stageLabel: 'Preparing' });
    try {
      const res = await apiFetch(`${config.api.baseURL}/api/backup`, { method: 'POST' });
      if (!res.ok) {
        setIsBackingUp(false);
        setBackupProgress({ status: 'failed', error: res.data?.error || 'Failed to start backup.' });
      }
      // Progress will now come via Socket.IO backup_progress events
    } catch (err) {
      setIsBackingUp(false);
      setBackupProgress({ status: 'failed', error: 'Network error. Could not start backup.' });
    }
  };

  const handleDismissBackup = () => {
    setBackupProgress(null);
    setIsBackingUp(false);
  };

  return (
    <div className="grid-1" style={{ gap: '2rem' }}>

      {/* Settings Card */}
      {isAdmin && (
        <div className="glass-card no-print" style={{ marginTop: '1rem' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={20} /> Settings
          </h2>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <button onClick={handleExportJson} className="btn btn-secondary" style={{ minHeight: '44px', padding: '0.6rem 1rem', width: '100%' }}>
                Export Full Backup
              </button>
              <label className="btn btn-secondary" style={{ minHeight: '44px', padding: '0.6rem 1rem', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                Restore from Backup
                <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJson} />
              </label>
              <button onClick={handleBackup} disabled={isBackingUp} className="btn btn-success" style={{ minHeight: '44px', padding: '0.6rem 1rem', border: 'none', width: '100%' }}>
                {isBackingUp ? 'Backing up…' : 'Run GDrive Backup'}
              </button>
            </div>
            {lastBackup && !isBackingUp && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-light)' }}>
                Last: {new Date(lastBackup).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            )}
          </div>

          {/* ─── Real-time Backup Progress Panel ─── */}
          {backupProgress && (
            <div className="no-print" style={{
              margin: '1rem 0 0',
              borderRadius: '12px',
              overflow: 'hidden',
              border: backupProgress.status === 'success'
                ? '1px solid #6ee7b7'
                : backupProgress.status === 'failed'
                  ? '1px solid #fca5a5'
                  : '1px solid rgba(99,102,241,0.3)',
              background: backupProgress.status === 'success'
                ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                : backupProgress.status === 'failed'
                  ? 'linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%)'
                  : 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)'
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px',
                background: backupProgress.status === 'success'
                  ? 'rgba(16,185,129,0.1)'
                  : backupProgress.status === 'failed'
                    ? 'rgba(239,68,68,0.1)'
                    : 'rgba(255,255,255,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {backupProgress.status === 'success' ? (
                    <CheckCircle2 size={18} color="#10b981" />
                  ) : backupProgress.status === 'failed' ? (
                    <AlertCircle size={18} color="#ef4444" />
                  ) : (
                    <RefreshCw size={16} color="#a5b4fc" style={{ animation: 'spin 2s linear infinite' }} />
                  )}
                  <span style={{
                    fontWeight: '700', fontSize: '13px',
                    color: backupProgress.status === 'success' ? '#065f46'
                      : backupProgress.status === 'failed' ? '#991b1b'
                      : '#e0e7ff'
                  }}>
                    {backupProgress.status === 'success' ? '✅ Google Drive Backup Complete'
                      : backupProgress.status === 'failed' ? '❌ Backup Failed'
                      : '☁️ Backing Up to Google Drive'}
                  </span>
                  {backupProgress.stageLabel && backupProgress.status !== 'success' && backupProgress.status !== 'failed' && (
                    <span style={{ fontSize: '11px', color: '#a5b4fc', background: 'rgba(165,180,252,0.15)', padding: '2px 8px', borderRadius: '99px' }}>
                      {backupProgress.stageLabel}
                    </span>
                  )}
                </div>
                {(backupProgress.status === 'success' || backupProgress.status === 'failed') && (
                  <button onClick={handleDismissBackup} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}>
                    <X size={16} />
                  </button>
                )}
              </div>

              <div style={{ padding: '12px 16px' }}>
                {/* Success state */}
                {backupProgress.status === 'success' && (
                  <div style={{ color: '#065f46', fontSize: '13px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    <span>✓ All files uploaded to Google Drive</span>
                    {backupProgress.totalRecords != null && (
                      <span>📋 {backupProgress.totalRecords.toLocaleString()} records backed up</span>
                    )}
                    {backupProgress.timestamp && (
                      <span>🕐 {new Date(backupProgress.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    )}
                  </div>
                )}

                {/* Failure state */}
                {backupProgress.status === 'failed' && (
                  <div>
                    <div style={{ color: '#7f1d1d', fontSize: '13px', marginBottom: '10px' }}>
                      {backupProgress.error || 'An unknown error occurred during backup.'}
                    </div>
                    <button
                      onClick={handleBackup}
                      style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      ↻ Retry Backup
                    </button>
                  </div>
                )}

                {/* In-progress state */}
                {backupProgress.status !== 'success' && backupProgress.status !== 'failed' && (
                  <>
                    {/* Stage label */}
                    <div style={{ fontSize: '12px', color: '#c7d2fe', marginBottom: '8px', fontWeight: '500' }}>
                      {backupProgress.stage || 'Initializing…'}
                    </div>

                    {/* Progress bar */}
                    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '99px', height: '10px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{
                        height: '100%',
                        width: `${backupProgress.overallPct || 0}%`,
                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
                        borderRadius: '99px',
                        transition: 'width 0.6s ease',
                        boxShadow: '0 0 8px rgba(139,92,246,0.6)'
                      }} />
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: '#a5b4fc' }}>
                      <span style={{ fontWeight: '700', color: '#c7d2fe', fontSize: '15px' }}>
                        {backupProgress.overallPct || 0}%
                      </span>
                      {backupProgress.totalFiles != null && (
                        <span>📁 Files: <b style={{ color: '#e0e7ff' }}>{(backupProgress.processedFiles || 0).toLocaleString()} / {backupProgress.totalFiles.toLocaleString()}</b></span>
                      )}
                      {backupProgress.totalBytesLabel && (
                        <span>💾 Size: <b style={{ color: '#e0e7ff' }}>{backupProgress.uploadedBytesLabel} / {backupProgress.totalBytesLabel}</b></span>
                      )}
                      {backupProgress.speedLabel && backupProgress.speedLabel !== 'undefined/s' && (
                        <span>⚡ Speed: <b style={{ color: '#e0e7ff' }}>{backupProgress.speedLabel}</b></span>
                      )}
                      {backupProgress.etaSeconds != null && (
                        <span>⏱ ETA: <b style={{ color: '#e0e7ff' }}>
                          {backupProgress.etaSeconds >= 3600
                            ? `${Math.floor(backupProgress.etaSeconds / 3600)}h ${Math.floor((backupProgress.etaSeconds % 3600) / 60)}m`
                            : backupProgress.etaSeconds >= 60
                              ? `${Math.floor(backupProgress.etaSeconds / 60)}m ${backupProgress.etaSeconds % 60}s`
                              : `${backupProgress.etaSeconds}s`}
                        </b></span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Management */}
      {isAdmin && (
        <div style={{ marginTop: '1rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>User Management</h2>
          <UserManagement />
        </div>
      )}

    </div>
  );
}
