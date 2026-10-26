import type { LocalNotification } from './common';

// Define the dedicated Seedit IPC API exposed via preload
// Keep the existing electron definition if other parts of the app use it
declare global {
  interface Window {
    electron?: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      sendNotification?: (notification: Omit<LocalNotification, 'id'>) => void;
    };
    // window.electronApi is declared in src/globals.d.ts
    // Remove seeditIpc if no longer needed elsewhere
    // seeditIpc?: {
    //   send: (channel: string, ...args: any[]) => void;
    // };
  }
}

/**
 * Requests permission to display notifications in Electron.
 * Uses the new electronApi for clarity.
 */
export async function requestElectronNotificationPermission(): Promise<boolean> {
  // Just check if the API exists via preload.
  const supported = typeof window.electronApi?.getNotificationStatus === 'function';
  if (!supported) {
    console.warn('Electron API for notifications not available via preload.');
  }
  // No explicit permission needed from user in Electron, just API availability.
  return supported;
}

/**
 * Shows a local notification via Electron IPC using the exposed 'electron.invoke'.
 */
export async function showElectronLocalNotification(notification: Omit<LocalNotification, 'id'>): Promise<void> {
  // Try the high-level API
  if (typeof window.electronApi?.showNotification === 'function') {
    // @ts-ignore
    window.electronApi.showNotification(notification);
    return;
  }
  // Next, try the low-level send
  if (typeof window.electron?.sendNotification === 'function') {
    // @ts-ignore
    window.electron.sendNotification(notification);
    return;
  }
  // Finally, fallback to invoke
  if (typeof window.electron?.invoke === 'function') {
    try {
      await window.electron.invoke('show-notification', notification);
    } catch (err) {
      console.error('Error sending notification via Electron invoke:', err);
    }
    return;
  }
  console.error('No available IPC method to send Electron notification.');
}
