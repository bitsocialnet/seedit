import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubplebbit } from '@bitsocialnet/bitsocial-react-hooks';
import { isValidURL } from '../../lib/utils/url-utils';
import useIsSubplebbitOffline from '../../hooks/use-is-subplebbit-offline';
import usePublishReply from '../../hooks/use-publish-reply';
import Markdown from '../markdown';
import styles from './reply-form.module.css';

type ReplyFormProps = {
  cid: string;
  isReplyingToReply?: boolean;
  hideReplyForm?: () => void;
  subplebbitAddress: string;
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
            <td>[plebbit!](https://plebbit.com)</td>
            <td>
              <Markdown content='[plebbit!](https://plebbit.com)' />
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
            <td>{`<spoiler>plebbit<spoiler>`}</td>
            <td>
              <Markdown content={`<spoiler>plebbit<spoiler>`} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const ReplyForm = ({ cid, isReplyingToReply, hideReplyForm, subplebbitAddress, postCid }: ReplyFormProps) => {
  const { t } = useTranslation();
  const [showOptions, setShowOptions] = useState(false);
  const [showFormattingHelp, setShowFormattingHelp] = useState(false);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { setPublishReplyOptions, resetPublishReplyOptions, replyIndex, publishReply, publishReplyOptions } = usePublishReply({ cid, subplebbitAddress, postCid });

  const mdContainerClass = isReplyingToReply ? `${styles.mdContainer} ${styles.mdContainerReplying}` : styles.mdContainer;
  const urlClass = showOptions ? styles.urlVisible : styles.urlHidden;
  const spoilerClass = showOptions ? styles.spoilerVisible : styles.spoilerHidden;
  const nsfwClass = showOptions ? styles.spoilerVisible : styles.spoilerHidden;

  const subplebbit = useSubplebbit({ subplebbitAddress, onlyIfCached: true });
  const { isOffline, offlineTitle } = useIsSubplebbitOffline(subplebbit);

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
      <div className={styles.md}>
        {isOffline && isTextareaFocused && <div className={styles.infobar}>{offlineTitle}</div>}
        {showOptions && (
          <div className={styles.options}>
            <span className={urlClass}>
              {t('media_url')}: <input className={`${styles.url} ${urlClass}`} onChange={(e) => setPublishReplyOptions.link(e.target.value)} />
            </span>
            <span className={`${styles.spoiler} ${spoilerClass}`}>
              <label>
                {t('spoiler')}: <input type='checkbox' className={styles.checkbox} onChange={(e) => setPublishReplyOptions.spoiler(e.target.checked)} />
              </label>
            </span>
            <span className={`${styles.spoiler} ${nsfwClass}`}>
              <label>
                {t('nsfw')}: <input type='checkbox' className={styles.checkbox} onChange={(e) => setPublishReplyOptions.nsfw(e.target.checked)} />
              </label>
            </span>
          </div>
        )}
        {!showPreview ? (
          <textarea
            className={styles.textarea}
            value={publishReplyOptions?.content || ''}
            onChange={(e) => setPublishReplyOptions.content(e.target.value)}
            onFocus={() => setIsTextareaFocused(true)}
            onBlur={() => setIsTextareaFocused(false)}
          />
        ) : (
          <div className={styles.preview}>
            <Markdown content={publishReplyOptions?.content || ''} />
          </div>
        )}
      </div>
      <div className={styles.bottomArea}>
        <button className={styles.save} onClick={onPublish}>
          {t('save')}
        </button>
        {showFormattingHelp && (
          <button className={styles.previewButton} onClick={() => setShowPreview(!showPreview)} disabled={!publishReplyOptions?.content}>
            {showPreview ? t('edit') : t('preview')}
          </button>
        )}
        {isReplyingToReply && (
          <button className={styles.cancel} onClick={hideReplyForm}>
            {t('cancel')}
          </button>
        )}
        <span className={styles.optionsButton} onClick={() => setShowFormattingHelp(!showFormattingHelp)}>
          {showFormattingHelp ? t('hide_help') : t('formatting_help')}
        </span>
        <span className={styles.optionsButton} onClick={() => setShowOptions(!showOptions)}>
          {showOptions ? t('hide_options') : t('options')}
        </span>
      </div>
      {showFormattingHelp && <FormattingHelpTable />}
    </div>
  );
};

export default ReplyForm;
