import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Package, RefreshCw } from 'lucide-react';
import { SocketContext } from './App';
import config from './config';
import { apiFetch } from './apiUtils';
import { STORAGE_KEYS } from './constants';

const timeAgo = (dateStr) => {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const socket = useContext(SocketContext);
  const navigate = useNavigate();
  const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/notifications`);
      if (result.ok) {
        setNotifications(result.data.data || []);
        setUnreadCount(result.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  // Broadcast-and-filter, same pattern as new_order/order_status_updated elsewhere in the
  // app — there's no per-user socket room, so every client gets the event and checks
  // whether it's one of the intended recipients before refetching its own list.
  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      if (payload.userIds?.includes(Number(userId))) {
        fetchNotifications();
      }
    };
    socket.on('notification_created', handler);
    return () => socket.off('notification_created', handler);
  }, [socket, userId]);

  const openPanel = async () => {
    setIsOpen(true);
    if (unreadCount > 0) {
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      try {
        await apiFetch(`${config.api.baseURL}/api/notifications/read-all`, { method: 'PUT' });
      } catch (err) {
        console.error('Mark all notifications read error:', err);
      }
    }
  };

  const handleItemClick = (notification) => {
    setIsOpen(false);
    if (notification.orderId) {
      navigate(`/status?orderId=${notification.orderId}`);
    }
  };

  return (
    <>
      <button
        onClick={openPanel}
        aria-label="Notifications"
        style={{
          position: 'relative', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          color: 'white', width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: 'white',
            fontSize: '10px', fontWeight: 700, minWidth: '17px', height: '17px', borderRadius: '9px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            border: '2px solid var(--primary)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="no-print"
          onClick={() => setIsOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '16px' }}
        >
          <div
            className="glass-card"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '420px', background: '#fff', maxHeight: '80vh', overflowY: 'auto', marginTop: '64px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Notifications</h3>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>Loading…</div>
            ) : notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>No notifications yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    style={{
                      display: 'flex', gap: '0.75rem', textAlign: 'left', width: '100%', cursor: 'pointer',
                      padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)',
                      background: n.isRead ? '#fff' : '#eff6ff'
                    }}
                  >
                    <div style={{ flexShrink: 0, color: n.type === 'new_order' ? '#3b82f6' : '#8b5cf6', marginTop: '2px' }}>
                      {n.type === 'new_order' ? <Package size={18} /> : <RefreshCw size={18} />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{n.title}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>{n.body}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{timeAgo(n.createdAt)}</div>
                    </div>
                    {!n.isRead && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: '6px' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
