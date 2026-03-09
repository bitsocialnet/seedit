import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PublishCommentEditOptions, useComment, useEditedComment, usePublishCommentEdit } from '@bitsocialnet/bitsocial-react-hooks';
import styles from './edit-menu.module.css';
import { alertChallengeVerificationFailed } from '../../../../lib/utils/challenge-utils';
import challengesStore from '../../../../stores/use-challenges-store';

const { addChallenge } = challengesStore.getState();

type EditMenuProps = {
  commentCid: string;
  showCommentEditForm?: () => void;
};

const EditMenu = ({ commentCid, showCommentEditForm }: EditMenuProps) => {
  const { t } = useTranslation();

  let post: any;
  const comment = useComment({ commentCid });
  const { editedComment } = useEditedComment({ comment });
  if (editedComment) {
    post = editedComment;
  } else if (comment) {
    post = comment;
  }

  const { deleted, subplebbitAddress } = post || {};

  const defaultPublishOptions: PublishCommentEditOptions = {
    commentCid,
    deleted,
    subplebbitAddress,
    onChallenge: (...args: any) => addChallenge([...args, post]),
    onChallengeVerification: alertChallengeVerificationFailed,
    onError: (error: Error) => {
      console.warn(error);
      alert('Comment edit failed. ' + error.message);
    },
  };

  const [publishOptions, setPublishOptions] = useState(defaultPublishOptions);
  const { publishCommentEdit } = usePublishCommentEdit(publishOptions);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteComment = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = () => {
    const newDeletedState = !deleted;
    setPublishOptions((prevOptions) => ({
      ...prevOptions,
      deleted: newDeletedState,
    }));
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  useEffect(() => {
    if (publishOptions.deleted !== defaultPublishOptions.deleted) {
      publishCommentEdit();
    }
  }, [publishOptions, publishCommentEdit, defaultPublishOptions.deleted]);

  return (
    <>
      <li className={styles.button}>
        <span
          onClick={() => {
            if (showCommentEditForm && commentCid) showCommentEditForm();
          }}
        >
          {t('edit')}
        </span>
      </li>
      {showDeleteConfirm ? (
        <span className={styles.deleteConfirm}>
          {t('are_you_sure')}{' '}
          <span className={styles.confirmButton} onClick={confirmDelete}>
            {t('yes')}
          </span>
          {' / '}
          <span className={styles.cancelButton} onClick={cancelDelete}>
            {t('no')}
          </span>
        </span>
      ) : (
        <li className={styles.button}>
          <span
            onClick={() => {
              if (commentCid) deleteComment();
            }}
          >
            {deleted ? t('undelete') : t('delete')}
          </span>
        </li>
      )}
    </>
  );
};

export default EditMenu;
