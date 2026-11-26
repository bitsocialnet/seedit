import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './edit-menu.module.css';
import useDeleteComment from '../../../hooks/use-delete-comment';

type EditMenuProps = {
  commentCid: string;
  showCommentEditForm?: () => void;
};

const EditMenu = ({ commentCid, showCommentEditForm }: EditMenuProps) => {
  const { t } = useTranslation();

  const { deleted, toggleDeleted } = useDeleteComment(commentCid);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteComment = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = () => {
    toggleDeleted();
    setShowDeleteConfirm(false);
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
