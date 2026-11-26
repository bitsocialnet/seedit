import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './author-sidebar.module.css';
import { getFormattedTimeDuration } from '../../lib/utils/time-utils';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import useAuthorProfile from '../../hooks/use-author-profile';

const AuthorModeratingList = ({ communityAddresses }: { communityAddresses: string[] }) => {
  const { t } = useTranslation();
  return (
    <div className={styles.modList}>
      <div className={styles.modListTitle}>{t('moderator_of')}</div>
      <ul className={`${styles.modListContent} ${styles.modsList}`}>
        {communityAddresses.map((address) => (
          <li key={address}>
            <Link to={getCommunityPath(address)}>s/{getShortDisplayAddress(address)}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

const AuthorSidebar = () => {
  const { t } = useTranslation();
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const { address, displayName, postKarma, commentKarma, oldestCommentTimestamp, moderatedCommunities, isInProfileView, isOtherAuthor, blocked, block, unblock } =
    useAuthorProfile();

  const blockConfirm = () => {
    setShowBlockConfirm(true);
  };

  const handleBlock = () => {
    if (blocked) {
      unblock();
    } else {
      block();
    }
    setShowBlockConfirm(false);
  };

  const cancelBlock = () => {
    setShowBlockConfirm(false);
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.titleBox}>
        <div className={styles.title}>
          {getDisplayAddress(address || '')}
          {isInProfileView && !displayName && (
            <span className={styles.editButtonWrapper}>
              {' '}
              (
              <span className={styles.editButton}>
                <Link to='/settings#displayName'>{t('edit')}</Link>
              </span>
              )
            </span>
          )}
        </div>
        {displayName && <div className={styles.displayName}>{displayName}</div>}
        {/*  TODO: implement functionality for subscribing to users
        {isOtherAuthor && (
          <div className={styles.friends}>
            <SubscribeButton address={address} />
          </div>
        )} */}
        <div>
          <span className={styles.karma}>{postKarma}</span> {t('post_karma')}
        </div>
        <div>
          <span className={styles.karma}>{commentKarma}</span> {t('comment_karma')}
        </div>
        <div className={styles.bottom}>
          {isOtherAuthor &&
            (showBlockConfirm ? (
              <span className={styles.blockConfirm}>
                {t('are_you_sure')}{' '}
                <span className={styles.confirmButton} onClick={handleBlock}>
                  {t('yes')}
                </span>
                {' / '}
                <span className={styles.cancelButton} onClick={cancelBlock}>
                  {t('no')}
                </span>
              </span>
            ) : (
              <span className={styles.blockUser} onClick={blockConfirm}>
                {blocked ? t('unblock_user') : t('block_user')}
              </span>
            ))}
          <span className={styles.age}>{t('user_since', { time: getFormattedTimeDuration(oldestCommentTimestamp) })}</span>
        </div>
      </div>
      {moderatedCommunities.length > 0 && <AuthorModeratingList communityAddresses={moderatedCommunities} />}
    </div>
  );
};

export default AuthorSidebar;
