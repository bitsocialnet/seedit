import { useEffect, useMemo } from 'react';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import { useTranslation } from 'react-i18next';
import useAuthorFeed from '../../hooks/use-author-feed';
import useAuthorProfile from '../../hooks/use-author-profile';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import ErrorDisplay from '../../components/error-display';
import { ModernColumns } from '../../components/modern-layout';
import { ModernBlockButton, ModernModeratorOf, ModernUserFeed, ModernUserHeader, ModernUserTabs } from '../../components/modern-user-profile';
import styles from './modern-author.module.css';

/** Another author's page, opened from one of their comments. */
const ModernAuthor = () => {
  const { t } = useTranslation();
  const { authorAddress, commentCid, tab, comments, error, hasMore, loadMore, shouldShowError } = useAuthorFeed();
  const profile = useAuthorProfile();
  // The author's feed can hold places for comments that have not loaded.
  const loadedComments = useMemo(() => comments.filter((comment): comment is Comment => Boolean(comment)), [comments]);
  const userAddress = `u/${getDisplayAddress(profile.shortAddress || getShortDisplayAddress(authorAddress) || '')}`;
  const profileTitle = profile.displayName ? `${profile.displayName} (${userAddress})` : userAddress;

  useEffect(() => {
    document.title = `${profileTitle} - Seedit`;
  }, [profileTitle]);

  const basePath = `/u/${authorAddress}/comments/${commentCid}`;
  const tabs = [
    { path: basePath, label: t('overview'), isActive: tab === 'overview' },
    { path: `${basePath}/submitted`, label: t('posts'), isActive: tab === 'submitted' },
    { path: `${basePath}/comments`, label: t('comments'), isActive: tab === 'comments' },
  ];

  return (
    <ModernColumns rail={profile.moderatedCommunities.length > 0 && <ModernModeratorOf communityAddresses={profile.moderatedCommunities} />}>
      <ModernUserHeader
        address={authorAddress}
        shortAddress={profile.shortAddress}
        displayName={profile.displayName}
        postKarma={profile.postKarma}
        commentKarma={profile.commentKarma}
        oldestCommentTimestamp={profile.oldestCommentTimestamp}
        actions={profile.isOtherAuthor && <ModernBlockButton blocked={Boolean(profile.blocked)} onToggle={profile.blocked ? profile.unblock : profile.block} />}
      />
      <ModernUserTabs tabs={tabs} label={profileTitle} />
      {shouldShowError && (
        <div className={styles.error}>
          <ErrorDisplay error={error} />
        </div>
      )}
      <ModernUserFeed
        comments={loadedComments}
        hasMore={hasMore}
        loadMore={loadMore}
        loadingText={tab === 'comments' ? t('downloading_comments') : t('downloading_posts')}
        stateKey={`${authorAddress}|${tab}`}
      />
    </ModernColumns>
  );
};

export default ModernAuthor;
