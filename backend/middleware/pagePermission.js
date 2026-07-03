const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FIELD_BY_LEVEL = {
  view: 'canView',
  edit: 'canEdit',
  delete: 'canDelete'
};

// pages: string or array of page keys — array means "any one qualifying page is enough".
// level: 'view' | 'edit' | 'delete'.
function requirePagePermission(pages, level) {
  const pageList = Array.isArray(pages) ? pages : [pages];
  const field = FIELD_BY_LEVEL[level];
  if (!field) throw new Error(`Invalid permission level: ${level}`);

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    if (req.user.role === 'ADMIN') {
      return next();
    }
    try {
      const match = await prisma.userPagePermission.findFirst({
        where: { userId: req.user.id, page: { in: pageList }, [field]: true }
      });
      if (!match) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
    }
  };
}

module.exports = { requirePagePermission };
