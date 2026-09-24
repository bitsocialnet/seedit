import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import { sortTypes } from '../../constants/sort-types';
import { sortLabels } from '../../constants/sort-labels';
import {
  getAboutLink,
  isAllView,
  isAllAboutView,
  isAuthorView,
  isAuthorCommentsView,
  isAuthorSubmittedView,
  isChangelogView,
  isCreateCommunityView,
  isGoldView,
  isHomeAboutView,
  isHomeView,
  isInboxView,
  isModView,
  isPendingPostView,
  isPostPageView,
  isProfileView,
  isProfileCommentsView,
  isProfileDownvotedView,
  isProfileSubmittedView,
  isProfileHiddenView,
  isProfileSavedView,
  isSettingsView,
  isSubmitView,
  isCommunityView,
  isCommunitySettingsView,
  isCommunitySubmitView,
  isCommunitiesView,
  isCommunitiesSubscriberView,
  isCommunitiesModeratorView,
  isCommunitiesAdminView,
  isCommunitiesDirectoryAboutView,
  isCommunitiesDirectoryView,
  isCommunitiesOwnerView,
  isProfileUpvotedView,
  isSettingsContentOptionsView,
  isSettingsDebugView,
  isSettingsAdvancedView,
  isSettingsP2pStatsView,
  isCommunityAboutView,
  isDomainView,
  isPostPageAboutView,
  isSearchView,
  isSettingsAccountDataView,
} from '../../lib/utils/view-utils';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { DIRECTORY_INDEX_PATH, getCommunityPath, getCommunityPostPath, getDirectoryCandidatesPath } from '../../lib/utils/community-route-utils';
import useContentOptionsStore from '../../stores/use-content-options-store';
import useNotFoundStore from '../../stores/use-not-found-store';
import { useIsNsfwCommunity } from '../../hooks/use-is-nsfw-community';
import useTheme from '../../hooks/use-theme';
import useWindowWidth from '../../hooks/use-window-width';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useOptionalAccountComment from '../../hooks/use-account-comment';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import styles from './header.module.css';

const AboutButton = () => {
  const { t } = useTranslation();
  const params = useParams();
  const location = useLocation();
  const { communityAddress: routeCommunityAddress } = useResolvedCommunityRoute();
  const aboutLink = routeCommunityAddress
    ? params.commentCid
      ? `${getCommunityPostPath(routeCommunityAddress, params.commentCid)}/about`
      : `${getCommunityPath(routeCommunityAddress)}/about`
    : getAboutLink(location.pathname, params);
  const isInHomeAboutView = isHomeAboutView(location.pathname);
  const isInPostPageAboutView = isPostPageAboutView(location.pathname, params);
  const isInCommunityAboutView = isCommunityAboutView(location.pathname, params);
  const isInCommunitiesDirectoryAboutView = isCommunitiesDirectoryAboutView(location.pathname);

  return (
    <li
      className={`${styles.about} ${
        isInHomeAboutView || isInCommunityAboutView || isInPostPageAboutView || isInCommunitiesDirectoryAboutView ? styles.selected : styles.choice
      }`}
    >
      <Link to={aboutLink}>{t('about')}</Link>
    </li>
  );
};

const CommentsButton = () => {
  const { t } = useTranslation();
  const params = useParams();
  const location = useLocation();
  const isInPostPageView = isPostPageView(location.pathname, params);
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const isInHomeAboutView = isHomeAboutView(location.pathname);
  const isInPostPageAboutView = isPostPageAboutView(location.pathname, params);
  const { communityAddress } = useResolvedCommunityRoute();

  return (
    <li className={(isInPostPageView || isInPendingPostView) && !isInHomeAboutView && !isInPostPageAboutView ? styles.selected : styles.choice}>
      <Link
        to={communityAddress && params.commentCid ? getCommunityPostPath(communityAddress, params.commentCid) : '/'}
        onClick={(e) => isInPendingPostView && e.preventDefault()}
      >
        {t('comments')}
      </Link>
    </li>
  );
};

const SortItems = () => {
  const { t } = useTranslation();
  const params = useParams();
  const location = useLocation();
  const isInHomeAboutView = isHomeAboutView(location.pathname);
  const isInPostPageAboutView = isPostPageAboutView(location.pathname, params);
  const isInCommunityAboutView = isCommunityAboutView(location.pathname, params);
  const isInAllView = isAllView(location.pathname);
  const isInModView = isModView(location.pathname);
  const isInDomainView = isDomainView(location.pathname);
  const isInCommunityView = isCommunityView(location.pathname, params);
  const { communityAddress } = useResolvedCommunityRoute();
  // Derive selection directly from route instead of syncing via an effect
  const selectedSortType = isInHomeAboutView || isInCommunityAboutView || isInPostPageAboutView ? '' : params.sortType || 'hot';

  return sortTypes.map((sortType, index) => {
    let sortLink = isInCommunityView
      ? `${communityAddress ? getCommunityPath(communityAddress) : ''}/${sortType}`
      : isInAllView
        ? `/s/all/${sortType}`
        : isInModView
          ? `/s/mod/${sortType}`
          : isInDomainView
            ? `/domain/${params.domain}/${sortType}`
            : sortType;
    return (
      <li key={sortType} className={selectedSortType === sortType ? styles.selected : styles.choice}>
        <Link to={sortLink}>{t(sortLabels[index])}</Link>
      </li>
    );
  });
};

const AuthorHeaderTabs = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const params = useParams();
  const isInAuthorView = isAuthorView(location.pathname);
  const isInAuthorCommentsView = isAuthorCommentsView(location.pathname, params);
  const isInAuthorSubmittedView = isAuthorSubmittedView(location.pathname, params);
  const isInProfileDownvotedView = isProfileDownvotedView(location.pathname);
  const isInProfileView = isProfileView(location.pathname);
  const isInProfileCommentsView = isProfileCommentsView(location.pathname);
  const isInProfileSubmittedView = isProfileSubmittedView(location.pathname);
  const isInProfileUpvotedView = isProfileUpvotedView(location.pathname);
  const isInProfileHiddenView = isProfileHiddenView(location.pathname);
  const isInProfileSavedView = isProfileSavedView(location.pathname);

  const authorRoute = `/u/${params.authorAddress}/comments/${params.commentCid}`;
  const overviewSelectedClass =
    (isInProfileView || isInAuthorView) &&
    !isInProfileUpvotedView &&
    !isInProfileDownvotedView &&
    !isInProfileCommentsView &&
    !isInProfileSubmittedView &&
    !isInAuthorCommentsView &&
    !isInProfileHiddenView &&
    !isInProfileSavedView &&
    !isInAuthorSubmittedView
      ? styles.selected
      : styles.choice;

  return (
    <>
      <li className={overviewSelectedClass}>
        <Link to={isInAuthorView ? authorRoute : '/profile'}>{t('overview')}</Link>
      </li>
      <li className={isInProfileCommentsView || isInAuthorCommentsView ? styles.selected : styles.choice}>
        <Link to={isInAuthorView ? authorRoute + '/comments' : '/profile/comments'}>{t('comments')}</Link>
      </li>
      <li className={isInProfileSubmittedView || isInAuthorSubmittedView ? styles.selected : styles.choice}>
        <Link to={isInAuthorView ? authorRoute + '/submitted' : '/profile/submitted'}>{t('submitted')}</Link>
      </li>
      {isInProfileView && (
        <>
          <li className={isInProfileUpvotedView ? styles.selected : styles.choice}>
            <Link to='/profile/upvoted'>{t('upvoted')}</Link>
          </li>
          <li className={isInProfileDownvotedView ? styles.selected : styles.choice}>
            <Link to='/profile/downvoted'>{t('downvoted')}</Link>
          </li>
          <li className={isInProfileHiddenView ? styles.selected : styles.choice}>
            <Link to={'/profile/hidden'}>{t('hidden')}</Link>
          </li>
          <li className={isInProfileSavedView ? styles.selected : styles.choice}>
            <Link to='/profile/saved'>{t('saved')}</Link>
          </li>
        </>
      )}
    </>
  );
};

const InboxHeaderTabs = () => {
  const { t } = useTranslation();

  return (
    <>
      <li className={styles.selected}>
        <Link to={'/inbox'}>{t('inbox')}</Link>
      </li>
      {/* TODO: add tabs for messaging when available in the API */}
    </>
  );
};

const CommunitiesHeaderTabs = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isInCommunitiesSubscriberView = isCommunitiesSubscriberView(location.pathname);
  const isInCommunitiesModeratorView = isCommunitiesModeratorView(location.pathname);
  const isInCommunitiesAdminView = isCommunitiesAdminView(location.pathname);
  const isInCommunitiesOwnerView = isCommunitiesOwnerView(location.pathname);
  const isInCommunitiesDirectoryView = isCommunitiesDirectoryView(location.pathname);
  const isInCommunitiesDirectoryAboutView = isCommunitiesDirectoryAboutView(location.pathname);
  const isInCommunitiesView =
    isCommunitiesView(location.pathname) &&
    !isInCommunitiesSubscriberView &&
    !isInCommunitiesModeratorView &&
    !isInCommunitiesAdminView &&
    !isInCommunitiesOwnerView &&
    !isInCommunitiesDirectoryView;

  return (
    <>
      <li className={`${isInCommunitiesDirectoryView && !isInCommunitiesDirectoryAboutView ? styles.selected : styles.choice}`}>
        <Link to={DIRECTORY_INDEX_PATH}>{t('directories')}</Link>
      </li>
      <li
        className={
          isInCommunitiesSubscriberView || isInCommunitiesModeratorView || isInCommunitiesAdminView || isInCommunitiesOwnerView || isInCommunitiesView
            ? styles.selected
            : styles.choice
        }
      >
        <Link to={'/communities'}>{t('my_communities')}</Link>
      </li>
    </>
  );
};

const SettingsHeaderTabs = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isInSettingsAdvancedView = isSettingsAdvancedView(location.pathname);
  const isInSettingsP2pStatsView = isSettingsP2pStatsView(location.pathname);
  const isInSettingsContentOptionsView = isSettingsContentOptionsView(location.pathname);
  const isInSettingsDebugView = isSettingsDebugView(location.pathname);
  const isInSettingsAccountDataView = isSettingsAccountDataView(location.pathname);

  return (
    <>
      <li
        className={
          isInSettingsAdvancedView || isInSettingsP2pStatsView || isInSettingsContentOptionsView || isInSettingsDebugView || isInSettingsAccountDataView
            ? styles.choice
            : styles.selected
        }
      >
        <Link to={'/settings'}>{t('general')}</Link>
      </li>
      <li className={isInSettingsContentOptionsView ? styles.selected : styles.choice}>
        <Link to={'/settings/content-options'}>{t('content_options')}</Link>
      </li>
      <li className={isInSettingsAdvancedView ? styles.selected : styles.choice}>
        <Link to={'/settings/advanced'}>{t('advanced')}</Link>
      </li>
      <li className={isInSettingsP2pStatsView ? styles.selected : styles.choice}>
        <Link to={'/settings/p2p-stats'}>{t('p2p_stats')}</Link>
      </li>
      {import.meta.env.DEV && (
        <li className={isInSettingsDebugView ? styles.selected : styles.choice}>
          <Link to={'/settings/debug'}>{t('debug')}</Link>
        </li>
      )}
    </>
  );
};

const HeaderTabs = () => {
  const params = useParams();
  const location = useLocation();
  const isInAllView = isAllView(location.pathname);
  const isInAuthorView = isAuthorView(location.pathname);
  const isInDomainView = isDomainView(location.pathname);
  const isInHomeAboutView = isHomeAboutView(location.pathname);
  const isInPostPageAboutView = isPostPageAboutView(location.pathname, params);
  const isInHomeView = isHomeView(location.pathname);
  const isInInboxView = isInboxView(location.pathname);
  const isInModView = isModView(location.pathname);
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const isInPostPageView = isPostPageView(location.pathname, params);
  const isInProfileView = isProfileView(location.pathname);
  const isInCommunityView = isCommunityView(location.pathname, params);
  const isInCommunitySettingsView = isCommunitySettingsView(location.pathname, params);
  const isInCommunitySubmitView = isCommunitySubmitView(location.pathname, params);
  const isInCommunitiesView = isCommunitiesView(location.pathname);
  const isInCreateCommunityView = isCreateCommunityView(location.pathname);
  const isInSettingsView = isSettingsView(location.pathname);
  const isInSettingsContentOptionsView = isSettingsContentOptionsView(location.pathname);
  const isInSettingsAdvancedView = isSettingsAdvancedView(location.pathname);

  if (isInPostPageView || isInPendingPostView) {
    return <CommentsButton />;
  } else if (
    isInHomeView ||
    isInHomeAboutView ||
    isInPostPageAboutView ||
    (isInCommunityView && !isInCommunitySubmitView && !isInCommunitySettingsView) ||
    isInAllView ||
    isInModView ||
    isInDomainView
  ) {
    return <SortItems />;
  } else if (isInProfileView || isInAuthorView) {
    return <AuthorHeaderTabs />;
  } else if (isInInboxView) {
    return <InboxHeaderTabs />;
  } else if (isInCommunitiesView && !isInCreateCommunityView) {
    return <CommunitiesHeaderTabs />;
  } else if (isInSettingsView || isInSettingsAdvancedView || isInSettingsContentOptionsView) {
    return <SettingsHeaderTabs />;
  }
  return null;
};

const HeaderTitle = ({ title, pendingPostCommunityAddress }: { title: string; pendingPostCommunityAddress?: string }) => {
  const account = useAccount();
  const { t } = useTranslation();
  const params = useParams();
  const location = useLocation();
  const isInAllView = isAllView(location.pathname);
  const isInAuthorView = isAuthorView(location.pathname);
  const isInChangelogView = isChangelogView(location.pathname);
  const isInDomainView = isDomainView(location.pathname);
  const isInSearchView = isSearchView(location.pathname);
  const isInGoldView = isGoldView(location.pathname);
  const isInInboxView = isInboxView(location.pathname);
  const isInModView = isModView(location.pathname);
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const isInPostPageView = isPostPageView(location.pathname, params);
  const isInProfileView = isProfileView(location.pathname);
  const isInSettingsView = isSettingsView(location.pathname);
  const isInSettingsContentOptionsView = isSettingsContentOptionsView(location.pathname);
  const isInSettingsAdvancedView = isSettingsAdvancedView(location.pathname);
  const isInSubmitView = isSubmitView(location.pathname);
  const isInCommunityView = isCommunityView(location.pathname, params);
  const isInCommunitySubmitView = isCommunitySubmitView(location.pathname, params);
  const isInCommunitySettingsView = isCommunitySettingsView(location.pathname, params);
  const isInCommunitiesView = isCommunitiesView(location.pathname);
  const isInCreateCommunityView = isCreateCommunityView(location.pathname);
  const isInNotFoundView = useNotFoundStore((state) => state.isNotFound);

  const { communityAddress } = useResolvedCommunityRoute();
  const titleCommunityAddress = isInPendingPostView ? pendingPostCommunityAddress : communityAddress;

  const { hideNsfwCommunities } = useContentOptionsStore();
  const isHiddenNsfwCommunity = useIsNsfwCommunity(communityAddress || '') && hideNsfwCommunities;

  const communityTitle = (
    <Link to={titleCommunityAddress ? getCommunityPath(titleCommunityAddress) : '/'}>
      {title || (communityAddress && getShortDisplayAddress(communityAddress)) || (pendingPostCommunityAddress && getShortDisplayAddress(pendingPostCommunityAddress))}
    </Link>
  );
  const domainTitle = <Link to={`/domain/${params.domain}`}>{params.domain}</Link>;
  const submitTitle = <span className={styles.submitTitle}>{t('submit')}</span>;
  const profileTitle = <Link to='/profile'>{getDisplayAddress(account?.author?.shortAddress || '')}</Link>;
  const authorTitle = <Link to={`/u/${params.authorAddress}/comments/${params.commentCid}`}>{params.authorAddress && getShortDisplayAddress(params.authorAddress)}</Link>;

  if (isHiddenNsfwCommunity) {
    return <span>{t('over_18')}</span>;
  } else if (isInCommunitySubmitView) {
    return (
      <>
        {communityTitle}: {submitTitle}
      </>
    );
  } else if (isInCommunitySettingsView) {
    return (
      <>
        {communityTitle}: <span className={styles.lowercase}>{t('community_settings')}</span>
      </>
    );
  } else if (isInSubmitView) {
    return submitTitle;
  } else if (isInSettingsView || isInSettingsAdvancedView || isInSettingsContentOptionsView) {
    return t('preferences');
  } else if (isInProfileView && !isInPendingPostView) {
    return profileTitle;
  } else if (isInPostPageView || isInPendingPostView || (isInCommunityView && !isInCommunitySettingsView)) {
    return communityTitle;
  } else if (isInAuthorView) {
    return authorTitle;
  } else if (isInInboxView) {
    return t('messages');
  } else if (isInCreateCommunityView) {
    return <span className={styles.lowercase}>{t('create_community')}</span>;
  } else if (isInCommunitiesView) {
    return t('communities');
  } else if (isInGoldView) {
    return <span className={`${styles.lowercase} ${styles.goldTitle}`}>seedit gold</span>;
  } else if (isInChangelogView) {
    return <span className={styles.lowercase}>changelog</span>;
  } else if (isInNotFoundView) {
    return <span className={styles.lowercase}>{t('page_not_found')}</span>;
  } else if (isInAllView) {
    return t('all');
  } else if (isInModView) {
    return <span className={styles.lowercase}>{t('communities_you_moderate')}</span>;
  } else if (isInDomainView) {
    return domainTitle;
  } else if (isInSearchView) {
    return <span className={styles.lowercase}>{t('search_results')}</span>;
  }
  return null;
};

const Header = () => {
  const { t } = useTranslation();
  const [theme] = useTheme();
  const location = useLocation();
  const params = useParams();
  const { communityAddress, directoryCode } = useResolvedCommunityRoute();
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress), onlyIfCached: true } : undefined);
  const { title } = community || {};

  const accountComment = useOptionalAccountComment(params?.accountCommentIndex);
  const pendingPostCommunityAddress = getCommentCommunityAddress(accountComment);

  const isMobile = useWindowWidth() < 640;
  const isInAllAboutView = isAllAboutView(location.pathname);
  const isInAllView = isAllView(location.pathname);
  const isInAuthorView = isAuthorView(location.pathname);
  const isInDomainView = isDomainView(location.pathname);
  const isInSearchView = isSearchView(location.pathname);
  const isInHomeView = isHomeView(location.pathname);
  const isInHomeAboutView = isHomeAboutView(location.pathname);
  const isInInboxView = isInboxView(location.pathname);
  const isInModView = isModView(location.pathname);
  const isInPostPageView = isPostPageView(location.pathname, params);
  const isInPostPageAboutView = isPostPageAboutView(location.pathname, params);
  const isInPendingPostView = isPendingPostView(location.pathname, params);
  const isInProfileView = isProfileView(location.pathname);
  const isInSettingsView = isSettingsView(location.pathname);
  const isInCommunityView = isCommunityView(location.pathname, params);
  const isInCommunityAboutView = isCommunityAboutView(location.pathname, params);
  const isInSubmitView = isSubmitView(location.pathname);
  const isInCommunitySubmitView = isCommunitySubmitView(location.pathname, params);
  const isInCommunitySettingsView = isCommunitySettingsView(location.pathname, params);
  const isInCommunitiesDirectoryView = isCommunitiesDirectoryView(location.pathname);
  const isInNotFoundView = useNotFoundStore((state) => state.isNotFound);

  const hasFewTabs = isInPostPageView || isInSubmitView || isInCommunitySubmitView || isInCommunitySettingsView || isInSettingsView || isInInboxView || isInSettingsView;
  const hasStickyHeader =
    isInHomeView ||
    isInNotFoundView ||
    (isInCommunityView &&
      !isInCommunitySubmitView &&
      !isInCommunitySettingsView &&
      !isInPostPageView &&
      !isInHomeAboutView &&
      !isInCommunityAboutView &&
      !isInPostPageAboutView) ||
    (isInProfileView && !isInHomeAboutView) ||
    (isInAllView && !isInAllAboutView) ||
    (isInModView && !isInHomeAboutView) ||
    (isInDomainView && !isInHomeAboutView) ||
    (isInSearchView && !isInHomeAboutView) ||
    (isInAuthorView && !isInHomeAboutView);

  const { hideNsfwCommunities } = useContentOptionsStore();
  const isHiddenNsfwCommunity = useIsNsfwCommunity(communityAddress || '') && hideNsfwCommunities;

  const mobileSubmitButtonRoute =
    isInHomeView || isInHomeAboutView || isInAllView || isInModView || isInDomainView
      ? '/submit'
      : isInPendingPostView
        ? pendingPostCommunityAddress
          ? `${getCommunityPath(pendingPostCommunityAddress)}/submit`
          : '/submit'
        : communityAddress
          ? `${getCommunityPath(communityAddress)}/submit`
          : '/submit';

  return (
    <div className={styles.header}>
      <div
        className={`${styles.container} ${hasFewTabs && styles.reducedHeight} ${
          isInSubmitView && isInCommunitySubmitView && !isInCommunityView && isMobile && styles.reduceSubmitPageHeight
        } ${hasStickyHeader && styles.increasedHeight}`}
      >
        <div className={styles.logoContainer}>
          <Link to='/' className={styles.logoLink}>
            {/* Intrinsic sizes reserve the logo's space before the images load, so the header does not grow. */}
            <img className={styles.logo} src='assets/sprout/sprout.png' width={61} height={100} alt='' />
            <img src={`assets/sprout/seedit-text-${theme === 'dark' ? 'dark' : 'light'}.svg`} className={styles.logoText} width={1028} height={320} alt='' />
          </Link>
        </div>
        {!isInHomeView && !isInHomeAboutView && !isInModView && !isInAllView && (
          <span className={`${styles.pageName} ${styles.soloPageName}`}>
            <HeaderTitle title={title} pendingPostCommunityAddress={pendingPostCommunityAddress} />
          </span>
        )}
        {(isInModView || isInAllView) && (
          <div className={`${styles.pageName} ${styles.allOrModPageName}`}>
            <HeaderTitle title={title} pendingPostCommunityAddress={pendingPostCommunityAddress} />
          </div>
        )}
        {!isMobile && !isHiddenNsfwCommunity && (
          <ul className={styles.tabMenu}>
            <HeaderTabs />
            {(isInHomeView || isInHomeAboutView) && <AboutButton />}
          </ul>
        )}
      </div>
      {isMobile && directoryCode && communityAddress && isInCommunityView && !isInPostPageView && !isInCommunitySubmitView && !isInCommunitySettingsView && (
        <div className={styles.mobileDirectoryDisclosure}>
          {t('directory_route_currently_recommends', { directoryCode })} <Link to={getCommunityPath(communityAddress)}>{getDisplayAddress(communityAddress)}</Link>
          {' — '}
          <Link to={getDirectoryCandidatesPath(directoryCode)}>{t('directory_see_candidates')}</Link>
        </div>
      )}
      {isMobile && !isInCommunitySubmitView && !isHiddenNsfwCommunity && (
        <ul className={`${styles.tabMenu} ${isInProfileView || isInSettingsView ? styles.horizontalScroll : ''}`}>
          <HeaderTabs />
          {(isInHomeView || isInHomeAboutView || isInCommunityView || isInPostPageView || isInCommunitiesDirectoryView) && <AboutButton />}
          {!isInSubmitView && !isInSettingsView && !isInCommunitiesDirectoryView && (
            <li>
              <Link to={mobileSubmitButtonRoute} className={styles.submitButton}>
                {t('submit')}
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default Header;
