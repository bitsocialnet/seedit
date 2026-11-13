import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccount, useNotifications } from '@bitsocial/bitsocial-react-hooks';
import localForageLru from '@bitsocial/bitsocial-react-hooks/dist/lib/localforage-lru/index.js';
import useContentOptionsStore from '../../stores/use-content-options-store';
import { showLocalNotification } from '../../lib/push';
import { getCommunityPostPath } from '../../lib/utils/community-route-utils';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import { stripCommentPostOptionMarkers } from '../../lib/utils/fivechan-post-options';

// Create LRU storage instance for tracking sent notifications
const sentNotificationsDb = localForageLru.createInstance({ name: 'seeditSentNotifications', size: 1000 });

// Keyed by reply cid: replies published in the same second must not suppress each other.
const getSentNotificationStatus = async (cid: string): Promise<boolean> => {
  const sent = await sentNotificationsDb.getItem(cid);
  return sent === true;
};

const setSentNotificationStatus = async (cid: string): Promise<void> => {
  await sentNotificationsDb.setItem(cid, true);
};

/**
 * This component handles listening for new notifications from the useNotifications hook
 * and triggering the platform-specific local notification display.
 * It doesn't render anything itself, but runs its logic via useEffect.
 */
const NotificationHandler = () => {
  const { enableLocalNotifications } = useContentOptionsStore();
  const accountId = useAccount()?.id;
  const { notifications } = useNotifications();

  const location = useLocation();
  // Every reply observed for the active account, notified or not, so enabling notifications,
  // leaving the inbox or switching accounts never replays the replies already stored for the account.
  const seenRepliesRef = useRef<{ accountId: string; cids: Set<string> } | undefined>(undefined);

  useEffect(() => {
    // useNotifications returns [] until the account is loaded
    if (!accountId) {
      return;
    }

    // The first list for an account is its stored reply history: it becomes the baseline, nothing is notified.
    const seenReplies = seenRepliesRef.current;
    if (!seenReplies || seenReplies.accountId !== accountId) {
      seenRepliesRef.current = { accountId, cids: new Set(notifications.map((notification) => notification.cid)) };
      return;
    }

    const newNotifications = notifications.filter((notification) => !seenReplies.cids.has(notification.cid));
    newNotifications.forEach((notification) => seenReplies.cids.add(notification.cid));

    if (!enableLocalNotifications || location.pathname.startsWith('/inbox')) {
      return;
    }

    newNotifications.forEach(async (notification) => {
      const alreadySent = await getSentNotificationStatus(notification.cid);
      if (alreadySent) {
        return;
      }

      // useNotifications only supports replies at the moment
      const content = stripCommentPostOptionMarkers(notification.content, notification, notification.communityAddress);
      const payload = {
        id: notification.timestamp,
        icon: '/icon.png',
        title: `You received a reply`,
        body: `u/${getDisplayAddress(notification.author.shortAddress)} replied to your post in s/${getDisplayAddress(notification.shortCommunityAddress)}${
          content
            ? `: ${content.length > 100 ? content.slice(0, 100).trim() + '...' : content.trim()}`
            : notification.link
              ? `: ${notification.link.length > 100 ? notification.link.slice(0, 100).trim() + '...' : notification.link.trim()}`
              : ''
        }`,
        url: `/#${getCommunityPostPath(notification.communityAddress, notification.cid)}`,
      };

      showLocalNotification(payload);

      // Mark this notification as sent in persistent storage
      await setSentNotificationStatus(notification.cid);
    });

    // Rerun when the account, notifications, setting, or location changes
  }, [accountId, notifications, enableLocalNotifications, location.pathname]);

  return null; // This component doesn't render anything
};

export default NotificationHandler;
