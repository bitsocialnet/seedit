import { type FormEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCommunity } from '@bitsocial/bitsocial-react-hooks';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import useIsCommunityOffline from '../../hooks/use-is-community-offline';
import usePublishReply from '../../hooks/use-publish-reply';
import { startPostingAnalytics } from '../../lib/posting-analytics';
import { isValidURL } from '../../lib/utils/url-utils';
import { modernStyles } from '../modern-layout';
import styles from './modern-reply-form.module.css';

interface ModernReplyFormProps {
  /** The comment being replied to. */
  cid: string;
  communityAddress: string;
  postCid: string | undefined;
  autoFocus?: boolean;
  /** Closes a reply form opened under a comment; it also closes once the reply is published. */
  onClose?: () => void;
  submitLabel: string;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

const ModernReplyForm = ({ cid, communityAddress, postCid, autoFocus, onClose, submitLabel, textareaRef }: ModernReplyFormProps) => {
  const { t } = useTranslation();
  // The draft lives in the shared reply store, so it survives closing the form and switching interfaces.
  const { setPublishReplyOptions, resetPublishReplyOptions, replyIndex, publishReply, publishReplyOptions } = usePublishReply({ cid, communityAddress, postCid });
  const content = publishReplyOptions?.content || '';
  // A link can come from a draft started in the old interface, which has a link field.
  const link = publishReplyOptions?.link || '';
  const canSubmit = Boolean(content.trim() || link);

  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress), onlyIfCached: true } : undefined);
  const { isOffline, offlineTitle } = useIsCommunityOffline(community);
  const [isFocused, setIsFocused] = useState(false);

  const localTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textarea = textareaRef ?? localTextareaRef;
  useEffect(() => {
    if (autoFocus) textarea.current?.focus();
  }, [autoFocus, textarea]);

  // A published reply gets an account comment index: clear the draft and close the form.
  useEffect(() => {
    if (typeof replyIndex !== 'number') return;
    resetPublishReplyOptions();
    onClose?.();
  }, [replyIndex, resetPublishReplyOptions, onClose]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const attempt = startPostingAnalytics({ kind: 'reply' });
    if (!canSubmit) {
      attempt.finish('post_validation_failed');
      return;
    }
    if (link && !isValidURL(link)) {
      attempt.finish('post_validation_failed');
      alert(t('invalid_url_alert'));
      return;
    }
    publishReply(attempt);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {isOffline && isFocused && offlineTitle && <p className={styles.notice}>{offlineTitle}</p>}
      <textarea
        ref={textarea}
        className={styles.textarea}
        aria-label={submitLabel}
        value={content}
        rows={3}
        onChange={(event) => setPublishReplyOptions.content(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      <div className={styles.footer}>
        {onClose && (
          <button type='button' className={`${modernStyles.secondaryButton} ${styles.button}`} onClick={onClose}>
            <span className={modernStyles.sentenceCase}>{t('cancel')}</span>
          </button>
        )}
        <button type='submit' className={`${modernStyles.primaryButton} ${styles.button}`} disabled={!canSubmit}>
          <span className={modernStyles.sentenceCase}>{submitLabel}</span>
        </button>
      </div>
    </form>
  );
};

export default ModernReplyForm;
