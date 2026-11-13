import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PublishCommentEditOptions, useComment, useEditedComment, usePublishCommentEdit } from '@bitsocial/bitsocial-react-hooks';
import styles from './edit-menu.module.css';
import { alertChallengeVerificationFailed } from '../../../lib/utils/challenge-utils';
import { getCommentCommunityAddress } from '../../../lib/utils/comment-utils';
import challengesStore from '../../../stores/use-challenges-store';

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

  const { deleted } = post || {};
  const communityAddress = getCommentCommunityAddress(post);

  // the menu only toggles deleted, and usePublishCommentEdit publishes the options of the render that
  // returned it, so the confirm handler can publish the toggled value directly
  const publishOptions: PublishCommentEditOptions = {
    commentCid,
    deleted: !deleted,
    communityAddress,
    onChallenge: (...args: any) => addChallenge([...args, post]),
    onChallengeVerification: alertChallengeVerificationFailed,
    onError: (error: Error) => {
      console.warn(error);
      alert('Comment edit failed. ' + error.message);
    },
  };

  const { publishCommentEdit } = usePublishCommentEdit(publishOptions);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteComment = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    publishCommentEdit();
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

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
