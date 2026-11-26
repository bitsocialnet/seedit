import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Virtuoso } from 'react-virtuoso';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import useInbox, { type InboxTab } from '../../hooks/use-inbox';
import ErrorDisplay from '../../components/error-display';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import ModernReplyCard from '../../components/modern-reply-card';
import { ModernUserFeedStatus, ModernUserTabs } from '../../components/modern-user-profile';
import styles from './modern-inbox.module.css';

const TABS: { tab: InboxTab; path: string; labelKey: string }[] = [
  { tab: 'all', path: '/inbox', labelKey: 'all' },
  { tab: 'unread', path: '/inbox/unread', labelKey: 'unread' },
  { tab: 'commentreplies', path: '/inbox/commentreplies', labelKey: 'comment_replies' },
  { tab: 'postreplies', path: '/inbox/postreplies', labelKey: 'post_replies' },
];

const Notification = ({ notification }: { notification: Comment }) => {
  const { t } = useTranslation();
  // A reply straight under the post answers the account's post; any deeper one answers its comment.
  const label = notification.parentCid === notification.postCid ? t('post_reply') : t('comment_reply');
  return (
    <div className={styles.notification}>
      <ModernReplyCard reply={notification} label={label} unread={!notification.markedAsRead} />
    </div>
  );
};

/** Replies to the account's posts and comments. */
const ModernInbox = () => {
  const { t } = useTranslation();
  const { account, tab, notifications, comments, unreadNotificationCount, markAsRead, error, shouldShowError } = useInbox();

  const inboxTitle = `${t('inbox').charAt(0).toUpperCase()}${t('inbox').slice(1)}`;
  useEffect(() => {
    document.title = `${inboxTitle} - Seedit`;
  }, [inboxTitle]);

  const tabs = TABS.map(({ tab: name, path, labelKey }) => ({ path, label: t(labelKey), isActive: name === tab }));
  const renderNotification = useCallback((_index: number, notification: Comment) => <Notification notification={notification} />, []);

  return (
    <ModernColumns>
      <header className={styles.header}>
        <h1 className={styles.heading}>{inboxTitle}</h1>
        {account && notifications.length > 0 && (
          <button type='button' className={modernStyles.secondaryButton} onClick={() => markAsRead()} disabled={!unreadNotificationCount}>
            <span className={modernStyles.sentenceCase}>{t('mark_all_read')}</span>
          </button>
        )}
      </header>
      <ModernUserTabs tabs={tabs} label={inboxTitle} />
      {shouldShowError && (
        <div className={styles.error}>
          <ErrorDisplay error={error} />
        </div>
      )}
      {comments.length === 0 ? (
        <ModernUserFeedStatus text={t('nothing_found')} />
      ) : (
        <Virtuoso
          increaseViewportBy={{ bottom: 1200, top: 600 }}
          data={comments}
          computeItemKey={(index, notification) => notification?.cid || index}
          itemContent={renderNotification}
          useWindowScroll={true}
        />
      )}
    </ModernColumns>
  );
};

export default ModernInbox;
