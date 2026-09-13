import styles from './expand-button.module.css';
import { CommentMediaInfo } from '../../lib/utils/media-utils';

interface ExpandButtonProps {
  commentMediaInfo?: CommentMediaInfo;
  content?: string;
  crosspost?: boolean;
  expanded: boolean;
  hasThumbnail: boolean;
  link?: string;
  toggleExpanded: () => void;
}

const ExpandButton = ({ commentMediaInfo, content, crosspost = false, expanded, hasThumbnail, link, toggleExpanded }: ExpandButtonProps) => {
  let initialButtonType = crosspost
    ? 'crosspostButton'
    : hasThumbnail || commentMediaInfo?.type === 'audio' || commentMediaInfo?.type === 'iframe'
      ? 'playButton'
      : 'textButton';

  if (commentMediaInfo?.type === 'webpage' && content && content.trim().length > 0) {
    initialButtonType = 'textButton';
  }

  if (commentMediaInfo?.type === 'pdf') {
    initialButtonType = 'playButton';
  }

  const buttonType = expanded ? (crosspost ? 'crosspostExpandedButton' : 'closeButton') : initialButtonType;

  return (
    (crosspost || (content && !link) || link) && (
      <div className={styles.buttonWrapper} onClick={toggleExpanded}>
        <div className={`expando-button ${expanded ? 'expanded' : 'collapsed'} ${crosspost ? 'crosspost' : ''} ${styles.buttonCommon} ${styles[buttonType]}`} />
      </div>
    )
  );
};

export default ExpandButton;
