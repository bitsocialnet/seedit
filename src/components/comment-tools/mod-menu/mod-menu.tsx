import { useState } from 'react';
import { autoUpdate, flip, FloatingFocusManager, offset, shift, useClick, useDismiss, useFloating, useId, useInteractions, useRole } from '@floating-ui/react';
import { Trans, useTranslation } from 'react-i18next';
import styles from './mod-menu.module.css';
import useCommentModeration, { type ModerationFlag } from '../../../hooks/use-comment-moderation';

type ModMenuProps = {
  cid: string;
  isCommentAuthorMod?: boolean;
};

const ModMenu = ({ cid, isCommentAuthorMod }: ModMenuProps) => {
  const { t } = useTranslation();
  const { post, moderation, isBanned, banDays: banDuration, setFlag, setBanned, setBanDays, setReason, save, reset } = useCommentModeration(cid);
  const isReply = post?.parentCid;
  const [isModMenuOpen, setIsModMenuOpen] = useState(false);

  const onCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, checked } = e.target;
    if (id === 'banUser') setBanned(checked);
    else setFlag(id as ModerationFlag, checked);
  };
  const onBanDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => setBanDays(parseInt(e.target.value, 10) || 1);
  const onReason = (e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value);

  // the menu mounts with the comment, long before it opens, so the form starts from the comment's current flags on open
  const setModMenuOpen = (open: boolean) => {
    if (open && !isModMenuOpen) reset();
    setIsModMenuOpen(open);
  };

  const { refs, floatingStyles, context } = useFloating({
    placement: 'bottom-start',
    open: isModMenuOpen,
    onOpenChange: setModMenuOpen,
    middleware: [offset(2), flip({ fallbackAxisSideDirection: 'end' }), shift()],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const headingId = useId();

  const handleSaveClick = async () => {
    if (await save()) setIsModMenuOpen(false);
  };

  return (
    <>
      <li className={styles.button} ref={refs.setReference} {...(cid && getReferenceProps())}>
        <span onClick={() => cid && setModMenuOpen(!isModMenuOpen)}>{t('moderation')}</span>
      </li>
      {isModMenuOpen && (
        <FloatingFocusManager context={context} modal={false}>
          <div className={styles.modal} ref={refs.setFloating} style={floatingStyles} aria-labelledby={headingId} {...getFloatingProps()}>
            <div className={styles.ModMenu}>
              <div className={styles.menuItem}>
                <label>
                  <input onChange={onCheckbox} checked={moderation.removed} type='checkbox' id='removed' />
                  {t('removed')}
                </label>
              </div>
              <div className={styles.menuItem}>
                <label>
                  <input onChange={onCheckbox} checked={moderation.purged} type='checkbox' id='purged' />
                  <span className={styles.purged}>{t('purged')}</span> <span className={styles.optional}>({t('irreversible')})</span>
                </label>
              </div>
              {!isReply && (
                <div className={styles.menuItem}>
                  <label>
                    <input onChange={onCheckbox} checked={moderation.locked} type='checkbox' id='locked' />
                    {t('locked')}
                  </label>
                </div>
              )}
              <div className={styles.menuItem}>
                <label>
                  <input onChange={onCheckbox} checked={moderation.spoiler} type='checkbox' id='spoiler' />
                  {t('spoiler')}
                </label>
              </div>
              <div className={styles.menuItem}>
                <label>
                  <input onChange={onCheckbox} checked={moderation.nsfw} type='checkbox' id='nsfw' />
                  {t('nsfw')}
                </label>
              </div>
              <div className={styles.menuItem}>
                <label>
                  <input onChange={onCheckbox} checked={moderation.pinned} type='checkbox' id='pinned' />
                  {isReply ? t('stickied_comment') : t('announcement')}
                </label>
              </div>
              {!isCommentAuthorMod && (
                <div className={styles.menuItem}>
                  <label>
                    <input onChange={onCheckbox} checked={isBanned} type='checkbox' id='banUser' />
                    <Trans
                      i18nKey='ban_user_for'
                      shouldUnescape={true}
                      components={{
                        1: (
                          <input
                            key='ban_user_for_input'
                            className={styles.banInput}
                            onChange={onBanDurationChange}
                            type='number'
                            min={1}
                            max={100}
                            defaultValue={banDuration}
                          />
                        ),
                      }}
                    />
                  </label>
                </div>
              )}
              <div className={`${styles.menuItem} ${styles.menuReason}`}>
                {t('reason')} <span className={styles.optional}>({t('optional')})</span>
                <input type='text' onChange={onReason} defaultValue={post?.reason} size={14} />
              </div>
              <div className={styles.bottom}>
                <button onClick={handleSaveClick}>{t('save')}</button>
              </div>
            </div>
          </div>
        </FloatingFocusManager>
      )}
    </>
  );
};

export default ModMenu;
