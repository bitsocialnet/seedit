import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@ui-sdk/react/menu';
import useTheme from '../../hooks/use-theme';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import useUiModeStore from '../../stores/use-ui-mode-store';
import { ChevronDownIcon, ClassicIcon, InfoIcon, MoonIcon, SettingsIcon, UserIcon } from '../modern-icons';
import styles from './modern-layout.module.css';

const ModernUserMenu = () => {
  const { t } = useTranslation();
  const account = useAccount();
  const [theme, setTheme] = useTheme();
  const setUiMode = useUiModeStore((state) => state.setUiMode);
  const isDark = theme === 'dark';
  const accountLabel = account?.author?.displayName || `u/${getDisplayAddress(account?.author?.shortAddress || '')}`;

  return (
    <Menu modal={false}>
      {/* The static shell and the live app render in separate roots, with different generated IDs. */}
      <MenuTrigger id='modern-account-menu-trigger' className={styles.userButton} aria-label={t('account')}>
        <span className={styles.userAvatar}>
          <UserIcon size={18} />
        </span>
        <ChevronDownIcon size={16} />
      </MenuTrigger>
      <MenuContent className={styles.menu} aria-label={t('account')} align='end' sideOffset={6} collisionPadding={8}>
        <MenuItem className={styles.menuItem} render={<Link to='/profile' />}>
          <UserIcon />
          <span className={styles.menuItemText}>{accountLabel}</span>
        </MenuItem>
        <MenuItem className={styles.menuItem} render={<Link to='/settings' />}>
          <SettingsIcon />
          <span className={`${styles.menuItemText} ${styles.sentenceCase}`}>{t('preferences')}</span>
        </MenuItem>
        <MenuCheckboxItem
          className={styles.menuItem}
          render={<button type='button' />}
          value='dark-mode'
          checked={isDark}
          closeOnSelect={false}
          onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        >
          <MoonIcon />
          <span className={`${styles.menuItemText} ${styles.sentenceCase}`}>{t('dark_mode')}</span>
          <span className={`${styles.switch} ${isDark ? styles.switchOn : ''}`} aria-hidden='true' />
        </MenuCheckboxItem>
        <MenuSeparator className={styles.menuDivider} />
        <MenuItem className={styles.menuItem} render={<Link to='/about' />}>
          <InfoIcon />
          <span className={`${styles.menuItemText} ${styles.sentenceCase}`}>{t('about')}</span>
        </MenuItem>
        <MenuItem className={styles.menuItem} render={<button type='button' />} onSelect={() => setUiMode('old')}>
          <ClassicIcon />
          <span className={`${styles.menuItemText} ${styles.sentenceCase}`}>{t('old_interface')}</span>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
};

export default ModernUserMenu;
