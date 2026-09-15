import { useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Community as CommunityType, useAccount, useAccountCommunities, useCommunities } from '@bitsocial/bitsocial-react-hooks';
import styles from './communities.module.css';
import {
  isCommunitiesView,
  isCommunitiesSubscriberView,
  isCommunitiesModeratorView,
  isCommunitiesAdminView,
  isCommunitiesOwnerView,
  isCommunitiesDirectoryView,
} from '../../lib/utils/view-utils';
import { isDirectoryCode } from '../../lib/utils/directory-codes';
import useErrorStore from '../../stores/use-error-store';
import { getCommunityIdentifiers } from '../../hooks/use-community-identifier';
import { useDefaultSubscriptions } from '../../hooks/use-default-subscriptions';
import { deriveCommunityNsfw } from '../../lib/utils/nsfw-utils';
import useDisplayedSubscriptions from '../../hooks/use-displayed-subscriptions';
import ErrorDisplay from '../../components/error-display';
import Sidebar from '../../components/sidebar';
import _ from 'lodash';
import CommunityItem, { NoCommunitiesMessage } from './community-item';
import { DirectoryCandidates, DirectoryIndex, DirectoryVoteNotice } from './directory-vote';

const MyCommunitiesTabs = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isInCommunitiesSubscriberView = isCommunitiesSubscriberView(location.pathname);
  const isInCommunitiesModeratorView = isCommunitiesModeratorView(location.pathname);
  const isInCommunitiesAdminView = isCommunitiesAdminView(location.pathname);
  const isInCommunitiesOwnerView = isCommunitiesOwnerView(location.pathname);
  const isInCommunitiesView =
    isCommunitiesView(location.pathname) && !isInCommunitiesSubscriberView && !isInCommunitiesModeratorView && !isInCommunitiesAdminView && !isInCommunitiesOwnerView;

  return (
    <div className={styles.communitiesTabs}>
      <Link to='/communities' className={isInCommunitiesView ? styles.selected : styles.choice}>
        {t('all')}
      </Link>
      <span className={styles.separator}>|</span>
      <Link to='/communities/subscriber' className={isInCommunitiesSubscriberView ? styles.selected : styles.choice}>
        {t('subscriber')}
      </Link>
      <span className={styles.separator}>|</span>
      <Link to='/communities/moderator' className={isInCommunitiesModeratorView ? styles.selected : styles.choice}>
        {t('moderator')}
      </Link>
      <span className={styles.separator}>|</span>
      <Link to='/communities/admin' className={isInCommunitiesAdminView ? styles.selected : styles.choice}>
        {t('admin')}
      </Link>
      <span className={styles.separator}>|</span>
      <Link to='/communities/owner' className={isInCommunitiesOwnerView ? styles.selected : styles.choice}>
        {t('owner')}
      </Link>
    </div>
  );
};

const Infobar = () => {
  const account = useAccount();
  const { accountCommunities, error: accountCommunitiesError } = useAccountCommunities();
  const setError = useErrorStore((state) => state.setError);

  useEffect(() => {
    setError('Infobar_useAccountCommunities', accountCommunitiesError);
  }, [accountCommunitiesError, setError]);

  const subscriptions = account?.subscriptions || [];
  const { t } = useTranslation();
  const location = useLocation();

  const isInCommunitiesSubscriberView = isCommunitiesSubscriberView(location.pathname);
  const isInCommunitiesModeratorView = isCommunitiesModeratorView(location.pathname);
  const isInCommunitiesAdminView = isCommunitiesAdminView(location.pathname);
  const isInCommunitiesOwnerView = isCommunitiesOwnerView(location.pathname);

  // Check if we're filtering by any tag
  const urlParams = new URLSearchParams(location.search);
  const currentTag = urlParams.get('tag');

  // Get base path without search params
  const basePath = location.pathname;

  let mainInfobarText;
  if (isInCommunitiesSubscriberView) {
    mainInfobarText = subscriptions.length === 0 ? t('not_subscribed') : t('below_subscribed');
  } else if (isInCommunitiesModeratorView || isInCommunitiesAdminView || isInCommunitiesOwnerView) {
    mainInfobarText = Object.keys(accountCommunities).length > 0 ? t('below_moderator_access') : t('not_moderator');
  } else if (subscriptions.length === 0 && Object.keys(accountCommunities).length === 0) {
    mainInfobarText = t('not_subscriber_nor_moderator');
  } else {
    mainInfobarText = (
      <Trans i18nKey='join_communities_notice' values={{ join: t('join'), leave: t('leave') }} components={{ 1: <code key='join' />, 2: <code key='leave' /> }} />
    );
  }

  return (
    <>
      <div className={styles.infobar}>
        <div>{mainInfobarText}</div>
      </div>
      {currentTag && (
        <div className={styles.infobar}>
          {currentTag === 'nsfw' ? t('filtering_by_nsfw') + ' —' : t('filtering_by_tag', { tag: currentTag }) + ' —'}{' '}
          <Link className={styles.undoLink} to={basePath}>
            {t('undo')}
          </Link>
        </div>
      )}
    </>
  );
};

const AccountCommunities = ({ viewRole }: { viewRole: string }) => {
  const account = useAccount();
  const { accountCommunities, error: accountCommunitiesError } = useAccountCommunities();
  const setError = useErrorStore((state) => state.setError);
  const location = useLocation();
  const defaultCommunities = useDefaultSubscriptions();

  useEffect(() => {
    setError('AccountCommunities_useAccountCommunities', accountCommunitiesError);
  }, [accountCommunitiesError, setError, viewRole]);

  const urlParams = new URLSearchParams(location.search);
  const currentTag = urlParams.get('tag');

  const communityElements = Object.values(accountCommunities)
    .filter((community: any) => {
      const isUserOwner = community.settings !== undefined;
      const userRole = (community as any).roles?.[account?.author?.address]?.role;
      return isUserOwner || userRole === viewRole;
    })
    .filter((communityData: any) => {
      if (currentTag) {
        const defaultCommunity = defaultCommunities.find((defaultSub) => defaultSub.address === (communityData as any).address);

        if (currentTag === 'nsfw') {
          return deriveCommunityNsfw(communityData, defaultCommunity) === true;
        }
        return Boolean(defaultCommunity?.tags?.includes(currentTag));
      }
      return true;
    })
    .map((communityData, index) => {
      const defaultCommunity = defaultCommunities.find((defaultSub) => defaultSub.address === (communityData as any).address);
      return (
        <CommunityItem
          key={communityData.address}
          community={communityData}
          nsfw={deriveCommunityNsfw(communityData, defaultCommunity)}
          tags={defaultCommunity?.tags}
          index={index}
        />
      );
    });

  if (communityElements.length === 0) {
    return <NoCommunitiesMessage />;
  }
  return <>{communityElements}</>;
};

const SubscriberCommunities = () => {
  const account = useAccount();
  const setError = useErrorStore((state) => state.setError);
  const location = useLocation();
  const defaultCommunities = useDefaultSubscriptions();

  const urlParams = new URLSearchParams(location.search);
  const currentTag = urlParams.get('tag');

  const getAccountSubscriptions = useCallback(() => {
    return account?.subscriptions ? [...account.subscriptions].reverse() : [];
  }, [account?.subscriptions]);

  const {
    list: displayedSubscriptions,
    isUnsubscribed,
    handleUnsubscribe,
  } = useDisplayedSubscriptions(
    getAccountSubscriptions,
    [account?.author?.address], // Reset dependencies
  );

  const { communities, error: communitiesError } = useCommunities({ communities: getCommunityIdentifiers(displayedSubscriptions) });

  useEffect(() => {
    setError('SubscriberCommunities_useCommunities', communitiesError);
  }, [communitiesError, setError]);

  const communityElements = Object.values(communities ?? {})
    .filter((community): community is CommunityType => Boolean(community))
    .filter((communityData) => {
      if (currentTag) {
        const defaultCommunity = defaultCommunities.find((defaultSub) => defaultSub.address === communityData.address);
        if (currentTag === 'nsfw') {
          return deriveCommunityNsfw(communityData, defaultCommunity) === true;
        }
        return Boolean(defaultCommunity?.tags?.includes(currentTag));
      }
      return true;
    })
    .map((communityData, index) => {
      const defaultCommunity = defaultCommunities.find((defaultSub) => defaultSub.address === communityData.address);
      return (
        <CommunityItem
          key={communityData.address || index}
          community={communityData}
          nsfw={deriveCommunityNsfw(communityData, defaultCommunity)}
          tags={defaultCommunity?.tags}
          index={index}
          isUnsubscribed={isUnsubscribed(communityData.address)}
          onUnsubscribe={handleUnsubscribe}
        />
      );
    });

  if (communityElements.length === 0) {
    return <NoCommunitiesMessage />;
  }
  return <>{communityElements}</>;
};

const AllAccountCommunities = () => {
  const account = useAccount();
  const { accountCommunities, error: accountCommunitiesError } = useAccountCommunities();
  const setError = useErrorStore((state) => state.setError);
  const location = useLocation();
  const defaultCommunities = useDefaultSubscriptions();

  useEffect(() => {
    setError('AllAccountCommunities_useAccountCommunities', accountCommunitiesError);
  }, [accountCommunitiesError, setError]);

  const urlParams = new URLSearchParams(location.search);
  const currentTag = urlParams.get('tag');

  const getAllAccountRelatedAddresses = useCallback(() => {
    const accountAddrs = Object.keys(accountCommunities);
    const subs = account?.subscriptions ? [...account.subscriptions].reverse() : [];
    return Array.from(new Set([...accountAddrs, ...subs]));
  }, [accountCommunities, account?.subscriptions]);

  const { list: displayedAddresses, isUnsubscribed, handleUnsubscribe } = useDisplayedSubscriptions(getAllAccountRelatedAddresses, [account?.author?.address]);

  const { communities, error: communitiesError } = useCommunities({ communities: getCommunityIdentifiers(displayedAddresses) });

  useEffect(() => {
    setError('AllAccountCommunities_useCommunities', communitiesError);
  }, [communitiesError, setError]);

  const defaultsByAddress = new Map(defaultCommunities.map((community) => [community.address, community]));
  // The nsfw tag is decided per community below, because it can come from live protocol data.
  const isNsfwTag = currentTag === 'nsfw';
  const taggedAddresses = currentTag && !isNsfwTag ? new Set<string>() : undefined;
  if (taggedAddresses) {
    for (const community of defaultCommunities) {
      if (community.tags?.some((tag) => tag === currentTag)) taggedAddresses.add(community.address);
    }
  }
  const communityElements = Object.values(communities ?? {}).reduce<React.JSX.Element[]>((elements, communityData) => {
    if (!communityData) return elements;
    const defaultCommunity = defaultsByAddress.get(communityData.address);
    const nsfw = deriveCommunityNsfw(communityData, defaultCommunity);
    const matchesTag = isNsfwTag ? nsfw === true : !taggedAddresses || taggedAddresses.has(communityData.address);
    if (!matchesTag) return elements;
    elements.push(
      <CommunityItem
        key={communityData.address}
        community={communityData}
        nsfw={nsfw}
        tags={defaultCommunity?.tags}
        index={elements.length}
        isUnsubscribed={isUnsubscribed(communityData.address)}
        onUnsubscribe={handleUnsubscribe}
      />,
    );
    return elements;
  }, []);

  if (communityElements.length === 0) {
    return <NoCommunitiesMessage />;
  }
  return <>{communityElements}</>;
};

const CommunitiesErrors = () => {
  const location = useLocation();
  const errors = useErrorStore((state) => state.errors);

  useEffect(() => {
    Object.entries(errors).forEach(([source, errorObj]) => {
      if (errorObj) {
        console.error(`Error from ${source}:`, errorObj.message, errorObj.stack);
      }
    });
  }, [errors]);

  const isInCommunitiesSubscriberView = isCommunitiesSubscriberView(location.pathname);
  const isInCommunitiesModeratorView = isCommunitiesModeratorView(location.pathname);
  const isInCommunitiesAdminView = isCommunitiesAdminView(location.pathname);
  const isInCommunitiesOwnerView = isCommunitiesOwnerView(location.pathname);
  const isInCommunitiesDirectoryView = isCommunitiesDirectoryView(location.pathname);
  const isInCommunitiesView =
    isCommunitiesView(location.pathname) &&
    !isInCommunitiesSubscriberView &&
    !isInCommunitiesModeratorView &&
    !isInCommunitiesAdminView &&
    !isInCommunitiesOwnerView &&
    !isInCommunitiesDirectoryView;

  const renderErrors = () => {
    const errorsToDisplay: React.JSX.Element[] = [];
    Object.entries(errors).forEach(([source, errorObj]) => {
      if (!errorObj) return;

      if (
        source === 'Infobar_useAccountCommunities' &&
        (isInCommunitiesView || isInCommunitiesSubscriberView || isInCommunitiesModeratorView || isInCommunitiesAdminView || isInCommunitiesOwnerView)
      ) {
        errorsToDisplay.push(<ErrorDisplay key={source} error={errorObj} />);
      } else if (source === 'AccountCommunities_useAccountCommunities' && (isInCommunitiesModeratorView || isInCommunitiesAdminView || isInCommunitiesOwnerView)) {
        errorsToDisplay.push(<ErrorDisplay key={source} error={errorObj} />);
      } else if (source === 'SubscriberCommunities_useCommunities' && isInCommunitiesSubscriberView) {
        errorsToDisplay.push(<ErrorDisplay key={source} error={errorObj} />);
      } else if (source === 'AllAccountCommunities_useAccountCommunities' && isInCommunitiesView) {
        errorsToDisplay.push(<ErrorDisplay key={source} error={errorObj} />);
      } else if (source === 'AllAccountCommunities_useCommunities' && isInCommunitiesView) {
        errorsToDisplay.push(<ErrorDisplay key={`${source}_communities`} error={errorObj} />);
      }
    });
    return errorsToDisplay;
  };

  return <div className={styles.error}>{renderErrors()}</div>;
};

const Communities = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { directoryCode } = useParams();
  const clearAllErrors = useErrorStore((state) => state.clearAllErrors);

  useEffect(() => {
    return () => {
      clearAllErrors();
    };
  }, [location, clearAllErrors]);

  const isInCommunitiesSubscriberView = isCommunitiesSubscriberView(location.pathname);
  const isInCommunitiesModeratorView = isCommunitiesModeratorView(location.pathname);
  const isInCommunitiesAdminView = isCommunitiesAdminView(location.pathname);
  const isInCommunitiesOwnerView = isCommunitiesOwnerView(location.pathname);
  const isInCommunitiesDirectoryView = isCommunitiesDirectoryView(location.pathname);
  const isInCommunitiesView =
    isCommunitiesView(location.pathname) &&
    !isInCommunitiesSubscriberView &&
    !isInCommunitiesModeratorView &&
    !isInCommunitiesAdminView &&
    !isInCommunitiesOwnerView &&
    !isInCommunitiesDirectoryView;

  let viewRole = 'subscriber';
  if (isInCommunitiesModeratorView) {
    viewRole = 'moderator';
  } else if (isInCommunitiesAdminView) {
    viewRole = 'admin';
  } else if (isInCommunitiesOwnerView) {
    viewRole = 'owner';
  }

  const documentTitle = useMemo(() => {
    let title = t('communities').charAt(0).toUpperCase() + t('communities').slice(1);
    if (isInCommunitiesDirectoryView) {
      title += ` - ${_.startCase(t('directories'))}`;
      // an unknown code redirects to /not-found, so it must not title the page after a directory
      if (isDirectoryCode(directoryCode)) {
        title += ` - s/${directoryCode}`;
      }
    } else if (isInCommunitiesSubscriberView) {
      title += ` - ${_.startCase(t('subscriber'))}`;
    } else if (isInCommunitiesModeratorView) {
      title += ` - ${_.startCase(t('moderator'))}`;
    } else if (isInCommunitiesAdminView) {
      title += ` - ${_.startCase(t('admin'))}`;
    } else if (isInCommunitiesOwnerView) {
      title += ` - ${_.startCase(t('owner'))}`;
    } else if (isInCommunitiesView) {
      title += ` - ${_.startCase(t('all'))}`;
    }
    return `${title} - Seedit`;
  }, [
    directoryCode,
    isInCommunitiesSubscriberView,
    isInCommunitiesModeratorView,
    isInCommunitiesAdminView,
    isInCommunitiesOwnerView,
    isInCommunitiesView,
    isInCommunitiesDirectoryView,
    t,
  ]);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div className={styles.content}>
      <div className={styles.sidebar}>
        <Sidebar />
      </div>
      {!isInCommunitiesDirectoryView && <MyCommunitiesTabs />}
      {isInCommunitiesDirectoryView ? <DirectoryVoteNotice /> : <Infobar />}
      <CommunitiesErrors />
      {isInCommunitiesDirectoryView && (directoryCode ? <DirectoryCandidates /> : <DirectoryIndex />)}
      {(isInCommunitiesModeratorView || isInCommunitiesAdminView || isInCommunitiesOwnerView) && <AccountCommunities viewRole={viewRole} />}
      {isInCommunitiesSubscriberView && <SubscriberCommunities />}
      {isInCommunitiesView && <AllAccountCommunities />}
    </div>
  );
};

export default Communities;
