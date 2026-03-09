import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useNotifications } from '@bitsocialnet/bitsocial-react-hooks';
import localForageLru from '@bitsocialnet/bitsocial-react-hooks/dist/lib/localforage-lru/index.js';
import useContentOptionsStore from '../../stores/use-content-options-store';
import { showLocalNotification } from '../../lib/push';

// Create LRU storage instance for tracking sent notifications
const sentNotificationsDb = localForageLru.createInstance({ name: 'seeditSentNotifications', size: 1000 });

const getSentNotificationStatus = async (timestamp: number): Promise<boolean> => {
  const sent = await sentNotificationsDb.getItem(timestamp.toString());
  return sent === true;
};

const setSentNotificationStatus = async (timestamp: number): Promise<void> => {
  await sentNotificationsDb.setItem(timestamp.toString(), true);
};

/**
 * This component handles listening for new notifications from the useNotifications hook
 * and triggering the platform-specific local notification display.
 * It doesn't render anything itself, but runs its logic via useEffect.
 */
const NotificationHandler = () => {
  const { enableLocalNotifications } = useContentOptionsStore();
  const { notifications } = useNotifications();

  const location = useLocation();
  const previousNotificationsRef = useRef(notifications);

  useEffect(() => {
    // Only proceed if notifications are enabled in settings
    if (!enableLocalNotifications) {
      return;
    }

    // Check for new notifications compared to the previous state
    const previousCids = new Set(previousNotificationsRef.current?.map((n) => n.cid) || []);
    const newNotifications = notifications?.filter((n) => !previousCids.has(n.cid)) || [];

    newNotifications.forEach(async (notification) => {
      if (location.pathname.startsWith('/inbox')) {
        return;
      }

      const alreadySent = await getSentNotificationStatus(notification.timestamp);
      if (alreadySent) {
        return;
      }

      // useNotifications only supports replies at the moment
      const payload = {
        id: notification.timestamp,
        icon: '/icon.png',
        title: `You received a reply`,
        body: `u/${notification.author.shortAddress} replied to your post in s/${notification.shortSubplebbitAddress}${
          notification.content
            ? `: ${notification.content.length > 100 ? notification.content.slice(0, 100).trim() + '...' : notification.content.trim()}`
            : notification.link
              ? `: ${notification.link.length > 100 ? notification.link.slice(0, 100).trim() + '...' : notification.link.trim()}`
              : ''
        }`,
        url: `/#/s/${notification.subplebbitAddress}/c/${notification.cid}`,
      };

      showLocalNotification(payload);

      // Mark this notification as sent in persistent storage
      await setSentNotificationStatus(notification.timestamp);
    });

    // Update the reference for the next comparison
    previousNotificationsRef.current = notifications;

    // Rerun when notifications, setting, or location changes
  }, [notifications, enableLocalNotifications, location.pathname]);

  return null; // This component doesn't render anything
};

export default NotificationHandler;
