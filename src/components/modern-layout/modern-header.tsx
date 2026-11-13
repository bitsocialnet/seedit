import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import useResolvedCommunityRoute from '../../hooks/use-resolved-community-route';
import useTheme from '../../hooks/use-theme';
import { getCommunityPath, isResolvableCommunityAddress } from '../../lib/utils/community-route-utils';
import { getSearchPath } from '../../lib/utils/search-utils';
import { InboxIcon, MenuIcon, PlusIcon, SearchIcon } from '../modern-icons';
import ModernUserMenu from './modern-user-menu';
import styles from './modern-layout.module.css';

interface ModernHeaderProps {
  isNavOpen: boolean;
  onToggleNav: () => void;
}

const ModernHeader = ({ isNavOpen, onToggleNav }: ModernHeaderProps) => {
  const { t } = useTranslation();
  const [theme] = useTheme();
  const navigate = useNavigate();
  const { communityAddress } = useResolvedCommunityRoute();
  const account = useAccount();
  const unreadCount = account?.unreadNotificationCount || 0;
  // Inside a community, a new post goes to that community.
  const submitPath = isResolvableCommunityAddress(communityAddress) ? `${getCommunityPath(communityAddress)}/submit` : '/submit';

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get('q')?.toString().trim();
    if (query) navigate(getSearchPath(query));
  };

  return (
    <header className={styles.header}>
      <button type='button' className={styles.navToggle} aria-label={t('navigation_menu')} aria-expanded={isNavOpen} aria-controls='modern-nav' onClick={onToggleNav}>
        <MenuIcon />
      </button>
      <Link to='/' className={styles.logo} aria-label='seedit'>
        {/* Intrinsic sizes reserve the logo's space before the images load. */}
        <img className={styles.logoMark} src='assets/sprout/sprout.png' width={61} height={100} alt='' />
        <img className={styles.logoText} src={`assets/sprout/seedit-text-${theme === 'dark' ? 'dark' : 'light'}.svg`} width={1028} height={320} alt='' />
      </Link>
      <form role='search' className={styles.search} onSubmit={handleSearch}>
        <SearchIcon size={18} />
        <input type='search' name='q' placeholder={t('search')} aria-label={t('search')} autoComplete='off' />
      </form>
      <div className={styles.headerActions}>
        <Link to={submitPath} className={styles.createButton} aria-label={t('create')}>
          <PlusIcon />
          <span className={styles.createLabel}>{t('create')}</span>
        </Link>
        <Link to='/inbox' className={styles.iconButton} aria-label={unreadCount ? `${t('inbox')} (${unreadCount} ${t('unread')})` : t('inbox')}>
          <InboxIcon />
          {unreadCount > 0 && (
            <span className={styles.badge} aria-hidden='true'>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <ModernUserMenu />
      </div>
    </header>
  );
};

export default ModernHeader;
