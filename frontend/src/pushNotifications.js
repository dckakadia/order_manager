import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import config from './config';
import { apiFetch } from './apiUtils';
import { STORAGE_KEYS } from './constants';

const isNativePlatform = Capacitor.isNativePlatform();

const getAuthHeaders = () => {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const sendTokenToBackend = async (token) => {
  localStorage.setItem(STORAGE_KEYS.DEVICE_PUSH_TOKEN, token);
  await apiFetch(`${config.api.baseURL}/api/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ token, platform: 'android' })
  });
};

export const initPushNotifications = async () => {
  if (!isNativePlatform) return;

  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;

    PushNotifications.addListener('registration', (token) => {
      sendTokenToBackend(token.value).catch(err => console.error('Failed to register device token:', err));
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const orderId = action.notification?.data?.orderId;
      if (orderId) {
        window.location.href = `/status?orderId=${orderId}`;
      }
    });

    await PushNotifications.register();
  } catch (err) {
    console.error('Failed to initialize push notifications:', err);
  }
};

export const cleanupPushNotifications = async () => {
  if (!isNativePlatform) return;

  const token = localStorage.getItem(STORAGE_KEYS.DEVICE_PUSH_TOKEN);
  if (token) {
    try {
      await apiFetch(`${config.api.baseURL}/api/devices/unregister`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ token })
      });
    } catch (err) {
      console.error('Failed to unregister device token:', err);
    }
    localStorage.removeItem(STORAGE_KEYS.DEVICE_PUSH_TOKEN);
  }

  await PushNotifications.removeAllListeners();
};
