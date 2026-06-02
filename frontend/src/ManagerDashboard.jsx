import { useState, useEffect, useContext } from 'react';
import { DollarSign, Package, CheckCircle, Clock, Printer, History, X } from 'lucide-react';
import { SocketContext } from './App';
import config from './config';
import { apiFetch } from './apiUtils';
import { STORAGE_KEYS, ERROR_MESSAGES } from './constants';

export default function ManagerDashboard() {
  const [orders, setOrders] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [lastBackup, setLastBackup] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [historyModalOrder, setHistoryModalOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [error, setError] = useState('');
  const socket = useContext(SocketContext);

  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
  const isAdmin = role === 'ADMIN';

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/orders?limit=1000${showDeleted ? '&includeDeleted=true' : ''}`);
      if (!result.ok) {
        console.error('Failed to load orders:', result.error);
        setError('Unable to load orders. Please try again.');
        return;
      }
      const data = result.data;
      const ordersArray = Array.isArray(data) ? data : (data.data || []);
      setOrders(ordersArray);
      setError('');
    } catch (err) {
      console.error('Fetch orders error:', err);
      setError(ERROR_MESSAGES.NETWORK_ERROR);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const fetchBackupStatus = async () => {
    if (!isAdmin) return;
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/backup/status`);
      if (result.ok && result.data.lastBackup) {
        setLastBackup(result.data.lastBackup);
      }
    } catch (err) {
      console.error('Fetch backup status error:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchBackupStatus();
  }, [showDeleted]);

  // BUG FIX #9: Subscribe to Socket.IO events with proper cleanup
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (newOrder) => {
      setOrders(prev => [newOrder, ...prev]);
    };

    const handleOrderStatusUpdated = (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    };

    const handleBulkOrdersImported = () => {
      fetchOrders();
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_status_updated', handleOrderStatusUpdated);
    socket.on('bulk_orders_imported', handleBulkOrdersImported);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_updated', handleOrderStatusUpdated);
      socket.off('bulk_orders_imported', handleBulkOrdersImported);
    };
  }, [socket]);

  // BUG FIX #10: Use ₹ (Indian Rupee) instead of $ for currency
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
  const activeOrders = orders.filter(o => o.status !== 'Delivered').length;
  const completedOrders = orders.filter(o => o.status === 'Delivered').length;
  const totalOrders = orders.length;

  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  const filteredTableOrders = orders.filter(order => {
    if (!fromDate && !toDate) return true;
    const orderDate = new Date(order.createdAt);
    orderDate.setHours(0, 0, 0, 0);
    
    let match = true;
    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      if (orderDate < from) match = false;
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (orderDate > to) match = false;
    }
    return match;
  });

  const tableTotalRevenue = filteredTableOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);

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
      a.download = `OceanSpas_Full_Backup_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error exporting full backup.');
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "Order#", "Date & Time", "Customer", "Model", "Variant", 
      "Faucet Position", "Side Panel", "Order By", "Check-In Location", "Check-In Time", "Total Price", 
      "Committed Delivery Date", "Delivered Date & Time", "Status"
    ];
    
    const csvRows = [headers.join(',')];
    
    filteredTableOrders.forEach(order => {
      const row = [
        order.id,
        `"${new Date(order.createdAt).toLocaleString('en-IN')}"`,
        `"${order.customerName || ''}"`,
        `"${order.baseModel || ''}"`,
        `"${order.variant || 'None'}"`,
        `"${order.faucetPosition || 'None'}"`,
        `"${order.sidePanel || 'None'}"`,
        `"${order.orderBy || 'None'}"`,
        `"${(order.locationLat && order.locationLng) ? `https://maps.google.com/?q=${order.locationLat},${order.locationLng}` : 'None'}"`,
        `"${order.checkInTime ? new Date(order.checkInTime).toLocaleString('en-IN') : 'None'}"`,
        order.totalPrice || 0,
        order.deliveryDate ? `"${new Date(order.deliveryDate).toLocaleDateString('en-IN')}"` : '"Not Set"',
        order.status === 'Delivered' ? `"${new Date(order.updatedAt).toLocaleString('en-IN')}"` : '"N/A"',
        `"${order.status}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvStr = csvRows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders_report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    try {
      const res = await apiFetch(`${config.api.baseURL}/api/backup`, {
        method: 'POST'
      });
      const data = res.data || {};
      if (res.ok) {
        alert('Local backup generated successfully on the server!');
        setLastBackup(data.timestamp);
      } else {
        alert('Backup failed: ' + data.error);
      }
    } catch (err) {
      alert('Backup failed.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const openHistoryModal = async (orderId) => {
    setHistoryModalOrder(orderId);
    setOrderHistory([]);
    setIsLoadingHistory(true);
    try {
      const res = await apiFetch(`${config.api.baseURL}/api/orders/${orderId}/history`);
      const data = res.data || {};
      if (res.ok) setOrderHistory(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div className="grid-1" style={{ gap: '2rem' }}>

      {/* Top Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: '#3b82f6' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.875rem' }}>Total Revenue</p>
            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem' }}>₹{totalRevenue.toLocaleString('en-IN')}</h3>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.875rem' }}>Active Pipeline</p>
            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem' }}>{activeOrders} Orders</h3>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.875rem' }}>Completed</p>
            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem' }}>{completedOrders} Orders</h3>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', color: '#8b5cf6' }}>
            <Package size={24} />
          </div>
          <div>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.875rem' }}>Total Orders</p>
            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem' }}>{totalOrders}</h3>
          </div>
        </div>

      </div>

      {/* Pipeline Breakdown */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={20} /> Production Pipeline Breakdown
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 500 }}>{status}</span>
              <span className="badge badge-secondary" style={{ fontSize: '1rem', padding: '0.25rem 0.75rem' }}>{count}</span>
            </div>
          ))}
          {Object.keys(statusCounts).length === 0 && (
            <p style={{ color: 'var(--text-light)' }}>No orders in pipeline yet.</p>
          )}
        </div>
    </div>

      {/* Accountant Order Table Section */}
      <div className="glass-card accountant-print-section" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: 0 }}>Order History</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>From:</label>
              <input type="date" className="form-control" style={{ minHeight: '36px', padding: '0.5rem' }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>To:</label>
              <input type="date" className="form-control" style={{ minHeight: '36px', padding: '0.5rem' }} value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            {isAdmin && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>
                <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
                Show Deleted
              </label>
            )}
            <button onClick={() => window.print()} className="btn btn-primary" style={{ minHeight: '36px', padding: '0.5rem 1rem' }}>
              <Printer size={16} /> Print / PDF
            </button>
            <button onClick={handleExportCsv} className="btn btn-secondary" style={{ minHeight: '36px', padding: '0.5rem 1rem', background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>
              Export Excel / CSV
            </button>
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '8px' }}>
                <button onClick={handleExportJson} className="btn btn-secondary" style={{ minHeight: '36px', padding: '0.5rem 1rem' }}>
                  Export Full Backup
                </button>
                <label className="btn btn-secondary" style={{ minHeight: '36px', padding: '0.5rem 1rem', cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center' }}>
                  Restore from Backup
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJson} />
                </label>
                <button onClick={handleBackup} disabled={isBackingUp} className="btn btn-success" style={{ minHeight: '36px', padding: '0.5rem 1rem', border: 'none' }}>
                  {isBackingUp ? 'Backing up...' : 'Run Local Backup'}
                </button>
                {lastBackup && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    Last Backup: {new Date(lastBackup).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Hidden print header */}
        <h1 className="print-only-header" style={{ display: 'none', textAlign: 'center', marginBottom: '20px' }}>Ocean Spas - Order Report</h1>

        <div className="table-container accountant-table-wrapper">
          <table className="accountant-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Order Date & Time</th>
                <th>Customer Name</th>
                <th>Model Name</th>
                <th>Variant</th>
                <th>Faucet Position</th>
                <th>Side Panel</th>
                <th>Order By</th>
                <th>Check-In</th>
                <th>Total Price (₹)</th>
                <th>Committed Delivery Date</th>
                <th>Actual Delivered Date & Time</th>
                <th>Status</th>
                <th className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTableOrders.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                    No orders found for this date range.
                  </td>
                </tr>
              ) : (
                filteredTableOrders.map(order => {
                  let actualDelivered = '-';
                  if (order.status === 'Delivered') {
                    const d = new Date(order.updatedAt);
                    actualDelivered = `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}`;
                  }

                  const geoAttachment = order.attachments?.find(a => a.photoLat && a.photoLng);
                  const displayCheckIn = order.checkInTime || geoAttachment?.createdAt;
                  const displayLat = order.locationLat || geoAttachment?.photoLat;
                  const displayLng = order.locationLng || geoAttachment?.photoLng;
                  
                  return (
                    <tr key={order.id}>
                      <td>#{order.id}</td>
                      <td>{new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td>{order.customerName}</td>
                      <td>{order.baseModel}</td>
                      <td>{order.variant || '-'}</td>
                      <td>{order.faucetPosition || '-'}</td>
                      <td>{order.sidePanel || '-'}</td>
                      <td>{order.orderBy || '-'}</td>
                      <td style={{ fontSize: '11px', lineHeight: '1.2' }}>
                        {displayCheckIn && <div style={{ marginBottom: '2px' }}>{new Date(displayCheckIn).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>}
                        {displayLat && displayLng && <a href={`https://maps.google.com/?q=${displayLat},${displayLng}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Map</a>}
                        {(!displayCheckIn && !displayLat) && '-'}
                      </td>
                      <td style={{ fontWeight: 500 }}>₹{order.totalPrice?.toLocaleString('en-IN') || 0}</td>
                      <td>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN') : '-'}</td>
                      <td>{actualDelivered}</td>
                      <td><span className={`badge ${
                        order.status === 'Order Form Received' ? 'badge-received' :
                        order.status === 'Start Production' ? 'badge-start' :
                        order.status === 'Finish Production' ? 'badge-finish' :
                        order.status === 'Order Ready For Dispatch' ? 'badge-ready' :
                        order.status === 'Order Dispatched' ? 'badge-dispatched' :
                        order.status === 'Delivered' ? 'badge-delivered' : ''
                      }`}>{order.status}</span></td>
                      <td className="no-print">
                        <button onClick={() => openHistoryModal(order.id)} className="btn btn-secondary" style={{ padding: '0.4rem', fontSize: '12px' }}>
                          <History size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {filteredTableOrders.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                  <td colSpan="9" style={{ textAlign: 'right', borderTop: '2px solid var(--border)' }}>Grand Total:</td>
                  <td colSpan="4" style={{ borderTop: '2px solid var(--border)', color: 'var(--primary)' }}>₹{tableTotalRevenue.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {historyModalOrder && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', background: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Timeline: Order #{historyModalOrder}</h3>
              <button onClick={() => setHistoryModalOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            {isLoadingHistory ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading timeline...</div>
            ) : orderHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>No history found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
                {orderHistory.map((item, index) => (
                  <div key={item.id} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary)', marginTop: '4px' }}></div>
                      {index !== orderHistory.length - 1 && <div style={{ width: '2px', background: 'var(--border)', flex: 1, marginTop: '4px', marginBottom: '-1rem' }}></div>}
                    </div>
                    <div style={{ flex: 1, paddingBottom: '1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>
                        {new Date(item.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                        {item.previousStatus ? (
                          <>
                            <span style={{ color: 'var(--text-light)', textDecoration: 'line-through' }}>{item.previousStatus}</span>
                            {' → '}
                            <span style={{ color: 'var(--primary)' }}>{item.newStatus}</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--success)' }}>Created: {item.newStatus}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '4px' }}>
                        By: <strong>{item.user ? item.user.username : 'System/Unknown'}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
