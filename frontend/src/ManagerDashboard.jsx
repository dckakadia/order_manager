import { useState, useEffect, useContext } from 'react';
import { DollarSign, Package, CheckCircle, Clock, Printer } from 'lucide-react';
import { SocketContext } from './App';

const API_BASE = 'http://116.74.77.22:3000';

export default function ManagerDashboard() {
  const [orders, setOrders] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [lastBackup, setLastBackup] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const socket = useContext(SocketContext);

  const role = localStorage.getItem('ocean_spas_role');
  const isAdmin = role === 'ADMIN';

  const fetchOrders = () => {
    fetch(`${API_BASE}/api/orders`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` }
    })
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(() => {});
  };

  const fetchBackupStatus = () => {
    if (!isAdmin) return;
    fetch(`${API_BASE}/api/backup/status`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.lastBackup) setLastBackup(data.lastBackup);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchOrders();
    fetchBackupStatus();
  }, []);

  // BUG FIX #9: Subscribe to Socket.IO events so dashboard updates in real-time
  useEffect(() => {
    if (!socket) return;

    socket.on('new_order', (newOrder) => {
      setOrders(prev => [newOrder, ...prev]);
    });

    socket.on('order_status_updated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    socket.on('bulk_orders_imported', () => {
      fetchOrders();
    });

    return () => {
      socket.off('new_order');
      socket.off('order_status_updated');
      socket.off('bulk_orders_imported');
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

  const handleExportJson = () => {
    const dataStr = JSON.stringify(orders, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders_export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) {
          const res = await fetch(`${API_BASE}/api/orders/bulk`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` 
            },
            body: JSON.stringify(importedData)
          });
          if (res.ok) {
            alert('Import successful!');
            fetchOrders();
          } else {
            alert('Import failed.');
          }
        }
      } catch (err) {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBackup = async () => {
    if (!isAdmin) return;
    setIsBackingUp(true);
    try {
      const res = await fetch(`${API_BASE}/api/backup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ocean_spas_auth_token')}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert('Backup successfully uploaded to Google Drive!');
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
            <button onClick={() => window.print()} className="btn btn-primary" style={{ minHeight: '36px', padding: '0.5rem 1rem' }}>
              <Printer size={16} /> Print / PDF
            </button>
            <button onClick={handleExportJson} className="btn btn-secondary" style={{ minHeight: '36px', padding: '0.5rem 1rem' }}>
              Export JSON
            </button>
            <label className="btn btn-secondary" style={{ minHeight: '36px', padding: '0.5rem 1rem', cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center' }}>
              Import JSON
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJson} />
            </label>
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '8px' }}>
                <button onClick={handleBackup} disabled={isBackingUp} className="btn btn-primary" style={{ minHeight: '36px', padding: '0.5rem 1rem', background: 'var(--success)', border: 'none' }}>
                  {isBackingUp ? 'Backing up...' : 'Backup to Drive'}
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
                <th>Order By</th>
                <th>Total Price (₹)</th>
                <th>Committed Delivery Date</th>
                <th>Actual Delivered Date & Time</th>
                <th>Status</th>
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
                  
                  return (
                    <tr key={order.id}>
                      <td>#{order.id}</td>
                      <td>{new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td>{order.customerName}</td>
                      <td>{order.baseModel}</td>
                      <td>{order.variant || '-'}</td>
                      <td>{order.faucetPosition || '-'}</td>
                      <td>{order.orderBy || '-'}</td>
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
                    </tr>
                  )
                })
              )}
            </tbody>
            {filteredTableOrders.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                  <td colSpan="7" style={{ textAlign: 'right', borderTop: '2px solid var(--border)' }}>Grand Total:</td>
                  <td colSpan="4" style={{ borderTop: '2px solid var(--border)', color: 'var(--primary)' }}>₹{tableTotalRevenue.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
}
