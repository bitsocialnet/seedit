import type { LocalNotification, NotificationPermissionStatus } from './common';

/**
 * Requests permission to display notifications.
 * Must be called from a user interaction context (e.g., button click).
 */
export async function requestWebNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window) || !navigator.serviceWorker) {
    console.warn('Web Notifications or Service Worker not supported.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Reads the current notification permission without prompting.
 */
export function getWebNotificationPermissionStatus(): NotificationPermissionStatus {
  if (!('Notification' in window) || !navigator.serviceWorker) return 'not-supported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'not-determined';
}

/**
 * Shows a local notification via the Service Worker.
 */
export async function showWebLocalNotification(notification: Omit<LocalNotification, 'id'>): Promise<void> {
  if (!navigator.serviceWorker) {
    console.warn('Service Worker not available to show notification.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) {
      console.warn('No active Service Worker registration found.');
      return;
    }

    // Send message to the service worker
    registration.active.postMessage({
      type: 'SHOW_NOTIFICATION',
      payload: notification,
    });
  } catch (error) {
    console.error('Error sending notification message to Service Worker:', error);
  }
}
