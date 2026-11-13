import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import { autoUpdate, flip, FloatingFocusManager, offset, shift, useClick, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import useTheme from '../../hooks/use-theme';
import { getDisplayAddress } from '../../lib/utils/address-utils';
import useUiModeStore from '../../stores/use-ui-mode-store';
import { ChevronDownIcon, ClassicIcon, MoonIcon, SettingsIcon, UserIcon } from '../modern-icons';
import styles from './modern-layout.module.css';

const ModernUserMenu = () => {
  const { t } = useTranslation();
  const account = useAccount();
  const [theme, setTheme] = useTheme();
  const setUiMode = useUiModeStore((state) => state.setUiMode);
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);
  const isDark = theme === 'dark';
  const accountLabel = account?.author?.displayName || `u/${getDisplayAddress(account?.author?.shortAddress || '')}`;

  const { refs, floatingStyles, context } = useFloating({
    placement: 'bottom-end',
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  // ARIA is set directly instead of with useRole, whose generated id would differ between the build-time static shell
  // and the browser's first render.
  const { getReferenceProps, getFloatingProps } = useInteractions([useClick(context), useDismiss(context)]);

  return (
    <>
      <button
        type='button'
        ref={refs.setReference}
        className={styles.userButton}
        aria-label={t('account')}
        aria-haspopup='menu'
        aria-expanded={isOpen}
        {...getReferenceProps()}
      >
        <span className={styles.userAvatar}>
          <UserIcon size={18} />
        </span>
        <ChevronDownIcon size={16} />
      </button>
      {isOpen && (
        <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
          <div ref={refs.setFloating} style={floatingStyles} className={styles.menu} role='menu' aria-label={t('account')} {...getFloatingProps()}>
            <Link to='/profile' role='menuitem' className={styles.menuItem} onClick={close}>
              <UserIcon />
              <span className={styles.menuItemText}>{accountLabel}</span>
            </Link>
            <Link to='/settings' role='menuitem' className={styles.menuItem} onClick={close}>
              <SettingsIcon />
              <span className={`${styles.menuItemText} ${styles.sentenceCase}`}>{t('preferences')}</span>
            </Link>
            <button type='button' role='menuitemcheckbox' aria-checked={isDark} className={styles.menuItem} onClick={() => setTheme(isDark ? 'light' : 'dark')}>
              <MoonIcon />
              <span className={`${styles.menuItemText} ${styles.sentenceCase}`}>{t('dark_mode')}</span>
              <span className={`${styles.switch} ${isDark ? styles.switchOn : ''}`} aria-hidden='true' />
            </button>
            <hr className={styles.menuDivider} />
            <button type='button' role='menuitem' className={styles.menuItem} onClick={() => setUiMode('old')}>
              <ClassicIcon />
              <span className={`${styles.menuItemText} ${styles.sentenceCase}`}>{t('old_interface')}</span>
            </button>
          </div>
        </FloatingFocusManager>
      )}
    </>
  );
};

export default ModernUserMenu;
