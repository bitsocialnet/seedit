import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAccount, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import { getShortDisplayAddress } from '../../lib/utils/address-utils';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import { isAllView, isHomeView } from '../../lib/utils/view-utils';
import useUiModeStore from '../../stores/use-ui-mode-store';
import ModernCommunityAvatar from '../modern-community-avatar';
import { ClassicIcon, CompassIcon, GlobeIcon, HomeIcon } from '../modern-icons';
import styles from './modern-layout.module.css';

const NavCommunity = ({ address, pathname }: { address: string; pathname: string }) => {
  // Only what is already cached: the nav must not start a network load for every subscription.
  const community = useCommunity({ community: getCommunityIdentifier(address), onlyIfCached: true });
  const path = getCommunityPath(address);
  const isActive = pathname === path || pathname.startsWith(`${path}/`);

  return (
    <li>
      <Link to={path} className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`} aria-current={isActive ? 'page' : undefined} title={address}>
        <ModernCommunityAvatar address={address} avatarUrl={community?.suggested?.avatarUrl} />
        <span className={styles.navLabel}>s/{getShortDisplayAddress(address)}</span>
      </Link>
    </li>
  );
};

interface ModernNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const ModernNav = ({ isOpen, onClose }: ModernNavProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const subscriptions: string[] = useAccount()?.subscriptions ?? [];
  const setUiMode = useUiModeStore((state) => state.setUiMode);
  const isHome = isHomeView(pathname);
  const isAll = isAllView(pathname);
  const isCommunities = pathname === '/communities' || pathname.startsWith('/communities/');

  return (
    <>
      {isOpen && <button type='button' className={styles.navBackdrop} aria-label={t('close')} tabIndex={-1} onClick={onClose} />}
      <nav id='modern-nav' className={`${styles.nav} ${isOpen ? styles.navOpen : ''}`} aria-label={t('navigation_menu')}>
        <ul className={styles.navList}>
          <li>
            <Link to='/' className={`${styles.navItem} ${isHome ? styles.navItemActive : ''}`} aria-current={isHome ? 'page' : undefined}>
              <HomeIcon />
              <span className={`${styles.navLabel} ${styles.sentenceCase}`}>{t('home')}</span>
            </Link>
          </li>
          <li>
            <Link to='/s/all' className={`${styles.navItem} ${isAll ? styles.navItemActive : ''}`} aria-current={isAll ? 'page' : undefined}>
              <GlobeIcon />
              <span className={`${styles.navLabel} ${styles.sentenceCase}`}>{t('all')}</span>
            </Link>
          </li>
          <li>
            <Link to='/communities' className={`${styles.navItem} ${isCommunities ? styles.navItemActive : ''}`} aria-current={isCommunities ? 'page' : undefined}>
              <CompassIcon />
              <span className={`${styles.navLabel} ${styles.sentenceCase}`}>{t('communities')}</span>
            </Link>
          </li>
        </ul>
        <div className={styles.navSection}>
          <h2 className={styles.navHeading}>{t('my_communities')}</h2>
          {subscriptions.length > 0 ? (
            <ul className={styles.navList}>
              {subscriptions.map((address) => (
                <NavCommunity key={address} address={address} pathname={pathname} />
              ))}
            </ul>
          ) : (
            <p className={`${styles.navEmpty} ${styles.sentenceCase}`}>{t('find_communities')}</p>
          )}
        </div>
        <div className={styles.navFooter}>
          <button type='button' className={styles.navItem} onClick={() => setUiMode('old')}>
            <ClassicIcon />
            <span className={`${styles.navLabel} ${styles.sentenceCase}`}>{t('old_interface')}</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default ModernNav;
