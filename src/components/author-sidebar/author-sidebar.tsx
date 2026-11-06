import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  useAccount,
  useAccountComments,
  useAccountCommunities,
  AccountCommunity,
  Community,
  useAuthor,
  useAuthorComments,
  useBlock,
  useCommunities,
} from '@bitsocial/bitsocial-react-hooks';
import styles from './author-sidebar.module.css';
import { getFormattedTimeDuration } from '../../lib/utils/time-utils';
import { getOldestAccountHistoryTimestamp } from '../../lib/utils/account-history-utils';
import { isAuthorView, isProfileView } from '../../lib/utils/view-utils';
import { findAuthorCommunities, estimateAuthorKarma } from '../../lib/utils/user-utils';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { getCommunityIdentifiers } from '../../hooks/use-community-identifier';
import { useTranslation } from 'react-i18next';
import { useDefaultSubscriptionAddresses } from '../../hooks/use-default-subscriptions';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import { stripTripcodeProof } from '../../lib/utils/tripcode-utils';

interface AuthorModeratingListProps {
  accountCommunities: Record<string, AccountCommunity & Partial<Community>>;
  authorCommunities: string[];
  isAuthor?: boolean;
}

const AuthorModeratingList = ({ accountCommunities, authorCommunities, isAuthor = false }: AuthorModeratingListProps) => {
  const { t } = useTranslation();
  const rawAddresses = isAuthor ? authorCommunities : Object.keys(accountCommunities);
  const communityAddresses = [...new Set(rawAddresses)];

  return (
    communityAddresses.length > 0 && (
      <div className={styles.modList}>
        <div className={styles.modListTitle}>{t('moderator_of')}</div>
        <ul className={`${styles.modListContent} ${styles.modsList}`}>
          {communityAddresses.map((address, index) => (
            <li key={index}>
              <Link to={getCommunityPath(address)}>s/{getShortDisplayAddress(address)}</Link>
            </li>
          ))}
        </ul>
      </div>
    )
  );
};

const AuthorSidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const params = useParams();
  const { authorAddress, commentCid } = useParams() || {};
  const { blocked, unblock, block } = useBlock({ address: authorAddress });
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const isInAuthorView = isAuthorView(location.pathname);
  const isInProfileView = isProfileView(location.pathname);

  const userAccount = useAccount();
  const { accountComments: oldestAccountComment } = useAccountComments({ page: 0, pageSize: 1, order: 'asc' });
  const { accountCommunities } = useAccountCommunities();
  const profileOldestAccountTimestamp = getOldestAccountHistoryTimestamp(oldestAccountComment as { timestamp?: number }[]);

  const defaultCommunityAddresses = useDefaultSubscriptionAddresses();
  const accountSubscriptions = userAccount?.subscriptions || [];
  const subscriptionsAndDefaults = [...accountSubscriptions, ...defaultCommunityAddresses];

  const communities =
    useCommunities({
      communities: getCommunityIdentifiers(subscriptionsAndDefaults || []),
      onlyIfCached: true,
    }).communities?.filter(Boolean) || [];

  const authorAccount = useAuthor({ authorAddress, commentCid });
  const { authorComments } = useAuthorComments({ authorAddress, commentCid });
  const authorOldestCommentTimestamp = authorComments?.length
    ? Math.min(...authorComments.filter((comment): comment is NonNullable<typeof comment> => comment != null).map((comment) => comment.timestamp))
    : Date.now();
  const authorCommunities = findAuthorCommunities(authorAddress, Object.values(communities));
  const estimatedAuthorKarma = estimateAuthorKarma(authorComments);

  const address = isInAuthorView ? params?.authorAddress : isInProfileView ? userAccount?.author?.address : '';
  const karma = isInAuthorView ? estimatedAuthorKarma : isInProfileView ? userAccount?.karma : '';
  const { postScore, replyScore } = karma || { postScore: 0, replyScore: 0 };

  const oldestCommentTimestamp = isInAuthorView ? authorOldestCommentTimestamp : isInProfileView ? profileOldestAccountTimestamp : Date.now();
  const displayName = stripTripcodeProof(isInAuthorView ? authorAccount?.author?.displayName : isInProfileView ? userAccount?.author?.displayName : '');

  const blockConfirm = () => {
    setShowBlockConfirm(true);
  };

  const handleBlock = () => {
    if (blocked) {
      unblock();
    } else {
      block();
    }
    setShowBlockConfirm(false);
  };

  const cancelBlock = () => {
    setShowBlockConfirm(false);
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.titleBox}>
        <div className={styles.title}>
          {getDisplayAddress(address || '')}
          {isInProfileView && !displayName && (
            <span className={styles.editButtonWrapper}>
              {' '}
              (
              <span className={styles.editButton}>
                <Link to='/settings#displayName'>{t('edit')}</Link>
              </span>
              )
            </span>
          )}
        </div>
        {displayName && <div className={styles.displayName}>{displayName}</div>}
        {/*  TODO: implement functionality for subscribing to users
        {isInAuthorView && authorAddress !== userAccount?.author?.address && (
          <div className={styles.friends}>
            <SubscribeButton address={address} />
          </div>
        )} */}
        <div>
          <span className={styles.karma}>{postScore + 1}</span> {t('post_karma')}
        </div>
        <div>
          <span className={styles.karma}>{replyScore}</span> {t('comment_karma')}
        </div>
        <div className={styles.bottom}>
          {isInAuthorView &&
            authorAddress !== userAccount?.author?.address &&
            (showBlockConfirm ? (
              <span className={styles.blockConfirm}>
                {t('are_you_sure')}{' '}
                <span className={styles.confirmButton} onClick={handleBlock}>
                  {t('yes')}
                </span>
                {' / '}
                <span className={styles.cancelButton} onClick={cancelBlock}>
                  {t('no')}
                </span>
              </span>
            ) : (
              <span className={styles.blockUser} onClick={blockConfirm}>
                {blocked ? t('unblock_user') : t('block_user')}
              </span>
            ))}
          <span className={styles.age}>{t('user_since', { time: getFormattedTimeDuration(oldestCommentTimestamp) })}</span>
        </div>
      </div>
      {(Object.keys(accountCommunities).length > 0 || authorCommunities.length > 0) && (
        <AuthorModeratingList accountCommunities={accountCommunities} isAuthor={isInAuthorView} authorCommunities={authorCommunities} />
      )}
    </div>
  );
};

export default AuthorSidebar;
