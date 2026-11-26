export type NotificationPermissionStatus = 'granted' | 'denied' | 'not-determined' | 'not-supported';

export interface LocalNotification {
  id: number; // Required for Capacitor, can be derived from timestamp or counter
  title: string;
  body: string;
  icon?: string; // Optional icon URL (mostly for web/electron)
  url?: string; // Optional URL to open on click
}
