const { PrismaClient } = require('@prisma/client');
const { buildNotification } = require('./pushService');

const prisma = new PrismaClient();

// Persists an in-app notification for every active user, including whoever caused the
// event — this is a *history*, so the acting user's own actions belong in their own
// log too, just without an unread badge for something they already know they just did.
// Broadcasts over Socket.IO to everyone else so open clients update their badge/list
// without polling. Independent of pushService's FCM delivery (which still excludes the
// actor, since a push is an interruption you don't need for your own action) — this is
// what backs the in-app history, so it works even for users without a registered device
// token or with push notifications denied.
async function recordOrderNotifications({ type, order, actingUserId, io }) {
  try {
    const allUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true }
    });
    if (!allUsers.length) return;

    const { title, body } = buildNotification(type, order);
    const createdAt = new Date();

    await prisma.notification.createMany({
      data: allUsers.map(u => ({
        userId: u.id,
        type,
        title,
        body,
        orderId: order.id,
        createdAt,
        isRead: u.id === actingUserId
      }))
    });

    const otherUserIds = allUsers.filter(u => u.id !== actingUserId).map(u => u.id);
    if (io && otherUserIds.length) {
      io.emit('notification_created', {
        userIds: otherUserIds,
        notification: { type, title, body, orderId: order.id, createdAt }
      });
    }
  } catch (error) {
    console.error('recordOrderNotifications failed:', error);
  }
}

async function getNotifications(userId, { limit = 50 } = {}) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    }),
    prisma.notification.count({ where: { userId, isRead: false } })
  ]);
  return { items, unreadCount };
}

async function markAllAsRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });
}

module.exports = {
  recordOrderNotifications,
  getNotifications,
  markAllAsRead
};
