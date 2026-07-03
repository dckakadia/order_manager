const PAGES = ['sales', 'customers', 'status', 'delivered', 'report', 'dashboard', 'items'];

// Reproduces today's de-facto role behavior. 'users' is intentionally never included —
// access to user management is hardcoded ADMIN-only, not part of the per-page system.
const TEMPLATES = {
  ADMIN: {
    sales:      { canView: true, canEdit: true, canDelete: true },
    customers:  { canView: true, canEdit: true, canDelete: true },
    status:     { canView: true, canEdit: true, canDelete: true },
    delivered:  { canView: true, canEdit: true, canDelete: true },
    report:     { canView: true, canEdit: false, canDelete: false },
    dashboard:  { canView: true, canEdit: true, canDelete: false },
    items:      { canView: true, canEdit: true, canDelete: true }
  },
  MANAGER: {
    sales:      { canView: false, canEdit: false, canDelete: false },
    customers:  { canView: false, canEdit: false, canDelete: false },
    status:     { canView: true, canEdit: true, canDelete: false },
    delivered:  { canView: true, canEdit: true, canDelete: false },
    report:     { canView: true, canEdit: false, canDelete: false },
    dashboard:  { canView: true, canEdit: false, canDelete: false },
    items:      { canView: false, canEdit: false, canDelete: false }
  },
  SALES: {
    sales:      { canView: true, canEdit: true, canDelete: false },
    customers:  { canView: true, canEdit: true, canDelete: false },
    status:     { canView: true, canEdit: true, canDelete: false },
    delivered:  { canView: true, canEdit: true, canDelete: false },
    report:     { canView: false, canEdit: false, canDelete: false },
    dashboard:  { canView: false, canEdit: false, canDelete: false },
    items:      { canView: false, canEdit: false, canDelete: false }
  }
};

function getDefaultPermissions(role) {
  const template = TEMPLATES[role];
  if (!template) throw new Error(`Unknown role: ${role}`);
  return PAGES.map(page => ({ page, ...template[page] }));
}

module.exports = { PAGES, getDefaultPermissions };
