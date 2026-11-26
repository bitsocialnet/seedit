import { useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { StateSnapshot, Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import styles from './inbox.module.css';
import Reply from '../../components/reply';
import useInbox from '../../hooks/use-inbox';
import { isInboxCommentRepliesView, isInboxPostRepliesView, isInboxUnreadView } from '../../lib/utils/view-utils';
import { useTranslation } from 'react-i18next';
import startCase from 'lodash/startCase';
import ErrorDisplay from '../../components/error-display';

const lastVirtuosoStates: { [key: string]: StateSnapshot } = {};

const InboxTabs = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isInInboxCommentRepliesView = isInboxCommentRepliesView(location.pathname);
  const isInInboxPostRepliesView = isInboxPostRepliesView(location.pathname);
  const isInInboxUnreadView = isInboxUnreadView(location.pathname);
  const isInAllView = !isInInboxCommentRepliesView && !isInInboxPostRepliesView && !isInInboxUnreadView;

  return (
    <div className={styles.inboxTabs}>
      <Link to='/inbox' className={isInAllView ? styles.selected : styles.choice}>
        {t('all')}
      </Link>
      <span className={styles.separator}>|</span>
      <Link to='/inbox/unread' className={isInInboxUnreadView ? styles.selected : styles.choice}>
        {t('unread')}
      </Link>
      <span className={styles.separator}>|</span>
      <Link to='/inbox/commentreplies' className={isInInboxCommentRepliesView ? styles.selected : styles.choice}>
        {t('comment_replies')}
      </Link>
      <span className={styles.separator}>|</span>
      <Link to='/inbox/postreplies' className={isInInboxPostRepliesView ? styles.selected : styles.choice}>
        {t('post_replies')}
      </Link>
    </div>
  );
};

const Inbox = () => {
  const { t } = useTranslation();
  const { account, tab, notifications, comments, unreadNotificationCount, markAsRead, error, shouldShowError: shouldShowErrorToUser } = useInbox();
  const isInInboxCommentRepliesView = tab === 'commentreplies';
  const isInInboxPostRepliesView = tab === 'postreplies';
  const isInInboxUnreadView = tab === 'unread';

  // save last virtuoso state on each scroll
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const lastVirtuosoState = lastVirtuosoStates?.[unreadNotificationCount ?? 0];
  useEffect(() => {
    const setLastVirtuosoState = () =>
      virtuosoRef.current?.getState((snapshot) => {
        // TODO: not sure if checking for empty snapshot.ranges works for all scenarios
        if (snapshot?.ranges?.length) {
          lastVirtuosoStates[unreadNotificationCount ?? 0] = snapshot;
        }
      });
    window.addEventListener('scroll', setLastVirtuosoState);
    // clean listener on unmount
    return () => window.removeEventListener('scroll', setLastVirtuosoState);
  }, [unreadNotificationCount]);

  const documentTitle = useMemo(() => {
    let title = startCase(t('inbox'));
    if (isInInboxUnreadView) {
      title += ` - ${startCase(t('unread'))}`;
    } else if (isInInboxCommentRepliesView) {
      title += ` - ${startCase(t('comment_replies'))}`;
    } else if (isInInboxPostRepliesView) {
      title += ` - ${startCase(t('post_replies'))}`;
    }
    return `${title} - Seedit`;
  }, [isInInboxCommentRepliesView, isInInboxPostRepliesView, isInInboxUnreadView, t]);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div className={styles.content}>
      <InboxTabs />
      <div className={styles.markAllAsReadButton}>
        {account && notifications.length ? (
          <button onClick={markAsRead} disabled={!unreadNotificationCount} className={styles.markAsReadButton}>
            {t('mark_all_read')}
          </button>
        ) : (
          <div className={styles.noNotifications}>{t('nothing_found')}</div>
        )}
      </div>
      {shouldShowErrorToUser && (
        <div className={styles.error}>
          <ErrorDisplay error={error} />
        </div>
      )}
      <Virtuoso
        increaseViewportBy={{ bottom: 1200, top: 600 }}
        totalCount={notifications?.length || 0}
        data={comments}
        computeItemKey={(index, notification) => notification?.cid || index}
        itemContent={(index, notification) => (
          <div className={styles.notification}>
            <Reply index={index} isSingleReply={true} reply={notification} isNotification={true} />
          </div>
        )}
        useWindowScroll={true}
        ref={virtuosoRef}
        restoreStateFrom={lastVirtuosoState}
        initialScrollTop={lastVirtuosoState?.scrollTop}
      />
    </div>
  );
};

export default Inbox;
