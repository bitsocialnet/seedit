import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Comment } from '@bitsocial/bitsocial-react-hooks';
import useDownvote from '../../hooks/use-downvote';
import useUpvote from '../../hooks/use-upvote';
import { copyToClipboard } from '../../lib/utils/clipboard-utils';
import { DownvoteIcon, ShareIcon, UpvoteIcon } from '../modern-icons';
import styles from './modern-actions.module.css';

interface ModernVoteButtonsProps {
  comment: Comment;
  score: string;
  /** Posts use a filled pill; comments use the quieter plain control. */
  variant?: 'pill' | 'plain';
  /** The thread takes no votes, such as under a locked post. */
  disabled?: boolean;
}

export const ModernVoteButtons = ({ comment, score, variant = 'pill', disabled: isThreadClosed }: ModernVoteButtonsProps) => {
  const { t } = useTranslation();
  const [upvoted, upvote] = useUpvote(comment);
  const [downvoted, downvote] = useDownvote(comment);
  // A comment takes votes once it is published, and not after it is removed or deleted.
  const disabled = Boolean(!comment.cid || comment.removed || comment.deleted || isThreadClosed);

  return (
    <div className={`${styles.votes} ${styles[variant]} ${upvoted ? styles.upvoted : ''} ${downvoted ? styles.downvoted : ''}`}>
      <button
        type='button'
        className={`${styles.voteButton} ${styles.upvoteButton}`}
        aria-label={t('upvote')}
        aria-pressed={upvoted}
        disabled={disabled}
        onClick={() => upvote()}
      >
        <UpvoteIcon size={variant === 'plain' ? 16 : 18} />
      </button>
      <span className={styles.score}>{score}</span>
      <button
        type='button'
        className={`${styles.voteButton} ${styles.downvoteButton}`}
        aria-label={t('downvote')}
        aria-pressed={downvoted}
        disabled={disabled}
        onClick={() => downvote()}
      >
        <DownvoteIcon size={variant === 'plain' ? 16 : 18} />
      </button>
    </div>
  );
};

interface ModernShareButtonProps {
  className: string;
  iconSize?: number;
  /** The link to copy; the button is disabled until there is one. */
  url: string | undefined;
}

/** Copies a link and confirms it in place. */
export const ModernShareButton = ({ className, iconSize = 18, url }: ModernShareButtonProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const share = async () => {
    if (!url) return;
    try {
      await copyToClipboard(url);
      setCopied(true);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <button type='button' className={className} onClick={share} disabled={!url}>
      <ShareIcon size={iconSize} />
      <span className={styles.label} aria-live='polite'>
        {copied ? t('link_copied') : t('share')}
      </span>
    </button>
  );
};
