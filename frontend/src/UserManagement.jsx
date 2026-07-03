import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, RotateCcw } from 'lucide-react';
import config from './config';
import { apiFetch } from './apiUtils';
import { PAGES, ERROR_MESSAGES } from './constants';

// Roles are stored/compared as uppercase (ADMIN/MANAGER/SALES) everywhere in the app —
// this only affects how the role is displayed to the user.
const formatRole = (role) => role ? role.charAt(0) + role.slice(1).toLowerCase() : role;

// Labels match the current bottom-nav wording exactly. 'customers' and 'items' stay
// separate permission keys (independent view/edit/delete) even though both now live
// under the single "Master" nav tab, so they're labeled as Master's two sub-sections.
const PAGE_LABELS = {
  sales: 'New Order',
  customers: 'Master — Customers',
  status: 'Live Orders',
  delivered: 'Delivered',
  report: 'Report',
  dashboard: 'Admin',
  items: 'Master — Items'
};

// Mirrors backend/services/permissionDefaults.js — used only to preview/reset the grid
// client-side before saving; the backend is the source of truth on create.
const ROLE_DEFAULTS = {
  ADMIN: {
    sales: { canView: true, canEdit: true, canDelete: true },
    customers: { canView: true, canEdit: true, canDelete: true },
    status: { canView: true, canEdit: true, canDelete: true },
    delivered: { canView: true, canEdit: true, canDelete: true },
    report: { canView: true, canEdit: false, canDelete: false },
    dashboard: { canView: true, canEdit: true, canDelete: false },
    items: { canView: true, canEdit: true, canDelete: true }
  },
  MANAGER: {
    sales: { canView: false, canEdit: false, canDelete: false },
    customers: { canView: false, canEdit: false, canDelete: false },
    status: { canView: true, canEdit: true, canDelete: false },
    delivered: { canView: true, canEdit: true, canDelete: false },
    report: { canView: true, canEdit: false, canDelete: false },
    dashboard: { canView: true, canEdit: false, canDelete: false },
    items: { canView: false, canEdit: false, canDelete: false }
  },
  SALES: {
    sales: { canView: true, canEdit: true, canDelete: false },
    customers: { canView: true, canEdit: true, canDelete: false },
    status: { canView: true, canEdit: true, canDelete: false },
    delivered: { canView: true, canEdit: true, canDelete: false },
    report: { canView: false, canEdit: false, canDelete: false },
    dashboard: { canView: false, canEdit: false, canDelete: false },
    items: { canView: false, canEdit: false, canDelete: false }
  }
};

const buildGridFromDefaults = (role) => PAGES.map(page => ({ page, ...ROLE_DEFAULTS[role][page] }));

const buildGridFromUser = (user) => PAGES.map(page => {
  const row = user.pagePermissions?.find(p => p.page === page);
  return row
    ? { page, canView: row.canView, canEdit: row.canEdit, canDelete: row.canDelete }
    : { page, canView: false, canEdit: false, canDelete: false };
});

const emptyForm = { username: '', pin: '', role: 'SALES', isActive: true };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [permissionGrid, setPermissionGrid] = useState(buildGridFromDefaults('SALES'));
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/users`);
      if (!result.ok) {
        setError(result.error || 'Unable to load users. Please try again.');
        setUsers([]);
        return;
      }
      const data = result.data;
      setUsers(Array.isArray(data) ? data : (data.data || []));
      setError('');
    } catch (err) {
      console.error('Fetch users error:', err);
      setError(ERROR_MESSAGES.NETWORK_ERROR);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const resetForm = () => {
    setFormData(emptyForm);
    setPermissionGrid(buildGridFromDefaults('SALES'));
    setEditingId(null);
  };

  const handleRoleChange = (role) => {
    setFormData({ ...formData, role });
    if (!editingId) {
      // On create, the grid is just a preview — the backend applies the real defaults.
      setPermissionGrid(buildGridFromDefaults(role));
    }
  };

  const handleResetToDefaults = () => {
    setPermissionGrid(buildGridFromDefaults(formData.role));
  };

  const togglePermission = (page, field) => {
    setPermissionGrid(prev => prev.map(row =>
      row.page === page ? { ...row, [field]: !row[field] } : row
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { username: formData.username, role: formData.role };
      if (formData.pin) payload.pin = formData.pin;

      let url = `${config.api.baseURL}/api/users`;
      let method = 'POST';
      if (editingId) {
        url = `${config.api.baseURL}/api/users/${editingId}`;
        method = 'PUT';
        payload.isActive = formData.isActive;
        payload.permissions = permissionGrid;
      }

      const result = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!result.ok) {
        setError(result.error || (editingId ? 'Failed to update user' : 'Failed to create user'));
        return;
      }

      setSuccessMsg(editingId ? 'User updated successfully!' : 'User created successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      resetForm();
      fetchUsers();
    } catch (err) {
      console.error('Save user error:', err);
      setError(editingId ? 'Failed to update user. Please try again.' : 'Failed to create user. Please try again.');
    }
  };

  const handleEditClick = (user) => {
    setFormData({ username: user.username, pin: '', role: user.role, isActive: user.isActive });
    setPermissionGrid(buildGridFromUser(user));
    setEditingId(user.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this user?')) return;
    try {
      const result = await apiFetch(`${config.api.baseURL}/api/users/${id}`, { method: 'DELETE' });
      if (!result.ok) {
        throw new Error(result.error || 'Delete failed');
      }
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  return (
    <div className="grid-2">
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>{editingId ? 'Edit User' : 'Add New User'}</h2>
          {editingId && (
            <button onClick={resetForm} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', minHeight: 'auto' }}>
              <X size={16} /> Cancel
            </button>
          )}
        </div>
        {error && <div className="badge badge-start" style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}>{error}</div>}
        {successMsg && <div className="badge badge-delivered" style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem' }}>{successMsg}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label required">Username</label>
            <input type="text" className="form-control" required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{editingId ? 'PIN (leave blank to keep current)' : 'PIN'}</label>
            <input type="password" inputMode="numeric" className="form-control" required={!editingId} value={formData.pin} onChange={e => setFormData({ ...formData, pin: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label required">Role</label>
            <select className="form-control" value={formData.role} onChange={e => handleRoleChange(e.target.value)}>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="SALES">Sales</option>
            </select>
          </div>
          {editingId && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
                Active
              </label>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', margin: '1rem 0 0.5rem' }}>
            <label className="form-label" style={{ margin: 0 }}>
              Page Permissions {!editingId && '(preview — applied on create)'}
            </label>
            <button type="button" onClick={handleResetToDefaults} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '12px', minHeight: 'auto', whiteSpace: 'nowrap' }}>
              <RotateCcw size={14} /> Reset to role defaults
            </button>
          </div>
          <div className="table-container" style={{ marginBottom: '1rem' }}>
            <table className="permission-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>View</th>
                  <th>Edit</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {permissionGrid.map(row => (
                  <tr key={row.page}>
                    <td>{PAGE_LABELS[row.page]}</td>
                    <td>
                      <label className="permission-cell">
                        <input type="checkbox" checked={row.canView} onChange={() => togglePermission(row.page, 'canView')} />
                      </label>
                    </td>
                    <td>
                      <label className="permission-cell">
                        <input type="checkbox" checked={row.canEdit} onChange={() => togglePermission(row.page, 'canEdit')} />
                      </label>
                    </td>
                    <td>
                      <label className="permission-cell">
                        <input type="checkbox" checked={row.canDelete} onChange={() => togglePermission(row.page, 'canDelete')} />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {editingId ? <><Edit2 size={18} /> Update User</> : <><Plus size={18} /> Create User</>}
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ maxHeight: '800px', overflowY: 'auto' }}>
        <h2>Users</h2>
        <div className="option-list">
          {users.map(user => (
            <div className="option-card" key={user.id}>
              <div className="option-card-main">
                <div className="option-name">{user.username}</div>
                <div className="option-price">
                  <span className="badge badge-secondary">{formatRole(user.role)}</span>{' '}
                  {!user.isActive && <span className="badge badge-start">Inactive</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button onClick={() => handleEditClick(user)} className="option-delete-btn" style={{ color: 'var(--primary)', background: '#eff6ff', borderColor: '#bfdbfe' }} aria-label="Edit">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => handleDelete(user.id)} className="option-delete-btn" aria-label="Delete">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && !isLoading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
              No users found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
