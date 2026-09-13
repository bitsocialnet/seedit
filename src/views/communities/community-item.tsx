import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Community as CommunityType, useAccount, useCommunityStats } from '@bitsocial/bitsocial-react-hooks';
import styles from './communities.module.css';
import { getFormattedTimeDuration } from '../../lib/utils/time-utils';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import useIsMobile from '../../hooks/use-is-mobile';
import useIsCommunityOffline from '../../hooks/use-is-community-offline';
import Markdown from '../../components/markdown';
import Label from '../../components/label';
import SubscribeButton from '../../components/subscribe-button';
import { getDisplayAddress } from '../../lib/utils/address-utils';

interface CommunityProps {
  index?: number;
  community: CommunityType;
  nsfw?: boolean;
  tags?: string[];
  isUnsubscribed?: boolean;
  onUnsubscribe?: (address: string) => void;
  /** Published directory score. Falls back to the neutral marker while directories are unvoted. */
  score?: number;
  /** Directory candidate owner, kept visible so it stays clear who a route would resolve to. */
  owner?: string;
  isWinner?: boolean;
  /** Tag and nsfw links filter the current list, so views without tag filtering render them as plain text. */
  linkTags?: boolean;
}

export const NoCommunitiesMessage = () => {
  const { t } = useTranslation();
  return <div className={styles.noSubsMessage}>{t('nothing_found')}</div>;
};

const CommunityItem = ({ community, nsfw, tags, index, isUnsubscribed, onUnsubscribe, score, owner, isWinner, linkTags = true }: CommunityProps) => {
  const { t } = useTranslation();
  const { address, createdAt, description, roles, shortAddress, settings, title } = community || {};
  const location = useLocation();

  // community.settings is a private field that is only available to the owner of the community
  const isUserOwner = settings;
  const account = useAccount();
  const userRole = roles?.[account?.author?.address]?.role;

  const getTagFilterRoute = (tag: string) => {
    const pathname = location.pathname;
    return `${pathname}?tag=${encodeURIComponent(tag)}`;
  };

  // TODO: make arrows functional when token voting is implemented in the API
  const upvoted = false;
  const downvoted = false;
  const voteUnavailableTitle = t('vote_not_available_yet');

  const postScore = score ?? '•';
  const { allActiveUserCount } = useCommunityStats(address ? { community: getCommunityIdentifier(address) } : undefined);
  const { isOffline, isOnlineStatusLoading, offlineTitle } = useIsCommunityOffline(community);
  const communityPath = address ? getCommunityPath(address) : '/communities';

  const isMobile = useIsMobile();
  const descriptionText =
    description &&
    (isMobile
      ? description.length > 100
        ? description.slice(0, 100) + '...'
        : description
      : description.length > 400
        ? description.slice(0, 400) + '...'
        : description);

  return (
    <div className={`${styles.community} ${isUnsubscribed ? styles.unsubscribed : ''}`}>
      <div className={styles.row}>
        {!isMobile && <div className={styles.rank}>{(index ?? 0) + 1}</div>}
        <div className={styles.leftcol}>
          <div className={styles.midcol}>
            <div className={styles.arrowWrapper}>
              <div
                className={`${styles.arrowCommon} ${upvoted ? styles.upvoted : styles.arrowUp}`}
                style={{ cursor: 'not-allowed' }}
                title={voteUnavailableTitle}
                onClick={(e) => e.preventDefault()}
              />
            </div>
            <div className={styles.score}>{postScore}</div>
            <div className={styles.arrowWrapper}>
              <div
                className={`${styles.arrowCommon} ${downvoted ? styles.downvoted : styles.arrowDown}`}
                style={{ cursor: 'not-allowed' }}
                title={voteUnavailableTitle}
                onClick={(e) => e.preventDefault()}
              />
            </div>
          </div>
        </div>
        <div className={styles.entry}>
          <div className={styles.title}>
            <div className={styles.titleWrapper}>
              <Link to={communityPath}>
                s/{getDisplayAddress(address?.includes('.') ? address : shortAddress || '')}
                {title && `: ${title}`}
              </Link>
              {isWinner && <Label color='green' text='winner' title={t('directory_winner_explanation')} />}
            </div>
          </div>
          <div className={styles.tagline}>
            {t('members_count', { count: allActiveUserCount })}, {t('community_for', { date: getFormattedTimeDuration(createdAt) })}
            {owner && (
              <>
                , {t('owner')}: {getDisplayAddress(owner)}
              </>
            )}
            <div className={styles.taglineSecondLine}>
              <span className={styles.subscribeButton}>
                <SubscribeButton address={address} onUnsubscribe={onUnsubscribe} />
              </span>
              {(userRole || isUserOwner) && (
                <Link to={`${communityPath}/settings`}>
                  <span className={`${styles.moderatorIcon} ${nsfw ? styles.addMarginRight : ''}`} title={userRole || 'owner'} />
                </Link>
              )}
              {nsfw &&
                (linkTags ? (
                  <Link to={getTagFilterRoute('nsfw')}>
                    <span className={styles.over18icon} title='Filter NSFW communities' />
                  </Link>
                ) : (
                  <span className={styles.over18icon} title={t('nsfw')} />
                ))}
              {isOffline && !isOnlineStatusLoading && <Label color='red' title={offlineTitle} text={t('offline')} />}
              {tags && tags.length > 0 && (
                <span className={styles.tags}>
                  {tags.map((tag, index) => (
                    <Fragment key={index}>{linkTags ? <Link to={getTagFilterRoute(tag)}>{tag}</Link> : <span>{tag}</span>}</Fragment>
                  ))}
                </span>
              )}
            </div>
          </div>
          {description && (
            <div className={styles.description}>
              <Markdown content={descriptionText} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityItem;
