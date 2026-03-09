import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createAccount, setActiveAccount, useAccount, useAccounts } from '@bitsocialnet/bitsocial-react-hooks';
import { isSettingsView } from '../../lib/utils/view-utils';
import styles from './account-bar.module.css';
import SearchBar from '../search-bar';

const AccountBar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const account = useAccount();
  const { accounts } = useAccounts();
  const { karma } = account || {};

  const isInSettingsView = isSettingsView(location.pathname);

  const [searchVisible, setSearchVisible] = useState(false);
  const toggleSearchVisible = () => setSearchVisible(!searchVisible);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const searchBarButtonRef = useRef<HTMLDivElement>(null);

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const toggleAccountDropdown = () => setIsAccountDropdownOpen(!isAccountDropdownOpen);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const accountdropdownItemsRef = useRef<HTMLDivElement>(null);
  const accountDropdownClass = isAccountDropdownOpen ? styles.visible : styles.hidden;
  const accountSelectButtonRef = useRef<HTMLDivElement>(null);

  const unreadNotificationCount = account?.unreadNotificationCount ? ` ${account.unreadNotificationCount}` : '';
  const mailClass = unreadNotificationCount ? styles.mailIconUnread : styles.mailIconRead;

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      const target = event.target as Node;

      const isOutsideSearchBar =
        searchBarRef.current && !searchBarRef.current.contains(target) && searchBarButtonRef.current && !searchBarButtonRef.current.contains(target);
      const isOutsideAccountDropdown =
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(target) &&
        accountdropdownItemsRef.current &&
        !accountdropdownItemsRef.current.contains(target);
      const isOutsideAccountSelectButton = accountSelectButtonRef.current && !accountSelectButtonRef.current.contains(target);

      if (isOutsideAccountSelectButton && isOutsideAccountDropdown) {
        setIsAccountDropdownOpen(false);
      }

      if (isOutsideSearchBar) {
        setSearchVisible(false);
      }
    },
    [searchBarRef, accountSelectButtonRef, accountDropdownRef, accountdropdownItemsRef],
  );

  // Derive focus intent from visibility to avoid effect; SearchBar will handle actual focusing
  const shouldFocusSearch = searchVisible;

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  const accountDropdownOptions = accounts
    .filter((account) => account?.author?.shortAddress)
    .map((account, index) => (
      <span
        key={index}
        className={styles.dropdownItem}
        onClick={() => {
          setActiveAccount(account?.name);
          setIsAccountDropdownOpen(false);
        }}
      >
        u/{account.author.shortAddress}
      </span>
    ));

  accountDropdownOptions.push(
    <Link key='create' to='#' className={styles.dropdownItem} onClick={() => createAccount()}>
      +{t('create')}
    </Link>,
  );

  return (
    <div className={styles.content}>
      <span className={styles.user}>
        <Link to='/profile'>{account?.author?.shortAddress}</Link>
        {karma && (
          <span className={styles.karma}>
            {' '}
            (<span className={styles.karmaScore}>{karma?.postScore + 1}</span>)
          </span>
        )}
        <span className={styles.userDropdownButton} ref={accountSelectButtonRef} onClick={toggleAccountDropdown} />
        {isAccountDropdownOpen && (
          <div className={`${styles.dropdown} ${accountDropdownClass}`} ref={accountDropdownRef}>
            <div className={`${styles.dropChoices} ${styles.accountDropChoices}`} ref={accountdropdownItemsRef}>
              {accountDropdownOptions}
            </div>
          </div>
        )}
      </span>
      <span className={styles.separator}>|</span>
      <Link to='/inbox' className={styles.iconButton}>
        <span className={`${styles.mailIcon} ${mailClass}`} />
        {unreadNotificationCount && <span className={styles.mailUnreadCount}>{unreadNotificationCount}</span>}
      </Link>
      <span className={styles.searchButton}>
        <span className={styles.separator}>|</span>
        <span className={styles.iconButton} onClick={toggleSearchVisible} ref={searchBarButtonRef}>
          🔎
        </span>
        {searchVisible && (
          <div className={styles.searchBar} ref={searchBarRef}>
            <SearchBar isFocused={shouldFocusSearch} />
          </div>
        )}
      </span>
      <span className={styles.separator}>|</span>
      <Link to='/settings' className={`${styles.textButton} ${isInSettingsView && styles.selectedTextButton}`}>
        {t('preferences')}
      </Link>
    </div>
  );
};

export default AccountBar;
