import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { type Comment, useAccount, useBlock, useCommunity, useSaveComment } from '@bitsocial/bitsocial-react-hooks';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@ui-sdk/react/menu';
import useCommentEdit from '../../hooks/use-comment-edit';
import useCommentModeration, { type ModerationFlag } from '../../hooks/use-comment-moderation';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useDeleteComment from '../../hooks/use-delete-comment';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import { isModeratorRole } from '../../lib/utils/post-utils';
import { MoreIcon } from '../modern-icons';
import { modernStyles } from '../modern-layout';
import styles from './modern-comment-menu.module.css';

interface ModerationDialogProps {
  cid: string;
  /** Moderators cannot ban each other. */
  isCommentAuthorMod: boolean;
  onClose: () => void;
}

/** A moderator's flags, ban, and reason for one comment, in a modal dialog. */
const ModerationDialog = ({ cid, isCommentAuthorMod, onClose }: ModerationDialogProps) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { post, moderation, banDays, setFlag, setBanned, setBanDays, setReason, save } = useCommentModeration(cid);
  const isReply = Boolean(post?.parentCid);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const flags: { flag: ModerationFlag; label: string }[] = [
    { flag: 'removed', label: t('removed') },
    { flag: 'purged', label: t('purged') },
    ...(isReply ? [] : [{ flag: 'locked' as const, label: t('locked') }]),
    { flag: 'spoiler', label: t('spoiler') },
    { flag: 'nsfw', label: t('nsfw') },
    { flag: 'pinned', label: isReply ? t('stickied_comment') : t('announcement') },
  ];

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={`moderation-${cid}`} onClose={onClose}>
      <form
        method='dialog'
        className={styles.dialogForm}
        onSubmit={async (event) => {
          event.preventDefault();
          if (await save()) dialogRef.current?.close();
        }}
      >
        <h2 id={`moderation-${cid}`} className={`${styles.dialogTitle} ${modernStyles.sentenceCase}`}>
          {t('moderation')}
        </h2>
        {flags.map(({ flag, label }) => (
          <label key={flag} className={styles.check}>
            <input type='checkbox' checked={Boolean(moderation[flag])} onChange={(event) => setFlag(flag, event.target.checked)} />
            <span className={`${modernStyles.sentenceCase} ${flag === 'purged' ? styles.danger : ''}`}>{label}</span>
          </label>
        ))}
        {!isCommentAuthorMod && (
          <label className={styles.check}>
            <input type='checkbox' checked={Boolean(moderation.banExpiresAt)} onChange={(event) => setBanned(event.target.checked)} />
            <span>
              <Trans
                i18nKey='ban_user_for'
                shouldUnescape={true}
                components={{
                  1: (
                    <input
                      key='ban-days'
                      className={styles.banDays}
                      type='number'
                      min={1}
                      max={100}
                      value={banDays}
                      // The day count sits inside the sentence, so it is named by the sentence without its slot.
                      aria-label={t('ban_user_for')
                        .replace(/<1><\/1>/, '')
                        .replace(/\s+/g, ' ')}
                      onChange={(event) => setBanDays(parseInt(event.target.value, 10))}
                    />
                  ),
                }}
              />
            </span>
          </label>
        )}
        <label className={styles.field}>
          <span className={modernStyles.sentenceCase}>
            {t('reason')} <span className={styles.muted}>({t('optional')})</span>
          </span>
          <input type='text' className={styles.input} defaultValue={post?.reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className={styles.dialogActions}>
          <button type='button' className={modernStyles.secondaryButton} onClick={() => dialogRef.current?.close()}>
            <span className={modernStyles.sentenceCase}>{t('cancel')}</span>
          </button>
          <button type='submit' className={modernStyles.primaryButton}>
            <span className={modernStyles.sentenceCase}>{t('save')}</span>
          </button>
        </div>
      </form>
    </dialog>
  );
};

/** Edits the account's own comment in place: content, reason, and spoiler and NSFW flags. */
export const ModernEditForm = ({ cid, onClose }: { cid: string; onClose: () => void }) => {
  const { t } = useTranslation();
  const { options, update, save } = useCommentEdit(cid);
  return (
    <form
      className={styles.editForm}
      onSubmit={(event) => {
        event.preventDefault();
        save();
        onClose();
      }}
    >
      <textarea
        className={styles.textarea}
        aria-label={t('edit')}
        value={options.content ?? ''}
        autoFocus
        onChange={(event) => update({ content: event.target.value })}
      />
      <div className={styles.editOptions}>
        <label className={styles.field}>
          <span className={modernStyles.sentenceCase}>{t('edit_reason')}</span>
          <input type='text' className={styles.input} value={options.reason ?? ''} onChange={(event) => update({ reason: event.target.value })} />
        </label>
        <label className={styles.check}>
          <input type='checkbox' checked={Boolean(options.spoiler)} onChange={(event) => update({ spoiler: event.target.checked })} />
          <span className={modernStyles.sentenceCase}>{t('spoiler')}</span>
        </label>
        <label className={styles.check}>
          <input type='checkbox' checked={Boolean(options.nsfw)} onChange={(event) => update({ nsfw: event.target.checked })} />
          <span>{t('nsfw')}</span>
        </label>
      </div>
      <div className={styles.dialogActions}>
        <button type='button' className={modernStyles.secondaryButton} onClick={onClose}>
          <span className={modernStyles.sentenceCase}>{t('cancel')}</span>
        </button>
        <button type='submit' className={modernStyles.primaryButton}>
          <span className={modernStyles.sentenceCase}>{t('save')}</span>
        </button>
      </div>
    </form>
  );
};

interface ModernCommentMenuProps {
  comment: Comment;
  /** Opens the edit form; without it, the menu offers no edit, as in a feed. */
  onEdit?: () => void;
  className: string;
  iconSize?: number;
}

/** Save, hide, block, and the author's and moderators' actions for a post or comment. */
const ModernCommentMenu = ({ comment, onEdit, className, iconSize = 18 }: ModernCommentMenuProps) => {
  const { t } = useTranslation();
  const { author, cid } = comment;
  const communityAddress = getCommentCommunityAddress(comment);
  const accountAddress: string | undefined = useAccount()?.author?.address;
  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress), onlyIfCached: true } : undefined);
  const isAuthor = Boolean(author?.address && author.address === accountAddress);
  const isAccountMod = isModeratorRole(community?.roles?.[accountAddress ?? '']?.role);
  const isCommentAuthorMod = isModeratorRole(community?.roles?.[author?.address]?.role);

  const { saved, saveComment, unsaveComment } = useSaveComment({ commentCid: cid });
  const hidden = useBlock({ cid });
  const blockedAuthor = useBlock({ address: author?.address });
  const blockedCommunity = useBlock({ address: communityAddress });
  const { deleted, toggleDeleted } = useDeleteComment(cid ?? '');
  const [isModerating, setIsModerating] = useState(false);

  // A comment still publishing has no cid, so nothing can act on it yet.
  if (!cid) return null;

  return (
    <>
      <Menu modal={false}>
        <MenuTrigger className={className} aria-label={t('options')}>
          <MoreIcon size={iconSize} />
        </MenuTrigger>
        <MenuContent className={modernStyles.menu} aria-label={t('options')} align='end' sideOffset={6} collisionPadding={8}>
          <MenuItem className={modernStyles.menuItem} render={<button type='button' />} onSelect={() => void (saved ? unsaveComment() : saveComment())}>
            <span className={`${modernStyles.menuItemText} ${modernStyles.sentenceCase}`}>{saved ? t('unsave') : t('save')}</span>
          </MenuItem>
          <MenuItem className={modernStyles.menuItem} render={<button type='button' />} onSelect={() => (hidden.blocked ? hidden.unblock() : hidden.block())}>
            <span className={`${modernStyles.menuItemText} ${modernStyles.sentenceCase}`}>{hidden.blocked ? t('unhide') : t('hide')}</span>
          </MenuItem>
          {!isAuthor && author?.address && (
            <MenuItem
              className={modernStyles.menuItem}
              render={<button type='button' />}
              onSelect={() => (blockedAuthor.blocked ? blockedAuthor.unblock() : blockedAuthor.block())}
            >
              <span className={modernStyles.menuItemText}>
                <span className={modernStyles.sentenceCase}>{blockedAuthor.blocked ? t('unblock') : t('block')}</span> u/{getDisplayAddress(author.shortAddress || '')}
              </span>
            </MenuItem>
          )}
          {communityAddress && (
            <MenuItem
              className={modernStyles.menuItem}
              render={<button type='button' />}
              onSelect={() => (blockedCommunity.blocked ? blockedCommunity.unblock() : blockedCommunity.block())}
            >
              <span className={modernStyles.menuItemText}>
                <span className={modernStyles.sentenceCase}>{blockedCommunity.blocked ? t('unblock') : t('block')}</span> s/{getShortDisplayAddress(communityAddress)}
              </span>
            </MenuItem>
          )}
          {(isAuthor || isAccountMod) && <MenuSeparator className={modernStyles.menuDivider} />}
          {isAuthor && onEdit && !deleted && (
            <MenuItem className={modernStyles.menuItem} render={<button type='button' />} onSelect={onEdit}>
              <span className={`${modernStyles.menuItemText} ${modernStyles.sentenceCase}`}>{t('edit')}</span>
            </MenuItem>
          )}
          {isAuthor && (
            <MenuItem
              className={modernStyles.menuItem}
              render={<button type='button' />}
              onSelect={() => {
                if (window.confirm(t('are_you_sure'))) toggleDeleted();
              }}
            >
              <span className={`${modernStyles.menuItemText} ${modernStyles.sentenceCase} ${deleted ? '' : styles.danger}`}>{deleted ? t('undelete') : t('delete')}</span>
            </MenuItem>
          )}
          {isAccountMod && (
            <MenuItem className={modernStyles.menuItem} render={<button type='button' />} onSelect={() => setIsModerating(true)}>
              <span className={`${modernStyles.menuItemText} ${modernStyles.sentenceCase}`}>{t('moderation')}</span>
            </MenuItem>
          )}
        </MenuContent>
      </Menu>
      {isModerating && <ModerationDialog cid={cid} isCommentAuthorMod={isCommentAuthorMod} onClose={() => setIsModerating(false)} />}
    </>
  );
};

export default ModernCommentMenu;
