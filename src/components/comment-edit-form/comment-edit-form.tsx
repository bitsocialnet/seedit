import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PublishCommentEditOptions, useComment, useEditedComment, usePublishCommentEdit } from '@bitsocial/bitsocial-react-hooks';
import { FormattingHelpTable } from '../reply-form';
import formStyles from '../comment-form';
import styles from './comment-edit-form.module.css';
import { alertChallengeVerificationFailed } from '../../lib/utils/challenge-utils';
import { getCommentCommunityAddress } from '../../lib/utils/comment-utils';
import challengesStore from '../../stores/use-challenges-store';
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

  const defaultPublishOptions: PublishCommentEditOptions = {
    commentCid,
    content,
    reason,
    spoiler,
    nsfw,
    communityAddress,
    onChallenge: (...args: any) => addChallenge([...args, post]),
    onChallengeVerification: alertChallengeVerificationFailed,
    onError: (error: Error) => {
      console.warn(error);
      alert(error.message);
    },
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
  // already have the edit reason parsed out for the save handler to publish directly
  const parsedEditContent = typeof publishCommentEditOptions.content === 'string' ? parseEditContent(publishCommentEditOptions.content) : {};
  const { publishCommentEdit } = usePublishCommentEdit({ ...publishCommentEditOptions, ...parsedEditContent });

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
