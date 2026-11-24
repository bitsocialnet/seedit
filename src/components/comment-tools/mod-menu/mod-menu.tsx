import { useMemo, useState } from 'react';
import { autoUpdate, flip, FloatingFocusManager, offset, shift, useClick, useDismiss, useFloating, useId, useInteractions, useRole } from '@floating-ui/react';
import { Trans, useTranslation } from 'react-i18next';
import { PublishCommentModerationOptions, useComment, useEditedComment, usePublishCommentModeration } from '@bitsocial/bitsocial-react-hooks';
import styles from './mod-menu.module.css';
import { alertChallengeVerificationFailed } from '../../../lib/utils/challenge-utils';
import { getCommentCommunityAddress } from '../../../lib/utils/comment-utils';
import challengesStore from '../../../stores/use-challenges-store';

const { addChallenge } = challengesStore.getState();

type ModMenuProps = {
  cid: string;
  isCommentAuthorMod?: boolean;
};

const ModMenu = ({ cid, isCommentAuthorMod }: ModMenuProps) => {
  const { t } = useTranslation();
  let post: any;
  const comment = useComment({ commentCid: cid });
  const { editedComment } = useEditedComment({ comment });
  if (editedComment) {
    post = editedComment;
  } else if (comment) {
    post = comment;
  }
  const isReply = post?.parentCid;
  const [isModMenuOpen, setIsModMenuOpen] = useState(false);

  const { removed, locked, spoiler, nsfw, pinned, purged } = post || {};
  const communityAddress = getCommentCommunityAddress(post);
  // A ban (commentModeration.author.banExpiresAt) marks the comment it is published on with authorBanExpiresAt, so
  // the ban checkbox starts from this comment's own ban (the account's pending moderation, then the published mark),
  // never from the author-wide author.community.banExpiresAt, and only while that ban is still running (checked on open).
  const thisCommentBanExpiresAt = post?.commentModeration?.author?.banExpiresAt ?? post?.authorBanExpiresAt;

  const defaultPublishOptions: PublishCommentModerationOptions = {
    commentCid: cid,
    communityAddress,
    commentModeration: {
      removed: removed ?? false,
      purged: purged ?? false,
      locked: locked ?? false,
      spoiler: spoiler ?? false,
      nsfw: nsfw ?? false,
      pinned: pinned ?? false,
    },
    onChallenge: (...args: any) => addChallenge([...args, post]),
    onChallengeVerification: alertChallengeVerificationFailed,
    onError: (error: Error) => {
      console.warn(error);
      alert(error.message);
    },
  };

  const [publishCommentModerationOptions, setPublishCommentModerationOptions] = useState(defaultPublishOptions);
  // the running ban this comment had when the menu opened, the moderator's draft of it (undefined when unchecked), and
  // when the moderator unchecked it
  const [openedBanExpiresAt, setOpenedBanExpiresAt] = useState<number | undefined>(undefined);
  const [draftBanExpiresAt, setDraftBanExpiresAt] = useState<number | undefined>(undefined);
  const [banLiftedAt, setBanLiftedAt] = useState<number | undefined>(undefined);
  const [banDuration, setBanDuration] = useState(1);

  // A ban is sent only when the moderator sets, changes or lifts it in this menu, compared with the ban the menu opened
  // with, so removing or locking a banned comment does not republish its ban. Lifting publishes the time the moderator
  // unchecked it, as pkc-js unbans: the ban ends and the comment keeps its label. The author key is otherwise left
  // out, because the hooks read an author key, even undefined, as a change to the ban.
  const banExpiresAtToPublish =
    draftBanExpiresAt !== undefined
      ? draftBanExpiresAt !== openedBanExpiresAt
        ? draftBanExpiresAt
        : undefined
      : openedBanExpiresAt !== undefined
        ? banLiftedAt
        : undefined;
  const moderationOptions = useMemo(
    () => ({
      ...publishCommentModerationOptions,
      commentModeration: {
        ...publishCommentModerationOptions.commentModeration,
        ...(banExpiresAtToPublish !== undefined && { author: { banExpiresAt: banExpiresAtToPublish } }),
      },
    }),
    [publishCommentModerationOptions, banExpiresAtToPublish],
  );
  const { publishCommentModeration } = usePublishCommentModeration(moderationOptions);

  const daysToTimestampInSeconds = (days: number) => {
    const now = new Date();
    now.setDate(now.getDate() + days);
    return Math.floor(now.getTime() / 1000);
  };

  // the menu mounts with the comment, long before it opens, so the form starts from the comment's current flags on open
  const setModMenuOpen = (open: boolean) => {
    if (open && !isModMenuOpen) {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const runningBanExpiresAt = typeof thisCommentBanExpiresAt === 'number' && thisCommentBanExpiresAt > nowInSeconds ? thisCommentBanExpiresAt : undefined;
      setPublishCommentModerationOptions(defaultPublishOptions);
      setOpenedBanExpiresAt(runningBanExpiresAt);
      setDraftBanExpiresAt(runningBanExpiresAt);
      setBanLiftedAt(undefined);
      setBanDuration(runningBanExpiresAt ? Math.max(1, Math.floor((runningBanExpiresAt - nowInSeconds) / (24 * 60 * 60))) : 1);
    }
    setIsModMenuOpen(open);
  };

  const onCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, checked } = e.target;
    if (id === 'banUser') {
      setDraftBanExpiresAt(checked ? daysToTimestampInSeconds(banDuration) : undefined);
      setBanLiftedAt(checked ? undefined : Math.floor(Date.now() / 1000));
    } else {
      setPublishCommentModerationOptions((state) => ({
        ...state,
        commentModeration: { ...state.commentModeration, [id]: checked },
      }));
    }
  };

  const onBanDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const days = parseInt(e.target.value, 10) || 1;
    setBanDuration(days);
    // only a checked ban takes the new length
    setDraftBanExpiresAt((draft) => (draft === undefined ? undefined : daysToTimestampInSeconds(days)));
  };

  const onReason = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPublishCommentModerationOptions((state) => ({
      ...state,
      commentModeration: {
        ...state.commentModeration,
        reason: e.target.value || '',
      },
    }));

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
    if (publishCommentModerationOptions.commentModeration.purged) {
      const confirmed = window.confirm(
        'You are purging this comment. Are you sure you want to continue?\n\n' +
          "The comment will be completely removed from this community's database. This action is irreversible.",
      );
      if (!confirmed) {
        return;
      }
    }

    await publishCommentModeration();
    setIsModMenuOpen(false);
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
                  <input onChange={onCheckbox} checked={publishCommentModerationOptions.commentModeration.removed} type='checkbox' id='removed' />
                  {t('removed')}
                </label>
              </div>
              <div className={styles.menuItem}>
                <label>
                  <input onChange={onCheckbox} checked={publishCommentModerationOptions.commentModeration.purged} type='checkbox' id='purged' />
                  <span className={styles.purged}>{t('purged')}</span> <span className={styles.optional}>({t('irreversible')})</span>
                </label>
              </div>
              {!isReply && (
                <div className={styles.menuItem}>
                  <label>
                    <input onChange={onCheckbox} checked={publishCommentModerationOptions.commentModeration.locked} type='checkbox' id='locked' />
                    {t('locked')}
                  </label>
                </div>
              )}
              <div className={styles.menuItem}>
                <label>
                  <input onChange={onCheckbox} checked={publishCommentModerationOptions.commentModeration.spoiler} type='checkbox' id='spoiler' />
                  {t('spoiler')}
                </label>
              </div>
              <div className={styles.menuItem}>
                <label>
                  <input onChange={onCheckbox} checked={publishCommentModerationOptions.commentModeration.nsfw} type='checkbox' id='nsfw' />
                  {t('nsfw')}
                </label>
              </div>
              <div className={styles.menuItem}>
                <label>
                  <input onChange={onCheckbox} checked={publishCommentModerationOptions.commentModeration.pinned} type='checkbox' id='pinned' />
                  {isReply ? t('stickied_comment') : t('announcement')}
                </label>
              </div>
              {!isCommentAuthorMod && (
                <div className={styles.menuItem}>
                  <label>
                    <input onChange={onCheckbox} checked={draftBanExpiresAt !== undefined} type='checkbox' id='banUser' />
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
