import { ReactNode, useEffect, useRef, useState, useMemo, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAccount, useAccountCommunities } from '@bitsocial/bitsocial-react-hooks';
import { isAllView, isHomeView, isModView } from '../../lib/utils/view-utils';
import { getCompactCommunityDisplayName } from '../../lib/utils/address-utils';
import useContentOptionsStore from '../../stores/use-content-options-store';
import { useDefaultSubscriptions, useFilteredDefaultSubscriptions } from '../../hooks/use-default-subscriptions';
import type { DefaultSubscription } from '../../lib/utils/starter-community-list';
import { DIRECTORY_INDEX_PATH, getCommunityPath, getDirectoryPath } from '../../lib/utils/community-route-utils';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import usePrefetchIntent from '../../hooks/use-prefetch-intent';
import styles from './topbar.module.css';

const getSubscriptionDisplayName = (subscription: string) => getCompactCommunityDisplayName(subscription);

const getTopbarCommunityLink = ({ address, directoryCode }: Pick<DefaultSubscription, 'address' | 'directoryCode'>) => ({
  displayName: directoryCode ?? getSubscriptionDisplayName(address),
  path: directoryCode ? getDirectoryPath(directoryCode) : getCommunityPath(address),
});

const CommunityLink = ({ address, path, className, children }: { address: string; path: string; className: string; children: ReactNode }) => {
  const prefetchCommunity = usePrefetchIntent({ communityAddress: address });
  return (
    <Link to={path} className={className} {...prefetchCommunity}>
      {children}
    </Link>
  );
};

export const CommunitiesDropdown = () => {
  const { t } = useTranslation();
  const account = useAccount();
  const subscriptions = useMemo(() => account?.subscriptions, [account?.subscriptions]);
  const reversedSubscriptions = useMemo(() => (subscriptions ? [...subscriptions].reverse() : []), [subscriptions]);
  const defaultCommunities = useDefaultSubscriptions();
  const defaultCommunityByAddress = new Map(defaultCommunities.map((community) => [community.address, community]));

  const [isSubsDropdownOpen, setIsSubsDropdownOpen] = useState(false);
  const toggleSubsDropdown = () => setIsSubsDropdownOpen(!isSubsDropdownOpen);
  const subsDropdownRef = useRef<HTMLDivElement>(null);
  const subsdropdownItemsRef = useRef<HTMLDivElement>(null);
  const subsDropdownClass = isSubsDropdownOpen ? styles.visible : styles.hidden;

  useEffect(() => {
    if (!isSubsDropdownOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (subsDropdownRef.current && !subsDropdownRef.current.contains(event.target as Node)) {
        setIsSubsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSubsDropdownOpen]);

  return (
    <div className={`${styles.dropdown} ${styles.subsDropdown}`} ref={subsDropdownRef} onClick={toggleSubsDropdown}>
      <span className={styles.selectedTitle}>{t('my_communities')}</span>
      <div className={`${styles.dropChoices} ${styles.subsDropChoices} ${subsDropdownClass}`} ref={subsdropdownItemsRef}>
        {reversedSubscriptions?.map((subscription: string) => {
          const directoryCode = defaultCommunityByAddress.get(subscription)?.directoryCode;
          const { displayName, path } = getTopbarCommunityLink({ address: subscription, directoryCode });
          return (
            <Link key={subscription} to={path} className={styles.dropdownItem}>
              {displayName}
            </Link>
          );
        })}
        <Link to='/communities/subscriber' className={`${styles.dropdownItem} ${styles.myCommunitiesItemButtonDotted}`}>
          {t('edit_subscriptions')}
        </Link>
      </div>
    </div>
  );
};

const TopBar = memo(() => {
  const { t } = useTranslation();
  const location = useLocation();

  const isinAllView = isAllView(location.pathname);
  const isInHomeView = isHomeView(location.pathname);
  const isInModView = isModView(location.pathname);
  const homeButtonClass = isInHomeView ? styles.selected : styles.choice;

  const { hideDefaultCommunities } = useContentOptionsStore();
  const defaultCommunities = useFilteredDefaultSubscriptions();
  const { accountCommunities } = useAccountCommunities();
  const accountCommunityAddresses = useMemo(() => Object.keys(accountCommunities), [accountCommunities]);

  const account = useAccount();
  const subscriptions = useMemo(() => account?.subscriptions, [account?.subscriptions]);
  const reversedSubscriptions = useMemo(() => (subscriptions ? [...subscriptions].reverse() : []), [subscriptions]);

  const subscriptionSet = new Set(subscriptions ?? []);
  const defaultCommunityByAddress = new Map(defaultCommunities.map((community) => [community.address, community]));
  const filteredDefaultCommunities = defaultCommunities.filter(({ address }) => !subscriptionSet.has(address));
  const { communityAddress: activeCommunityAddress, directoryCode: activeDirectoryCode } = useResolvedCommunityRoute();

  return (
    <div className={styles.headerArea}>
      <div className={styles.widthClip}>
        <CommunitiesDropdown />
        <div className={styles.srList}>
          <ul className={styles.srBar}>
            <li>
              <Link to='/' className={`${styles.homeButton} ${homeButtonClass}`}>
                {t('home')}
              </Link>
            </li>
            <li>
              <span className={styles.separator}>-</span>
              <Link to='/s/all' className={isinAllView ? styles.selected : styles.choice}>
                {t('all')}
              </Link>
            </li>
            {accountCommunityAddresses.length > 0 && (
              <li>
                <span className={styles.separator}>-</span>
                <Link to='/s/mod' className={isInModView ? styles.selected : styles.choice}>
                  {t('mod')}
                </Link>
              </li>
            )}
            {subscriptions?.length > 0 && <span className={styles.separator}> | </span>}
            {reversedSubscriptions?.map((subscription: string, index: number) => {
              const directoryCode = defaultCommunityByAddress.get(subscription)?.directoryCode;
              const { displayName, path } = getTopbarCommunityLink({ address: subscription, directoryCode });
              const isActive = directoryCode ? activeDirectoryCode === directoryCode : activeCommunityAddress === subscription;
              return (
                <li key={subscription}>
                  {index !== 0 && <span className={styles.separator}>-</span>}
                  <CommunityLink address={subscription} path={path} className={isActive ? styles.selected : styles.choice}>
                    {displayName}
                  </CommunityLink>
                </li>
              );
            })}
            {!hideDefaultCommunities && filteredDefaultCommunities.length > 0 && <span className={styles.separator}> | </span>}
            {!hideDefaultCommunities &&
              filteredDefaultCommunities.map(({ address, directoryCode }, index) => {
                const { displayName, path } = getTopbarCommunityLink({ address, directoryCode });
                const isActive = directoryCode ? activeDirectoryCode === directoryCode : activeCommunityAddress === address;
                return (
                  <li key={address}>
                    {index !== 0 && <span className={styles.separator}>-</span>}
                    <CommunityLink address={address} path={path} className={isActive ? styles.selected : styles.choice}>
                      {displayName}
                    </CommunityLink>
                  </li>
                );
              })}
          </ul>
        </div>
        <Link to={DIRECTORY_INDEX_PATH} className={styles.editLink}>
          {t('edit')} »
        </Link>
      </div>
    </div>
  );
});

export default TopBar;
