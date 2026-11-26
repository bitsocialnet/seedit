import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccount, useNotifications } from '@bitsocial/bitsocial-react-hooks';
import { isInboxCommentRepliesView, isInboxPostRepliesView, isInboxUnreadView } from '../lib/utils/view-utils';

export type InboxTab = 'all' | 'unread' | 'commentreplies' | 'postreplies';

/** The account's notifications for the routed /inbox tab; both interfaces' inboxes read it. */
const useInbox = () => {
  const { pathname } = useLocation();
  const account = useAccount();
  const { error, notifications, markAsRead } = useNotifications();
  const tab: InboxTab = isInboxCommentRepliesView(pathname)
    ? 'commentreplies'
    : isInboxPostRepliesView(pathname)
      ? 'postreplies'
      : isInboxUnreadView(pathname)
        ? 'unread'
        : 'all';

  const comments = useMemo(() => {
    if (!notifications) return [];
    if (tab === 'commentreplies') return notifications.filter((comment) => comment.parentCid !== comment.postCid);
    if (tab === 'postreplies') return notifications.filter((comment) => comment.parentCid === comment.postCid);
    if (tab === 'unread') return notifications.filter((comment) => !comment.markedAsRead);
    return notifications;
  }, [notifications, tab]);

  return {
    account,
    tab,
    notifications,
    comments,
    unreadNotificationCount: account?.unreadNotificationCount as number | undefined,
    markAsRead,
    error,
    shouldShowError: Boolean(error?.message && comments.length === 0),
  };
};

export default useInbox;
