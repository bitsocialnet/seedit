import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CommentMediaInfo } from '../../lib/utils/media-utils';
import useContentOptionsStore from '../../stores/use-content-options-store';
import { useIsNsfwCommunity } from '../../hooks/use-is-nsfw-community';
import Markdown from '../markdown';
import Embed from '../embed';
import styles from './expando.module.css';
import _ from 'lodash';

interface ExpandoProps {
  authorEditReason?: string;
  commentMediaInfo?: CommentMediaInfo;
  content?: string;
  deleted?: boolean;
  expanded: boolean;
  isReply?: boolean;
  link?: string;
  modEditReason?: string;
  nsfw?: boolean;
  removed?: boolean;
  showContent: boolean;
  spoiler?: boolean;
  toggleExpanded?: () => void;
}

const Expando = ({
  authorEditReason,
  commentMediaInfo,
  content,
  deleted,
  expanded,
  isReply,
  link,
  modEditReason,
  nsfw,
  removed,
  showContent,
  spoiler = false,
  toggleExpanded,
}: ExpandoProps) => {
  const { t } = useTranslation();
  const { blurNsfwThumbnails, setBlurNsfwThumbnails, autoplayVideosOnComments, muteVideosOnComments } = useContentOptionsStore();
  const [hideContent, setHideContent] = useState(blurNsfwThumbnails);
  const [alwaysShowNsfw, setAlwaysShowNsfw] = useState(false);

  useEffect(() => {
    if (!expanded) {
      setHideContent(true);
    }
  }, [expanded]);

  const handleAlwaysShowNsfw = () => {
    setBlurNsfwThumbnails(false);
    setHideContent(false);
    setAlwaysShowNsfw(true);
  };

  const handleUndoAlwaysShowNsfw = () => {
    setBlurNsfwThumbnails(true);
    setHideContent(true);
    setAlwaysShowNsfw(false);
  };

  let mediaComponent = null;

  if (commentMediaInfo?.type === 'image' || commentMediaInfo?.type === 'gif') {
    mediaComponent = <img src={commentMediaInfo.url} alt='' />;
  } else if (commentMediaInfo?.type === 'video' && expanded) {
    mediaComponent = <video src={`${commentMediaInfo.url}#t=0.001`} controls autoPlay={autoplayVideosOnComments} muted={muteVideosOnComments} />;
  } else if (commentMediaInfo?.type === 'webpage' && commentMediaInfo?.thumbnail) {
    mediaComponent = <img src={commentMediaInfo.thumbnail} alt='' />;
  } else if (commentMediaInfo?.type === 'audio' && expanded) {
    mediaComponent = <audio src={commentMediaInfo.url} controls />;
  } else if (commentMediaInfo?.type === 'iframe' && expanded) {
    mediaComponent = <Embed url={commentMediaInfo.url} />;
  } else if (commentMediaInfo?.type === 'pdf' && expanded) {
    mediaComponent = <Embed url={commentMediaInfo.url} />;
  }

  const pageCommunityAddress = useParams().communityAddress;
  const isNsfwCommunity = useIsNsfwCommunity(pageCommunityAddress || '');

  return (
    <div className={expanded ? styles.expando : styles.expandoHidden}>
      {link && !removed && commentMediaInfo?.type !== 'webpage' && (
        <div className={`${styles.mediaPreview} ${isReply ? styles.mediaPreviewReply : ''}`} onClick={() => setHideContent(false)}>
          {((nsfw && blurNsfwThumbnails && !isNsfwCommunity) || spoiler) && hideContent && link && commentMediaInfo?.type !== 'webpage' && !(deleted || removed) && (
            <>
              <div className={styles.blurContent} />
              <span className={styles.unblurButton}>{nsfw && spoiler ? t('see_nsfw_spoiler') : spoiler ? t('view_spoiler') : nsfw ? t('see_nsfw') : ''}</span>
              {nsfw && (
                <span className={styles.alwaysShowNsfwButton} onClick={handleAlwaysShowNsfw}>
                  {t('always_show_nsfw')}
                </span>
              )}
            </>
          )}
          <Link
            to={link}
            onClick={(e) => {
              if (e.button === 0) {
                e.preventDefault();
                if (toggleExpanded) toggleExpanded();
              }
            }}
          >
            {mediaComponent}
          </Link>
        </div>
      )}
      {alwaysShowNsfw && (
        <div className={styles.alwaysShowNsfwContainer}>
          <div className={styles.alwaysShowNsfwNotice}>
            <p>{t('always_show_nsfw_notice')}</p>
            <button onClick={handleUndoAlwaysShowNsfw}>{t('undo')}</button>
          </div>
        </div>
      )}
      {content && showContent && (
        <div className={styles.usertext}>
          <div className={styles.markdown}>
            <Markdown content={content} />
            {modEditReason && (
              <p className={styles.modReason}>
                {_.lowerCase(t('mod_edit_reason'))}: {modEditReason}
              </p>
            )}
            {authorEditReason && !(removed || deleted) && (
              <p>
                {t('edit')}: {authorEditReason}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Expando;
