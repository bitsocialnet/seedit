import { LocalNotifications } from '@capacitor/local-notifications';
import type { LocalNotification, NotificationPermissionStatus } from './common';
import type { PermissionState } from '@capacitor/core';

/**
 * Requests permission to display local notifications on native platforms.
 */
export async function requestNativeNotificationPermission(): Promise<boolean> {
  try {
    const result: { display: PermissionState } = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch (error) {
    console.error('Error requesting native notification permission:', error);
    return false;
  }
}

/**
 * Reads the current local notification permission on native platforms without prompting.
 */
export async function getNativeNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const { display }: { display: PermissionState } = await LocalNotifications.checkPermissions();
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  return 'not-determined';
}

/**
 * Schedules a local notification on native platforms.
 */
export async function showNativeLocalNotification(notification: LocalNotification): Promise<void> {
  try {
    console.log('[Native Push] showNativeLocalNotification called with', notification);
    // Check permission first (optional, but good practice)
    const permissionStatus: { display: PermissionState } = await LocalNotifications.checkPermissions();
    if (permissionStatus.display !== 'granted') {
      console.warn('Native notification permission not granted.');
      // Optionally re-request permission here if appropriate
      // const granted = await requestNativeNotificationPermission();
      // if (!granted) return;
      return;
    }

    const result = await LocalNotifications.schedule({
      notifications: [
        {
          id: notification.id,
          title: notification.title,
          body: notification.body,
          // Note: Native icons are handled differently (usually app icon)
          // schedule: { at: new Date(Date.now() + 1000) }, // Schedule immediately
          extra: { url: notification.url }, // Store URL in extra data
        },
      ],
    });
    console.log('[Native Push] LocalNotifications.schedule resolved with', result);

    // Add listener for when a notification action is performed (e.g., tapped)
    // Do this only once, perhaps in an initialization function
    // await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    //   const url = action.notification.extra?.url;
    //   if (url) {
    //     // Handle navigation, e.g., window.location.href = url;
    //     console.log('Notification clicked, navigate to:', url);
    //   }
    // });
  } catch (error) {
    console.error('Error scheduling native local notification:', error);
  }
}

// It's crucial to add listeners for notification actions (like clicks) only ONCE during app initialization.
// Consider creating an init function that sets up these listeners.
export async function initializeNativeNotificationListeners() {
  await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const url = action.notification.extra?.url;
    if (url && typeof url === 'string') {
      // Basic navigation. Implement more robust routing if needed.
      window.location.href = url;
      console.log('Native notification action performed, navigating to:', url);
    } else {
      console.log('Native notification action performed, no URL found.');
    }
  });
}
