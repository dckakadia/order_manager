const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

let messagingClient = null;
let initAttempted = false;

function ensureInitialized() {
  if (initAttempted) return messagingClient;
  initAttempted = true;

  const credPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!credPath) {
    console.warn('Push notifications disabled: FIREBASE_SERVICE_ACCOUNT_PATH not set in .env');
    return null;
  }

  const resolvedPath = path.isAbsolute(credPath) ? credPath : path.join(__dirname, '..', credPath);
  if (!fs.existsSync(resolvedPath)) {
    console.warn(`Push notifications disabled: service account file not found at ${resolvedPath}`);
    return null;
  }

  try {
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    const app = initializeApp({ credential: cert(require(resolvedPath)) });
    messagingClient = getMessaging(app);
    console.log('Push notifications enabled (Firebase Admin initialized)');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    messagingClient = null;
  }
  return messagingClient;
}

async function registerDeviceToken(userId, token, platform = 'android') {
  return prisma.deviceToken.upsert({
    where: { token },
    update: { userId, platform, updatedAt: new Date() },
    create: { userId, token, platform }
  });
}

async function unregisterDeviceToken(token) {
  await prisma.deviceToken.deleteMany({ where: { token } });
}

async function removeStaleTokens(tokens) {
  if (!tokens.length) return;
  await prisma.deviceToken.deleteMany({ where: { token: { in: tokens } } });
}

function buildNotification(type, order, actingUsername) {
  const actor = actingUsername || 'a user';
  if (type === 'new_order') {
    return {
      title: 'New Order',
      body: `${order.customerName || 'A customer'} — ${order.baseModel || 'New order'} created by ${actor}`
    };
  }
  return {
    title: 'Order Status Updated',
    body: `Order #${order.id} is now "${order.status}" — updated by ${actor}`
  };
}

// Sends a push notification to every registered device except the acting user's own.
async function sendOrderNotification({ type, order, actingUserId, actingUsername }) {
  try {
    const messaging = ensureInitialized();
    if (!messaging) return;

    const recipients = await prisma.deviceToken.findMany({
      where: { userId: { not: actingUserId } },
      select: { token: true }
    });
    if (!recipients.length) return;

    const tokens = recipients.map(r => r.token);
    const { title, body } = buildNotification(type, order, actingUsername);

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: {
        orderId: String(order.id),
        type,
        status: order.status || ''
      },
      android: { priority: 'high' }
    });

    const staleTokens = [];
    response.responses.forEach((result, i) => {
      if (!result.success) {
        const code = result.error?.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
          staleTokens.push(tokens[i]);
        }
      }
    });
    await removeStaleTokens(staleTokens);
  } catch (error) {
    console.error('sendOrderNotification failed:', error);
  }
}

module.exports = {
  registerDeviceToken,
  unregisterDeviceToken,
  sendOrderNotification,
  buildNotification
};
