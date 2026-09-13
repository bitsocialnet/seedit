import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Comment, useAccount, useBlock, Role, Community, useCommunityStats, usePkcRpcSettings } from '@bitsocial/bitsocial-react-hooks';
import { getPostScore } from '../../lib/utils/post-utils';
import { getFormattedDate, getFormattedTimeDuration, getFormattedTimeAgo } from '../../lib/utils/time-utils';
import { findCommunityCreator } from '../../lib/utils/user-utils';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import {
  isAllView,
  isChangelogView,
  isDomainView,
  isGoldView,
  isHomeAboutView,
  isHomeView,
  isModView,
  isPendingPostView,
  isPostPageAboutView,
  isPostPageView,
  isCommunityAboutView,
  isCommunitySettingsView,
  isCommunitiesView,
  isCommunitiesDirectoryView,
  isCommunityView,
  isSearchView,
} from '../../lib/utils/view-utils';
import useCommunitySubtitles from '../../hooks/use-community-subtitles';
import useIsMobile from '../../hooks/use-is-mobile';
import useIsCommunityOffline from '../../hooks/use-is-community-offline';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useOptionalAccountComment from '../../hooks/use-account-comment';
import { getCommunityPath, getCommunityPostUrl, getDirectoryCandidatesPath } from '../../lib/utils/community-route-utils';
import { isDirectoryCode, type SeeditDirectoryCode } from '../../lib/utils/directory-codes';
import { getDirectoryCommunityProposalUrl, getNewDirectoryProposalUrl } from '../../lib/utils/directory-proposal-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import FAQ from '../faq';
import LoadingEllipsis from '../loading-ellipsis';
import Markdown from '../markdown';
import SearchBar from '../search-bar';
import SubscribeButton from '../subscribe-button';
import DirectoryAutoSwitchControl from '../directory-auto-switch-control';
import { Version } from '../version';
import styles from './sidebar.module.css';

const RulesList = ({ rules }: { rules: string[] }) => {
  const { t } = useTranslation();
  const markdownRules = rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n');

  return (
    <div className={styles.rules}>
      <div className={styles.rulesTitle}>
        <strong>{t('rules')}</strong>
      </div>
      <Markdown content={markdownRules} />
    </div>
  );
};

const getRandomSubtitleIndexes = (subtitleCount: number): [number | undefined, number | undefined] => {
  if (subtitleCount < 1) return [undefined, undefined];
  if (subtitleCount === 1) return [0, undefined];

  const firstIndex = Math.floor(Math.random() * subtitleCount);
  const secondIndex = (firstIndex + 1 + Math.floor(Math.random() * (subtitleCount - 1))) % subtitleCount;
  return [firstIndex, secondIndex];
};

const ModeratorsList = ({ roles }: { roles: Record<string, Role> }) => {
  const { t } = useTranslation();
  const rolesList = roles ? Object.entries(roles).map(([address, { role }]) => ({ address, role })) : [];

  return (
    <div className={styles.list}>
      <div className={styles.listTitle}>{t('moderators')}</div>
      <ul className={`${styles.listContent} ${styles.modsList}`}>
        {rolesList.map(({ address }, index) => (
          <li key={index} onClick={() => window.alert('Direct profile links are not supported yet.')}>
            u/{getShortDisplayAddress(address)}
          </li>
        ))}
        {/* TODO: https://github.com/bitsocialnet/seedit/issues/274
         <li className={styles.listMore}>{t('about_moderation')} »</li> */}
      </ul>
    </div>
  );
};

const PostInfo = ({ comment }: { comment: Comment | undefined }) => {
  const { t, i18n } = useTranslation();
  const { language } = i18n;
  const { upvoteCount, downvoteCount, timestamp, state, cid } = comment || {};
  const communityAddress = getCommentCommunityAddress(comment);
  const postScore = getPostScore(upvoteCount, downvoteCount, state);
  const totalVotes = upvoteCount + downvoteCount;
  const upvotePercentage = totalVotes > 0 ? Math.round((upvoteCount / totalVotes) * 100) : 0;
  const postDate = getFormattedDate(timestamp, language);

  return (
    <div className={styles.postInfo}>
      <div className={styles.postDate}>
        <span>{t('post_submitted_on', { postDate: postDate })}</span>
      </div>
      <div className={styles.postScore}>
        <span className={styles.postScoreNumber}>{postScore === '•' ? '0' : postScore}</span>{' '}
        <span className={styles.postScoreWord}>{postScore === 1 ? t('point') : t('points')}</span>{' '}
        {`(${postScore === '?' ? '?' : `${upvotePercentage}`}% ${t('upvoted')})`}
      </div>
      {communityAddress && cid && (
        <div className={styles.shareLink}>
          {t('share_link')}: <input type='text' value={getCommunityPostUrl(communityAddress, cid)} aria-label={t('share_link')} readOnly={true} />
        </div>
      )}
    </div>
  );
};

const ModerationTools = ({ address }: { address?: string }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const params = useParams();
  const isInCommunitySettingsView = isCommunitySettingsView(location.pathname, params);

  return (
    <div className={styles.list}>
      <div className={styles.listTitle}>{t('moderation_tools')}</div>
      <ul className={`${styles.listContent} ${styles.modsList}`}>
        <li className={`${styles.moderationTool} ${isInCommunitySettingsView ? styles.selectedTool : ''}`}>
          <Link className={styles.communitySettingsTool} to={address ? `${getCommunityPath(address)}/settings` : '/communities'}>
            {t('community_settings')}
          </Link>
        </li>
      </ul>
    </div>
  );
};

interface SidebarProps {
  comment?: Comment;
  communityAddress?: string;
  directoryCode?: SeeditDirectoryCode;
  directoryRevision?: number;
  isSubCreatedButNotYetPublished?: boolean;
  settings?: any;
  community?: Community;
  reset?: () => void;
}

const Footer = () => {
  const location = useLocation();
  const params = useParams();
  const isMobile = useIsMobile();
  const isInHomeAboutView = isHomeAboutView(location.pathname);
  const isInPostPageAboutView = isPostPageAboutView(location.pathname, params);
  const isInCommunityView = isCommunityView(location.pathname, params);

  // SiteFooter renders on every page and already carries the github/telegram/x/docs
  // destinations, so the sidebar keeps only the version
  return (
    <div
      className={`${styles.footer} ${isMobile && (isInHomeAboutView || isInPostPageAboutView) ? styles.mobileFooter : ''} ${
        isInCommunityView ? styles.communityFooterMargin : ''
      }`}
    >
      <div className={styles.footerLinks}>
        <ul>
          <li>
            <Version />
          </li>
        </ul>
      </div>
    </div>
  );
};

const Sidebar = ({ comment, communityAddress, directoryCode, directoryRevision, isSubCreatedButNotYetPublished, settings, community, reset }: SidebarProps) => {
  const { t } = useTranslation();
  const { address: loadedCommunityAddress, createdAt, description, roles, rules, title, updatedAt } = community || {};
  const address = loadedCommunityAddress || communityAddress;
  const { allActiveUserCount, hourActiveUserCount } = useCommunityStats(address ? { community: getCommunityIdentifier(address) } : undefined);
  const { isOffline, offlineTitle } = useIsCommunityOffline(community || {});
  const onlineNotice = t('users_online', { count: hourActiveUserCount || 0 });
  const offlineNotice = updatedAt ? t('posts_last_synced', { dateAgo: getFormattedTimeAgo(updatedAt) }) : offlineTitle;
  const onlineStatus = !isOffline ? onlineNotice : offlineNotice;

  const subCreatedButNotYetPublishedStatus = <LoadingEllipsis string='Publishing community over IPFS' />;

  const location = useLocation();
  const params = useParams();
  const isInAllView = isAllView(location.pathname);
  const isInChangelogView = isChangelogView(location.pathname);
  const isInDomainView = isDomainView(location.pathname);
  const isInSearchView = isSearchView(location.pathname);
  const isInGoldView = isGoldView(location.pathname);
  const isInHomeAboutView = isHomeAboutView(location.pathname);
  const isInPostPageAboutView = isPostPageAboutView(location.pathname, params);
  const isInHomeView = isHomeView(location.pathname);
  const isInModView = isModView(location.pathname);
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const isInPostPageView = isPostPageView(location.pathname, params);
  const isInCommunitiesView = isCommunitiesView(location.pathname);
  const isInCommunitiesDirectoryView = isCommunitiesDirectoryView(location.pathname);
  const isInCommunityAboutView = isCommunityAboutView(location.pathname, params);
  const isInCommunityView = isCommunityView(location.pathname, params);
  const proposedDirectoryCode = isDirectoryCode(params.directoryCode) ? params.directoryCode : undefined;
  const directoryProposalUrl = proposedDirectoryCode ? getDirectoryCommunityProposalUrl(proposedDirectoryCode) : getNewDirectoryProposalUrl();

  // the community title box only belongs on routes that stand for a community, not on the standalone pages
  const showsCommunityTitleBox =
    !isInHomeView &&
    !isInHomeAboutView &&
    !isInAllView &&
    !isInModView &&
    !isInCommunitiesView &&
    !isInGoldView &&
    !isInChangelogView &&
    !isInDomainView &&
    !isInSearchView &&
    !isInPostPageAboutView;

  const pendingPost = useOptionalAccountComment(params?.accountCommentIndex);
  const pendingPostCommunityAddress = getCommentCommunityAddress(pendingPost);

  const communityCreator = findCommunityCreator(roles);
  const creatorAddress = communityCreator === 'anonymous' ? 'anonymous' : getShortDisplayAddress(communityCreator);
  const submitRoute =
    isInHomeView || isInHomeAboutView || isInAllView || isInModView || isInDomainView
      ? '/submit'
      : isInPendingPostView
        ? pendingPostCommunityAddress
          ? `${getCommunityPath(pendingPostCommunityAddress)}/submit`
          : '/submit'
        : address || params?.communityAddress
          ? `${getCommunityPath(address || params.communityAddress!)}/submit`
          : '/submit';

  const { blocked, unblock, block } = useBlock({ address });

  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

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
    reset?.();
  };

  const cancelBlock = () => {
    setShowBlockConfirm(false);
  };

  const account = useAccount();
  const moderatorRole = roles?.[account.author?.address]?.role;
  const isOwner = !!settings;

  const communitySubtitles = useCommunitySubtitles();
  const [subtitleIndexes] = useState(() => getRandomSubtitleIndexes(communitySubtitles.length));
  const [subtitleIndex1, subtitleIndex2] = subtitleIndexes;
  const subtitle1 = subtitleIndex1 === undefined ? '' : communitySubtitles[subtitleIndex1] || '';
  const subtitle2 = subtitleIndex2 === undefined ? '' : communitySubtitles[subtitleIndex2] || '';

  const isConnectedToRpc = usePkcRpcSettings()?.state === 'connected';
  const navigate = useNavigate();
  const handleCreateCommunity = () => {
    // creating a community only works if the user is running a full node
    if (isConnectedToRpc) {
      navigate('/communities/create');
    } else if (window.confirm(t('create_community_warning'))) {
      const link = document.createElement('a');
      link.href = 'https://github.com/bitsocialnet/seedit/releases/latest';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    }
  };

  const isMobile = useIsMobile();
  const [showExpando, setShowExpando] = useState(false);

  return (
    <div className={`${isMobile ? styles.mobileSidebar : styles.sidebar}`}>
      <div className={styles.searchBarWrapper}>
        <SearchBar onExpandoChange={setShowExpando} />
      </div>
      <div
        className={styles.contentWrapper}
        style={{
          transform: showExpando ? 'translateY(47px)' : 'translateY(0)',
          transition: 'transform 0.3s linear',
          willChange: 'transform',
          marginTop: '-47px',
        }}
      >
        {(isInPostPageView || isInPendingPostView) && <PostInfo comment={comment} />}
        {(isInCommunityView || isInHomeView || isInAllView || isInModView || isInDomainView || isInPendingPostView) && (
          <Link to={submitRoute}>
            <div className={styles.largeButton}>
              {t('submit_post')}
              <div className={styles.nub} />
            </div>
          </Link>
        )}
        {showsCommunityTitleBox && (
          <div className={styles.titleBox}>
            <Link className={styles.title} to={directoryCode ? `/s/${directoryCode}` : address ? getCommunityPath(address) : '/communities'}>
              {directoryCode || getDisplayAddress(community?.address || '')}
            </Link>
            {directoryCode && address && (
              <div className={styles.directoryRouteDisclosure}>
                {t('directory_route_currently_recommends', { directoryCode })} <Link to={getCommunityPath(address)}>{getDisplayAddress(address)}</Link>
                {' — '}
                <Link to={getDirectoryCandidatesPath(directoryCode)}>{t('directory_see_candidates')}</Link>
              </div>
            )}
            <div className={styles.subscribeContainer}>
              <span className={styles.subscribeButton}>
                <SubscribeButton address={address} directoryCode={directoryCode} directoryRevision={directoryRevision} />
              </span>
              <span className={styles.subscribers}>{t('members_count', { count: allActiveUserCount })}</span>
            </div>
            {directoryCode && directoryRevision && address && (
              <DirectoryAutoSwitchControl address={address} directoryCode={directoryCode} directoryRevision={directoryRevision} />
            )}
            <div className={styles.onlineLine}>
              <span className={`${styles.onlineIndicator} ${!isOffline ? styles.online : styles.offline}`} title={!isOffline ? t('online') : t('offline')} />
              <span>{isSubCreatedButNotYetPublished ? subCreatedButNotYetPublishedStatus : onlineStatus}</span>
              {moderatorRole && (
                <div className={styles.moderatorStatus}>
                  {moderatorRole === 'moderator' ? t('you_are_moderator') : moderatorRole === 'admin' ? t('you_are_admin') : t('you_are_owner')}
                </div>
              )}
            </div>
            {description && description.length > 0 && (
              <div>
                {title && title.length > 0 && (
                  <div className={styles.descriptionTitle}>
                    <strong>{title}</strong>
                  </div>
                )}
                <div className={styles.description}>
                  <Markdown content={description} />
                </div>
              </div>
            )}
            {rules && rules.length > 0 && <RulesList rules={rules} />}
            <div className={styles.bottom}>
              {t('created_by', { creatorAddress: '' })}
              <span>{`u/${creatorAddress}`}</span>
              {createdAt && <span className={styles.age}> {t('community_for', { date: getFormattedTimeDuration(createdAt) })}</span>}
              <div className={styles.bottomButtons}>
                {showBlockConfirm ? (
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
                  <span className={styles.blockSub} onClick={blockConfirm}>
                    {blocked ? t('unblock_community') : t('block_community')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {(moderatorRole || isOwner) && <ModerationTools address={address} />}
        {isInCommunitiesDirectoryView && (
          <a href={directoryProposalUrl} target='_blank' rel='noopener noreferrer'>
            <div className={styles.largeButton}>
              <div className={styles.nub} />
              {t(proposedDirectoryCode ? 'submit_community' : 'propose_new_directory')}
            </div>
          </a>
        )}
        <div className={styles.largeButton} onClick={handleCreateCommunity}>
          {t('create_your_community')}
          <div className={styles.nub} />
        </div>
        <div className={styles.communitySubtitles}>
          <span className={styles.createCommunityImage}>
            <img src='assets/sprout/sprout-2.png' alt='' />
          </span>
          {subtitle1 && <div className={styles.createCommunitySubtitle}>{subtitle1}</div>}
          {subtitle2 && <div className={styles.createCommunitySubtitle}>{subtitle2}</div>}
        </div>
        {roles && Object.keys(roles).length > 0 && <ModeratorsList roles={roles} />}
        {(!(isMobile && isInHomeAboutView) || isInCommunityAboutView || isInPostPageAboutView) && <Footer />}
        {address && !(moderatorRole || isOwner) && (
          <div className={styles.readOnlySettingsLink}>
            <Link to={`${getCommunityPath(address)}/settings`}>{t('community_settings')}</Link>
          </div>
        )}
        {isMobile && isInHomeAboutView && <FAQ footer={<Footer />} />}
      </div>
    </div>
  );
};

export default Sidebar;
