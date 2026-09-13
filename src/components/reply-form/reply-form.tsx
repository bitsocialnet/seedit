import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCommunity } from '@bitsocial/bitsocial-react-hooks';
import { isValidURL } from '../../lib/utils/url-utils';
import useIsCommunityOffline from '../../hooks/use-is-community-offline';
import usePublishReply from '../../hooks/use-publish-reply';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import Markdown from '../markdown';
import styles from './reply-form.module.css';
import formStyles from '../comment-form';

type ReplyFormProps = {
  cid: string;
  isReplyingToReply?: boolean;
  hideReplyForm?: () => void;
  communityAddress: string;
  postCid: string | undefined;
};

export const FormattingHelpTable = () => {
  const { t } = useTranslation();
  return (
    <div className={styles.markdownHelp}>
      <table>
        <tbody>
          <tr className={styles.tableFirstRow}>
            <td>{t('you_type')}:</td>
            <td>{t('you_see')}:</td>
          </tr>
          <tr>
            <td>*{t('italics')}*</td>
            <td>
              <Markdown content={`*${t('italics')}*`} />
            </td>
          </tr>
          <tr>
            <td>**{t('bold')}**</td>
            <td>
              <Markdown content={`**${t('bold')}**`} />
            </td>
          </tr>
          <tr>
            <td>[Bitsocial!](https://bitsocial.net)</td>
            <td>
              <Markdown content='[Bitsocial!](https://bitsocial.net)' />
            </td>
          </tr>
          <tr>
            <td>
              * {t('item')} 1<br />* {t('item')} 2<br />* {t('item')} 3
            </td>
            <td>
              <Markdown content={[`* ${t('item')} 1`, `* ${t('item')} 2`, `* ${t('item')} 3`].join('\n')} />
            </td>
          </tr>
          <tr>
            <td>
              {'>'} {t('quoted_text')}
            </td>
            <td>
              <Markdown content={`> ${t('quoted_text')}`} />
            </td>
          </tr>
          <tr>
            <td>
              Lines starting with four spaces <br />
              are treated like code:
              <br />
              <br />
              <span className={styles.spaces}>&nbsp;&nbsp;&nbsp;&nbsp;</span>
              {'if 1 * 2 < 3:'}
              <br />
              <span className={styles.spaces}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
              print "hello, world!"
            </td>
            <td>
              Lines starting with four spaces <br />
              are treated like code:
              <br />
              <br />
              <Markdown content={`    if 1 * 2 < 3:\n        print "hello, world!"`} />
            </td>
          </tr>
          <tr>
            <td>~~strikethrough~~</td>
            <td>
              <Markdown content='~~strikethrough~~' />
            </td>
          </tr>
          <tr>
            <td>super^script^</td>
            <td>
              <Markdown content='super^script^' />
            </td>
          </tr>
          <tr>
            <td>sub~script~</td>
            <td>
              <Markdown content='sub~script~' />
            </td>
          </tr>
          <tr>
            <td>{`<spoiler>Bitsocial<spoiler>`}</td>
            <td>
              <Markdown content={`<spoiler>Bitsocial<spoiler>`} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const ReplyForm = ({ cid, isReplyingToReply, hideReplyForm, communityAddress, postCid }: ReplyFormProps) => {
  const { t } = useTranslation();
  const [showOptions, setShowOptions] = useState(false);
  const [showFormattingHelp, setShowFormattingHelp] = useState(false);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { setPublishReplyOptions, resetPublishReplyOptions, replyIndex, publishReply, publishReplyOptions } = usePublishReply({ cid, communityAddress, postCid });

  const mdContainerClass = isReplyingToReply ? `${formStyles.mdContainer} ${styles.mdContainerReplying}` : formStyles.mdContainer;
  const urlClass = showOptions ? styles.urlVisible : styles.urlHidden;
  const spoilerClass = showOptions ? styles.spoilerVisible : styles.spoilerHidden;
  const nsfwClass = showOptions ? styles.spoilerVisible : styles.spoilerHidden;

  const community = useCommunity(communityAddress ? { community: getCommunityIdentifier(communityAddress), onlyIfCached: true } : undefined);
  const { isOffline, offlineTitle } = useIsCommunityOffline(community);

  // focus on the textarea when replying to a reply
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (isReplyingToReply && textRef.current) {
      textRef.current.focus();
    }
  }, [isReplyingToReply, textRef]);

  const onPublish = () => {
    const currentContent = publishReplyOptions?.content || '';
    const currentUrl = publishReplyOptions?.link || '';

    if (!currentContent.trim() && !currentUrl) {
      alert(t('empty_comment_alert'));
      return;
    }

    if (currentUrl && !isValidURL(currentUrl)) {
      alert(t('invalid_url_alert'));
      return;
    }
    publishReply();
  };

  useEffect(() => {
    if (typeof replyIndex === 'number') {
      resetPublishReplyOptions();

      if (hideReplyForm) {
        hideReplyForm();
      }
    }
  }, [replyIndex, resetPublishReplyOptions, hideReplyForm]);

  return (
    <div className={mdContainerClass}>
      <div className={formStyles.md}>
        {isOffline && isTextareaFocused && <div className={styles.infobar}>{offlineTitle}</div>}
        {showOptions && (
          <div className={formStyles.options}>
            <span className={urlClass}>
              {t('media_url')}: <input className={`${formStyles.url} ${urlClass}`} onChange={(e) => setPublishReplyOptions.link(e.target.value)} />
            </span>
            <span className={`${formStyles.spoiler} ${spoilerClass}`}>
              <label>
                {t('spoiler')}: <input type='checkbox' className={styles.checkbox} onChange={(e) => setPublishReplyOptions.spoiler(e.target.checked)} />
              </label>
            </span>
            <span className={`${formStyles.spoiler} ${nsfwClass}`}>
              <label>
                {t('nsfw')}: <input type='checkbox' className={styles.checkbox} onChange={(e) => setPublishReplyOptions.nsfw(e.target.checked)} />
              </label>
            </span>
          </div>
        )}
        {!showPreview ? (
          <textarea
            className={formStyles.textarea}
            value={publishReplyOptions?.content || ''}
            onChange={(e) => setPublishReplyOptions.content(e.target.value)}
            onFocus={() => setIsTextareaFocused(true)}
            onBlur={() => setIsTextareaFocused(false)}
          />
        ) : (
          <div className={formStyles.preview}>
            <Markdown content={publishReplyOptions?.content || ''} />
          </div>
        )}
      </div>
      <div className={styles.bottomArea}>
        <button className={formStyles.save} onClick={onPublish}>
          {t('save')}
        </button>
        {showFormattingHelp && (
          <button className={formStyles.previewButton} onClick={() => setShowPreview(!showPreview)} disabled={!publishReplyOptions?.content}>
            {showPreview ? t('edit') : t('preview')}
          </button>
        )}
        {isReplyingToReply && (
          <button className={formStyles.cancel} onClick={hideReplyForm}>
            {t('cancel')}
          </button>
        )}
        <span className={formStyles.optionsButton} onClick={() => setShowFormattingHelp(!showFormattingHelp)}>
          {showFormattingHelp ? t('hide_help') : t('formatting_help')}
        </span>
        <span className={formStyles.optionsButton} onClick={() => setShowOptions(!showOptions)}>
          {showOptions ? t('hide_options') : t('options')}
        </span>
      </div>
      {showFormattingHelp && <FormattingHelpTable />}
    </div>
  );
};

export default ReplyForm;
