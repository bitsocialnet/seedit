import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormattingHelpTable } from '../reply-form';
import formStyles from '../comment-form';
import styles from './comment-edit-form.module.css';
import useCommentEdit from '../../hooks/use-comment-edit';
import Markdown from '../markdown';

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

  const { options: publishCommentEditOptions, update, save } = useCommentEdit(commentCid);

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
              {t('edit_reason')}: <input className={formStyles.url} value={publishCommentEditOptions.reason} onChange={(e) => update({ reason: e.target.value })} />
            </span>
            <span className={formStyles.spoiler}>
              <label>
                {t('spoiler')}:{' '}
                <input
                  type='checkbox'
                  className={formStyles.checkbox}
                  checked={publishCommentEditOptions.spoiler}
                  onChange={(e) => update({ spoiler: e.target.checked })}
                />
              </label>
            </span>
            <span className={formStyles.spoiler}>
              <label>
                {t('nsfw')}:{' '}
                <input type='checkbox' className={formStyles.checkbox} checked={publishCommentEditOptions.nsfw} onChange={(e) => update({ nsfw: e.target.checked })} />
              </label>
            </span>
          </div>
        )}
        {!showPreview ? (
          <textarea className={formStyles.textarea} value={publishCommentEditOptions.content} ref={textRef} onChange={(e) => update({ content: e.target.value })} />
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
            save();
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
