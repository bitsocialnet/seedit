import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Comment, useAccount, useBlock, Role, Subplebbit, useSubplebbitStats, useAccountComment, usePlebbitRpcSettings } from '@plebbit/plebbit-react-hooks';
import Plebbit from '@plebbit/plebbit-js';
import { getPostScore } from '../../lib/utils/post-utils';
import { getFormattedDate, getFormattedTimeDuration, getFormattedTimeAgo } from '../../lib/utils/time-utils';
import { findSubplebbitCreator } from '../../lib/utils/user-utils';
import {
  isAllView,
  isDomainView,
  isHomeAboutView,
  isHomeView,
  isModView,
  isPendingPostView,
  isPostPageAboutView,
  isPostPageView,
  isSubplebbitAboutView,
  isSubplebbitSettingsView,
  isSubplebbitsView,
  isSubplebbitView,
} from '../../lib/utils/view-utils';
import useCommunitySubtitles from '../../hooks/use-community-subtitles';
import useIsMobile from '../../hooks/use-is-mobile';
import useIsSubplebbitOffline from '../../hooks/use-is-subplebbit-offline';
import { FAQ } from '../../views/about/about';
import LoadingEllipsis from '../loading-ellipsis';
import Markdown from '../markdown';
import SearchBar from '../search-bar';
import SubscribeButton from '../subscribe-button';
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

const ModeratorsList = ({ roles }: { roles: Record<string, Role> }) => {
  const { t } = useTranslation();
  const rolesList = roles ? Object.entries(roles).map(([address, { role }]) => ({ address, role })) : [];

  return (
    <div className={styles.list}>
      <div className={styles.listTitle}>{t('moderators')}</div>
      <ul className={`${styles.listContent} ${styles.modsList}`}>
        {rolesList.map(({ address }, index) => (
          <li key={index} onClick={() => window.alert('Direct profile links are not supported yet.')}>
            u/{Plebbit.getShortAddress({ address })}
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
  const { upvoteCount, downvoteCount, timestamp, state, subplebbitAddress, cid } = comment || {};
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
      {subplebbitAddress && cid && (
        <div className={styles.shareLink}>
          {t('share_link')}: <input type='text' value={`https://seedit.app/s/${subplebbitAddress}/c/${cid}`} readOnly={true} />
        </div>
      )}
    </div>
  );
};

const ModerationTools = ({ address }: { address?: string }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const params = useParams();
  const isInSubplebbitSettingsView = isSubplebbitSettingsView(location.pathname, params);

  return (
    <div className={styles.list}>
      <div className={styles.listTitle}>{t('moderation_tools')}</div>
      <ul className={`${styles.listContent} ${styles.modsList}`}>
        <li className={`${styles.moderationTool} ${isInSubplebbitSettingsView ? styles.selectedTool : ''}`}>
          <Link className={styles.communitySettingsTool} to={`/s/${address}/settings`}>
            {t('community_settings')}
          </Link>
        </li>
      </ul>
    </div>
  );
};

interface SidebarProps {
  comment?: Comment;
  isSubCreatedButNotYetPublished?: boolean;
  settings?: any;
  subplebbit?: Subplebbit;
  reset?: () => void;
}

export const Footer = () => {
  const location = useLocation();
  const params = useParams();
  const isMobile = useIsMobile();
  const isInHomeAboutView = isHomeAboutView(location.pathname);
  const isInPostPageAboutView = isPostPageAboutView(location.pathname, params);
  const isInSubplebbitView = isSubplebbitView(location.pathname, params);

  return (
    <div
      className={`${styles.footer} ${isMobile && (isInHomeAboutView || isInPostPageAboutView) ? styles.mobileFooter : ''} ${
        isInSubplebbitView ? styles.subplebbitFooterMargin : ''
      }`}
    >
      <div className={styles.footerLinks}>
        <ul>
          <li>
            <Version />
          </li>
          <span className={styles.footerSeparator}>|</span>
          <li>
            <a href='https://github.com/bitsocialnet/seedit' target='_blank' rel='noopener noreferrer'>
              github
            </a>
            <span className={styles.footerSeparator}>|</span>
          </li>
          <li>
            <a href='https://t.me/bitsocialnet' target='_blank' rel='noopener noreferrer'>
              telegram
            </a>
            <span className={styles.footerSeparator}>|</span>
          </li>
          <li>
            <a href='https://x.com/bitsocialnet' target='_blank' rel='noopener noreferrer'>
              x
            </a>
            <span className={styles.footerSeparator}>|</span>
          </li>
          <li>
            <a href='https://bitsocial.net' target='_blank' rel='noopener noreferrer'>
              docs
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

const Sidebar = ({ comment, isSubCreatedButNotYetPublished, settings, subplebbit, reset }: SidebarProps) => {
  const { t } = useTranslation();
  const { address, createdAt, description, roles, rules, title, updatedAt } = subplebbit || {};
  const { allActiveUserCount, hourActiveUserCount } = useSubplebbitStats({ subplebbitAddress: address });
  const { isOffline, offlineTitle } = useIsSubplebbitOffline(subplebbit || {});
  const onlineNotice = t('users_online', { count: hourActiveUserCount || 0 });
  const offlineNotice = updatedAt ? t('posts_last_synced', { dateAgo: getFormattedTimeAgo(updatedAt) }) : offlineTitle;
  const onlineStatus = !isOffline ? onlineNotice : offlineNotice;

  const subCreatedButNotYetPublishedStatus = <LoadingEllipsis string='Publishing community over IPFS' />;

  const location = useLocation();
  const params = useParams();
  const isInAllView = isAllView(location.pathname);
  const isInDomainView = isDomainView(location.pathname);
  const isInHomeAboutView = isHomeAboutView(location.pathname);
  const isInPostPageAboutView = isPostPageAboutView(location.pathname, params);
  const isInHomeView = isHomeView(location.pathname);
  const isInModView = isModView(location.pathname);
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const isInPostPageView = isPostPageView(location.pathname, params);
  const isInSubplebbitsView = isSubplebbitsView(location.pathname);
  const isInSubplebbitAboutView = isSubplebbitAboutView(location.pathname, params);
  const isInSubplebbitView = isSubplebbitView(location.pathname, params);

  const pendingPost = useAccountComment({ commentIndex: params?.accountCommentIndex as any });

  const subplebbitCreator = findSubplebbitCreator(roles);
  const creatorAddress = subplebbitCreator === 'anonymous' ? 'anonymous' : `${Plebbit.getShortAddress({ address: subplebbitCreator })}`;
  const submitRoute =
    isInHomeView || isInHomeAboutView || isInAllView || isInModView || isInDomainView
      ? '/submit'
      : isInPendingPostView
        ? `/s/${pendingPost?.subplebbitAddress}/submit`
        : address || params?.subplebbitAddress
          ? `/s/${address || params?.subplebbitAddress}/submit`
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

  const [subtitle1, setSubtitle1] = useState('');
  const [subtitle2, setSubtitle2] = useState('');

  const communitySubtitles = useCommunitySubtitles();

  useEffect(() => {
    if (communitySubtitles.length >= 2) {
      const indices = new Set<number>();
      while (indices.size < 2) {
        const randomIndex = Math.floor(Math.random() * communitySubtitles.length);
        indices.add(randomIndex);
      }
      const [index1, index2] = Array.from(indices);
      setSubtitle1(communitySubtitles[index1]);
      setSubtitle2(communitySubtitles[index2]);
    } else if (communitySubtitles.length === 1) {
      setSubtitle1(communitySubtitles[0]);
      setSubtitle2('');
    }
  }, [communitySubtitles]);

  const isConnectedToRpc = usePlebbitRpcSettings()?.state === 'connected';
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

  const handleSearchBarExpandoChange = (expanded: boolean) => {
    setShowExpando(expanded);
  };

  return (
    <div className={`${isMobile ? styles.mobileSidebar : styles.sidebar}`}>
      <div className={styles.searchBarWrapper}>
        <SearchBar onExpandoChange={handleSearchBarExpandoChange} />
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
        {(isInSubplebbitView || isInHomeView || isInAllView || isInModView || isInDomainView || isInPendingPostView) && (
          <Link to={submitRoute}>
            <div className={styles.largeButton}>
              {t('submit_post')}
              <div className={styles.nub} />
            </div>
          </Link>
        )}
        {!isInHomeView &&
          !isInHomeAboutView &&
          !isInAllView &&
          !isInModView &&
          !isInSubplebbitsView &&
          !isInHomeAboutView &&
          !isInDomainView &&
          !isInPostPageAboutView && (
            <div className={styles.titleBox}>
              <Link className={styles.title} to={`/s/${address}`}>
                {subplebbit?.address}
              </Link>
              <div className={styles.subscribeContainer}>
                <span className={styles.subscribeButton}>
                  <SubscribeButton address={address} />
                </span>
                <span className={styles.subscribers}>{t('members_count', { count: allActiveUserCount })}</span>
              </div>
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
        {isInSubplebbitsView && (
          <a href='https://github.com/bitsocialnet/lists' target='_blank' rel='noopener noreferrer'>
            <div className={styles.largeButton}>
              <div className={styles.nub} />
              {t('submit_community')}
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
        {(!(isMobile && isInHomeAboutView) || isInSubplebbitAboutView || isInPostPageAboutView) && <Footer />}
        {address && !(moderatorRole || isOwner) && (
          <div className={styles.readOnlySettingsLink}>
            <Link to={`/s/${address}/settings`}>{t('community_settings')}</Link>
          </div>
        )}
        {isMobile && isInHomeAboutView && <FAQ />}
      </div>
    </div>
  );
};

export default Sidebar;
