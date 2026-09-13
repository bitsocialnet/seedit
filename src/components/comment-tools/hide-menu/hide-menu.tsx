import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Author, useBlock } from '@bitsocial/bitsocial-react-hooks';
import { autoUpdate, flip, FloatingFocusManager, offset, shift, useClick, useDismiss, useFloating, useId, useInteractions, useRole } from '@floating-ui/react';
import { isProfileHiddenView } from '../../../lib/utils/view-utils';
import { getDisplayAddress, getShortDisplayAddress } from '../../../lib/utils/address-utils';
import styles from './hide-menu.module.css';

type HideMenuProps = {
  author?: Author | undefined;
  cid?: string;
  isAccountMod?: boolean;
  toggleIsMenuOpen?: () => void;
  communityAddress?: string;
};

const BlockAuthorButton = ({ author, toggleIsMenuOpen }: HideMenuProps) => {
  const { t } = useTranslation();
  const { blocked, unblock, block } = useBlock({ address: author?.address });

  return (
    <div
      className={styles.menuItem}
      onClick={() => {
        (blocked ? unblock : block)();
        if (toggleIsMenuOpen) toggleIsMenuOpen();
      }}
    >
      {blocked ? `${t('unblock')}` : `${t('block')}`} u/{getDisplayAddress(author?.shortAddress || '')}
    </div>
  );
};

const BlockCommunityButton = ({ communityAddress }: HideMenuProps) => {
  const { t } = useTranslation();
  const { blocked, unblock, block } = useBlock({ address: communityAddress });

  return (
    <div className={styles.menuItem} onClick={blocked ? unblock : block}>
      {blocked ? `${t('unblock')}` : `${t('block')}`} s/{communityAddress && getShortDisplayAddress(communityAddress)}
    </div>
  );
};

const BlockCommentButton = ({ cid }: HideMenuProps) => {
  const { t } = useTranslation();
  const { blocked, unblock, block } = useBlock({ cid });

  return (
    <div className={styles.menuItem} onClick={blocked ? unblock : block}>
      {blocked ? `${t('unhide')}` : `${t('hide')}`} {t('post')}
    </div>
  );
};

const HideMenu = ({ author, cid, isAccountMod, communityAddress }: HideMenuProps) => {
  const { t } = useTranslation();
  const [isHideMenuOpen, setIsHideMenuOpen] = useState(false);
  const toggleIsMenuOpen = () => setIsHideMenuOpen(!isHideMenuOpen);

  const isInProfileHiddenView = isProfileHiddenView(useLocation().pathname);
  const { unblock } = useBlock({ cid });

  const { refs, floatingStyles, context } = useFloating({
    placement: 'bottom-start',
    open: isHideMenuOpen,
    onOpenChange: setIsHideMenuOpen,
    middleware: [offset(2), flip({ fallbackAxisSideDirection: 'end' }), shift()],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const headingId = useId();

  return (
    <>
      <li className={styles.button} ref={refs.setReference} {...(cid && getReferenceProps())}>
        {isInProfileHiddenView ? <span onClick={unblock}>{t('unhide')}</span> : <span onClick={() => cid && setIsHideMenuOpen(!isHideMenuOpen)}>{t('hide')}</span>}
      </li>
      {isHideMenuOpen && !isInProfileHiddenView && (
        <FloatingFocusManager context={context} modal={false}>
          <div className={styles.modal} ref={refs.setFloating} style={floatingStyles} aria-labelledby={headingId} {...getFloatingProps()}>
            <div className={styles.menu}>
              <BlockCommentButton cid={cid} toggleIsMenuOpen={toggleIsMenuOpen} />
              <BlockCommunityButton communityAddress={communityAddress} />
              <BlockAuthorButton author={author} />
              {!isAccountMod && (
                <button type='button' className={`${styles.menuItem} ${styles.reportButton}`} onClick={() => window.alert(t('feature_not_available_yet'))}>
                  {t('report')}
                </button>
              )}
            </div>
          </div>
        </FloatingFocusManager>
      )}
    </>
  );
};

export default HideMenu;
