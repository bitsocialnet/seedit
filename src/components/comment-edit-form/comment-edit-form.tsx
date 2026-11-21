import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChallengeVerification, PublishCommentEditOptions, useComment, useEditedComment, usePublishCommentEdit } from '@bitsocial/bitsocial-react-hooks';
import { FormattingHelpTable } from '../reply-form';
import formStyles from '../comment-form';
import styles from './comment-edit-form.module.css';
import { alertChallengeVerificationFailed } from '../../lib/utils/challenge-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import challengesStore from '../../stores/use-challenges-store';
import useCommentEditDraftStore from '../../stores/use-comment-edit-draft-store';
import Markdown from '../markdown';

const { addChallenge } = challengesStore.getState();

interface CommentEditFormProps {
  commentCid: string;
  hideCommentEditForm?: () => void;
}

const CommentEditForm = ({ commentCid, hideCommentEditForm }: CommentEditFormProps) => {
  const { t } = useTranslation();
  const [showOptions, setShowOptions] = useState(false);
  const [showFormattingHelp, setShowFormattingHelp] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  let post: any;
  const comment = useComment({ commentCid });

  const { editedComment } = useEditedComment({ comment });
  if (editedComment) {
    post = editedComment;
  } else if (comment) {
    post = comment;
  }

  const { content, reason, spoiler, nsfw } = post || {};
  const communityAddress = getCommentCommunityAddress(post);

  // Saving hides (unmounts) this form, and a failed or abandoned edit drops off the comment, so the last save the
  // community has not accepted yet is kept per comment and the form starts from it. Only an accepted edit clears it.
  const savedDraft = useCommentEditDraftStore((state) => state.drafts[commentCid]);
  const setDraft = useCommentEditDraftStore((state) => state.setDraft);
  const clearDraft = useCommentEditDraftStore((state) => state.clearDraft);

  const defaultPublishOptions: PublishCommentEditOptions = {
    commentCid,
    content,
    reason,
    spoiler,
    nsfw,
    communityAddress,
    onChallenge: (...args: any) => addChallenge([...args, post]),
    onError: (error: Error) => {
      console.warn(error);
      alert(error.message);
    },
    ...savedDraft,
  };

  const [publishCommentEditOptions, setPublishCommentEditOptions] = useState(defaultPublishOptions);

  // the user might manually type "edit: <reason>" in the content field
  // we want to extract the reason and remove it from the content
  const parseEditContent = (content: string) => {
    const lines = content.trim().split('\n');
    const lastLine = lines[lines.length - 1];

    if (lastLine?.toLowerCase().startsWith('edit:')) {
      const newContent = lines.slice(0, -1).join('\n').trim();
      return {
        content: newContent,
        reason: lastLine.substring(5).trim(), // remove "edit:" prefix
      };
    }

    return { content, reason: publishCommentEditOptions.reason };
  };

  // usePublishCommentEdit publishes the options of the render it was called in, so they must
  // already have the edit reason parsed out for the save handler to publish directly. Text equal to
  // the saved draft was parsed when it was saved: parsing it again would turn its last remaining
  // "edit:" line into the reason, so an unchanged retry would publish something else.
  const parsedEditContent =
    typeof publishCommentEditOptions.content === 'string' && publishCommentEditOptions.content !== savedDraft?.content
      ? parseEditContent(publishCommentEditOptions.content)
      : {};
  const editOptions: PublishCommentEditOptions = { ...publishCommentEditOptions, ...parsedEditContent };
  const editDraft = { content: editOptions.content, reason: editOptions.reason, spoiler: editOptions.spoiler, nsfw: editOptions.nsfw };
  const { publishCommentEdit } = usePublishCommentEdit({
    ...editOptions,
    onChallengeVerification: async (challengeVerification: ChallengeVerification, commentEdit: unknown) => {
      if (challengeVerification?.challengeSuccess) clearDraft(commentCid, editDraft);
      alertChallengeVerificationFailed(challengeVerification, commentEdit);
    },
  });

  useEffect(() => {
    if (textRef.current) {
      textRef.current.focus();
    }
  }, []);

  return (
    <div className={formStyles.mdContainer}>
      <div className={formStyles.md}>
        {showOptions && (
          <div className={formStyles.options}>
            <span className={styles.editReason}>
              {t('edit_reason')}:{' '}
              <input
                className={formStyles.url}
                value={publishCommentEditOptions.reason}
                onChange={(e) => setPublishCommentEditOptions((state) => ({ ...state, reason: e.target.value }))}
              />
            </span>
            <span className={formStyles.spoiler}>
              <label>
                {t('spoiler')}:{' '}
                <input
                  type='checkbox'
                  className={formStyles.checkbox}
                  checked={publishCommentEditOptions.spoiler}
                  onChange={(e) => setPublishCommentEditOptions((state) => ({ ...state, spoiler: e.target.checked }))}
                />
              </label>
            </span>
            <span className={formStyles.spoiler}>
              <label>
                {t('nsfw')}:{' '}
                <input
                  type='checkbox'
                  className={formStyles.checkbox}
                  checked={publishCommentEditOptions.nsfw}
                  onChange={(e) => setPublishCommentEditOptions((state) => ({ ...state, nsfw: e.target.checked }))}
                />
              </label>
            </span>
          </div>
        )}
        {!showPreview ? (
          <textarea
            className={formStyles.textarea}
            value={publishCommentEditOptions.content}
            ref={textRef}
            onChange={(e) => setPublishCommentEditOptions((state) => ({ ...state, content: e.target.value }))}
          />
        ) : (
          <div className={formStyles.preview}>
            <Markdown content={publishCommentEditOptions.content} />
          </div>
        )}
      </div>
      <div className={formStyles.bottomArea}>
        <span
          className={formStyles.optionsButton}
          onClick={() => {
            setShowFormattingHelp(!showFormattingHelp);
            if (showFormattingHelp) {
              setShowPreview(false);
            }
          }}
        >
          {showFormattingHelp ? t('hide_help') : t('formatting_help')}
        </span>
        <span className={formStyles.optionsButton} onClick={() => setShowOptions(!showOptions)}>
          {showOptions ? t('hide_options') : t('options')}
        </span>
        <button
          className={formStyles.save}
          onClick={() => {
            setPublishCommentEditOptions((state) => ({ ...state, ...parsedEditContent }));
            setDraft(commentCid, editDraft);
            publishCommentEdit();
            if (hideCommentEditForm) hideCommentEditForm();
          }}
        >
          {t('save')}
        </button>
        {showFormattingHelp && (
          <button className={formStyles.previewButton} onClick={() => setShowPreview(!showPreview)} disabled={!publishCommentEditOptions?.content}>
            {showPreview ? t('edit') : t('preview')}
          </button>
        )}
        <button
          className={formStyles.cancel}
          onClick={() => {
            if (hideCommentEditForm) hideCommentEditForm();
          }}
        >
          {t('cancel')}
        </button>
      </div>
      {showFormattingHelp && <FormattingHelpTable />}
    </div>
  );
};

export default CommentEditForm;
