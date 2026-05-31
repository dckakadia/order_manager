/**
 * Audit Logging Middleware
 * PHASE 3: Tracks all state-changing operations for security and compliance
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Wrap endpoints to log audit trail
const auditLog = async (userId, username, action, resource, resourceId, changes = null, status = 'success', errorMsg = null, req = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        username,
        action,
        resource,
        resourceId,
        changes: changes ? JSON.stringify(changes) : null,
        status,
        errorMsg,
        ipAddress: req ? req.ip || req.connection.remoteAddress : null,
        userAgent: req ? req.get('user-agent') : null
      }
    });
  } catch (error) {
    console.error('Failed to log audit trail:', error);
  }
};

// Middleware to attach audit logger to requests
const attachAuditLogger = (req, res, next) => {
  req.auditLog = (action, resource, resourceId, changes, status = 'success', errorMsg = null) => {
    return auditLog(
      req.user?.id,
      req.user?.username,
      action,
      resource,
      resourceId,
      changes,
      status,
      errorMsg,
      req
    );
  };
  next();
};

module.exports = {
  auditLog,
  attachAuditLogger
};
