import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Virtuoso, type StateSnapshot, type VirtuosoHandle } from 'react-virtuoso';
import { type Comment, useComment } from '@bitsocial/bitsocial-react-hooks';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import { getFormattedTimeDuration } from '../../lib/utils/time-utils';
import ModernCommunityAvatar from '../modern-community-avatar';
import { ModernRailSection, modernStyles } from '../modern-layout';
import ModernPostCard from '../modern-post-card';
import ModernReplyCard from '../modern-reply-card';
import styles from './modern-user-profile.module.css';

interface ModernUserHeaderProps {
  address: string | undefined;
  shortAddress: string | undefined;
  displayName: string | undefined;
  postKarma: number;
  commentKarma: number;
  oldestCommentTimestamp: number;
  /** Buttons for this profile, such as block or edit. */
  actions?: ReactNode;
}

/** Who the profile belongs to: name, address, karma, and age. */
export const ModernUserHeader = ({ address, shortAddress, displayName, postKarma, commentKarma, oldestCommentTimestamp, actions }: ModernUserHeaderProps) => {
  const { t } = useTranslation();
  const userAddress = `u/${getDisplayAddress(shortAddress || getShortDisplayAddress(address) || '')}`;

  return (
    <header className={styles.header}>
      <div className={styles.identityRow}>
        {address && <ModernCommunityAvatar address={address} size='large' />}
        <div className={styles.identity}>
          <h1 className={styles.name}>{displayName || userAddress}</h1>
          <p className={styles.address} title={address}>
            {displayName ? userAddress : address}
          </p>
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <ul className={styles.stats}>
        <li>
          <strong className={styles.statValue}>{postKarma}</strong> {t('post_karma')}
        </li>
        <li>
          <strong className={styles.statValue}>{commentKarma}</strong> {t('comment_karma')}
        </li>
        <li>{t('user_since', { time: getFormattedTimeDuration(oldestCommentTimestamp) })}</li>
      </ul>
    </header>
  );
};

export interface ModernUserTab {
  path: string;
  label: string;
  isActive: boolean;
}

/** The profile's lists; label names the profile for assistive technology. */
export const ModernUserTabs = ({ tabs, label, children }: { tabs: ModernUserTab[]; label: string; children?: ReactNode }) => {
  return (
    <div className={styles.tabBar}>
      <nav className={styles.tabs} aria-label={label}>
        {tabs.map(({ path, label, isActive }) => (
          <Link key={path} to={path} className={`${styles.tab} ${isActive ? styles.tabActive : ''}`} aria-current={isActive ? 'page' : undefined}>
            <span className={modernStyles.sentenceCase}>{label}</span>
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
};

/** Block or unblock another author, after a confirmation. */
export const ModernBlockButton = ({ blocked, onToggle }: { blocked: boolean; onToggle: () => void }) => {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <span className={styles.confirm} role='group' aria-label={blocked ? t('unblock_user') : t('block_user')}>
        <span>{t('are_you_sure')}</span>
        <button
          type='button'
          className={`${modernStyles.primaryButton} ${styles.smallButton}`}
          onClick={() => {
            onToggle();
            setIsConfirming(false);
          }}
        >
          <span className={modernStyles.sentenceCase}>{t('yes')}</span>
        </button>
        <button type='button' className={`${modernStyles.secondaryButton} ${styles.smallButton}`} onClick={() => setIsConfirming(false)}>
          <span className={modernStyles.sentenceCase}>{t('no')}</span>
        </button>
      </span>
    );
  }

  return (
    <button type='button' className={modernStyles.secondaryButton} onClick={() => setIsConfirming(true)}>
      {blocked ? t('unblock_user') : t('block_user')}
    </button>
  );
};

/** The rail list of communities the profile's owner moderates. */
export const ModernModeratorOf = ({ communityAddresses }: { communityAddresses: string[] }) => {
  const { t } = useTranslation();
  if (communityAddresses.length === 0) return null;
  return (
    <ModernRailSection title={<span className={modernStyles.sentenceCase}>{t('moderator_of')}</span>}>
      <ul className={styles.communityList}>
        {communityAddresses.map((address) => (
          <li key={address}>
            <Link to={getCommunityPath(address)} className={styles.communityLink} title={address}>
              <ModernCommunityAvatar address={address} />
              <span>s/{getShortDisplayAddress(address)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </ModernRailSection>
  );
};

export const ModernUserFeedItem = ({ comment }: { comment: Comment }) => (comment.parentCid ? <ModernReplyCard reply={comment} /> : <ModernPostCard post={comment} />);

/** A post or reply known only by its cid, such as a saved or voted one. */
export const ModernCommentByCid = ({ cid }: { cid: string }) => {
  const comment = useComment({ commentCid: cid });
  if (!comment?.timestamp || !getCommentCommunityAddress(comment)) return null;
  return <ModernUserFeedItem comment={comment} />;
};

export const ModernUserFeedStatus = ({ text, isLoading }: { text: string; isLoading?: boolean }) => (
  <div className={styles.status} role='status'>
    {isLoading && <span className={styles.spinner} aria-hidden='true' />}
    <span>{text}</span>
  </div>
);

interface FeedContext {
  hasMore: boolean;
  loadingText: string;
}

const FeedFooter = ({ context: { hasMore, loadingText } }: { context: FeedContext }) =>
  hasMore ? <ModernUserFeedStatus text={loadingText} isLoading /> : <div className={styles.feedEnd} aria-hidden='true' />;
const feedComponents = { Footer: FeedFooter };

// Scroll positions per profile list, so going back to a profile returns to the same item.
const lastVirtuosoStates: Record<string, StateSnapshot> = {};

interface ModernUserFeedProps {
  comments: Comment[];
  hasMore: boolean;
  loadMore?: () => void;
  loadingText: string;
  /** Identifies the list for restoring its scroll position. */
  stateKey: string;
}

/** A profile's posts and replies, newest first, rendered as they scroll into view. */
export const ModernUserFeed = ({ comments, hasMore, loadMore, loadingText, stateKey }: ModernUserFeedProps) => {
  const { t } = useTranslation();
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    const saveState = () => {
      virtuosoRef.current?.getState((snapshot) => {
        if (snapshot?.ranges?.length) lastVirtuosoStates[stateKey] = snapshot;
      });
    };
    window.addEventListener('scroll', saveState);
    return () => window.removeEventListener('scroll', saveState);
  }, [stateKey]);
  const lastVirtuosoState = lastVirtuosoStates[stateKey];

  const context = useMemo(() => ({ hasMore, loadingText }), [hasMore, loadingText]);
  const renderItem = useCallback((_index: number, comment: Comment) => <ModernUserFeedItem comment={comment} />, []);

  if (comments.length === 0 && !hasMore) return <ModernUserFeedStatus text={t('nothing_found')} />;

  return (
    <Virtuoso<Comment, FeedContext>
      key={stateKey}
      increaseViewportBy={{ bottom: 1200, top: 600 }}
      totalCount={comments.length}
      data={comments}
      computeItemKey={(index, comment) => comment?.cid || `pending-${comment?.index ?? index}`}
      itemContent={renderItem}
      useWindowScroll={true}
      components={feedComponents}
      context={context}
      endReached={loadMore}
      ref={virtuosoRef}
      restoreStateFrom={lastVirtuosoState}
      initialScrollTop={lastVirtuosoState?.scrollTop}
    />
  );
};

/** A list of cids that grows by a page at a time, for lists the account keeps by cid. */
export const ModernCidList = ({ cids, hasMore, onLoadMore }: { cids: string[]; hasMore: boolean; onLoadMore: () => void }) => {
  const { t } = useTranslation();
  if (cids.length === 0) return <ModernUserFeedStatus text={t('nothing_found')} />;
  return (
    <>
      {cids.map((cid) => (
        <ModernCommentByCid key={cid} cid={cid} />
      ))}
      {hasMore && (
        <div className={styles.loadMore}>
          <button type='button' className={modernStyles.secondaryButton} onClick={onLoadMore}>
            {t('load_more')}
          </button>
        </div>
      )}
    </>
  );
};
