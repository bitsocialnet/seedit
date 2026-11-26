import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAccount } from '@bitsocial/bitsocial-react-hooks';
import { getLinkMediaInfo } from '../../lib/utils/media-utils';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { isValidURL } from '../../lib/utils/url-utils';
import { getCommunityPath } from '../../lib/utils/community-route-utils';
import usePublishPostStore from '../../stores/use-publish-post-store';
import { useDefaultSubscriptionAddresses } from '../../hooks/use-default-subscriptions';
import usePostMediaDropzone from '../../hooks/use-post-media-dropzone';
import useSubmitPost from '../../hooks/use-submit-post';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Markdown from '../../components/markdown';
import Embed from '../../components/embed';
import { FormattingHelpTable } from '../../components/reply-form';
import styles from './submit.module.css';
import InfoTooltip from '../../components/info-tooltip';
import CrosspostPreview from '../../components/crosspost-preview';

const UrlField = memo(function UrlField() {
  const { t } = useTranslation();
  const url = usePublishPostStore((state) => state.link);
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);
  const [mediaError, setMediaError] = useState(false);

  const mediaInfo = url ? getLinkMediaInfo(url) : null;
  const mediaType = mediaInfo?.type;

  let mediaComponent;

  if (mediaType === 'image' || mediaType === 'gif') {
    mediaComponent = <img src={url} alt='' onError={() => setMediaError(true)} />;
  } else if (mediaType === 'video') {
    mediaComponent = <video src={url} controls />;
  } else if (mediaType === 'webpage') {
    mediaComponent = <></>;
  } else if (mediaType === 'audio') {
    mediaComponent = <audio src={url} controls />;
  } else if (mediaType === 'iframe') {
    mediaComponent = <Embed url={url || ''} />;
  } else if (mediaType === 'pdf') {
    mediaComponent = <Embed url={url || ''} />;
  }

  return (
    <div className={styles.box}>
      {url && isValidURL(url) ? (
        <span className={styles.boxTitleOptional}>{mediaType}</span>
      ) : (
        <>
          <span className={styles.boxTitleOptional}>url</span>
          <span className={styles.optional}> ({t('optional')})</span>
        </>
      )}
      <div className={styles.boxContent}>
        {url && (
          <span className={styles.urlCancelButton} onClick={() => setPublishPostStore({ link: undefined })}>
            x
          </span>
        )}
        <input
          className={`${styles.input} ${styles.inputUrl}`}
          type='text'
          value={url ?? ''}
          autoCorrect='off'
          autoComplete='off'
          spellCheck='false'
          onChange={(e) => {
            setPublishPostStore({ link: e.target.value });
            setMediaError(false);
          }}
        />
        {url && isValidURL(url) ? (
          <div className={styles.mediaPreview}>{mediaError ? <span className={styles.mediaError}>{t('no_media_found')}</span> : mediaComponent}</div>
        ) : (
          <div className={styles.description}>
            {t('submit_url_description')}
            <InfoTooltip
              content={`Seedit also supports links from the following sites: YouTube, Twitter/X, Reddit, Twitch, TikTok, Instagram, Odysee, Bitchute, Streamable, Spotify, and SoundCloud.`}
            />
          </div>
        )}
      </div>
    </div>
  );
});

const UploadMediaForm = memo(function UploadMediaForm() {
  const { t } = useTranslation();
  const { fileKinds, uploadPhase, getRootProps, getInputProps, isDragActive, chooseFile } = usePostMediaDropzone();

  // Uploads are turned off in the preferences.
  if (fileKinds.length === 0) return null;

  return (
    <div className={styles.box}>
      <span className={styles.boxTitleOptional}>{fileKinds.join('/')}</span>
      <div className={styles.boxContent}>
        {uploadPhase ? (
          <div className={styles.uploading}>
            <LoadingEllipsis string={uploadPhase === 'checking' ? t('running_automated_checks') : t('uploading')} />
          </div>
        ) : (
          <div {...getRootProps()} className={`${styles.uploadBox} ${isDragActive ? styles.dragging : ''}`}>
            <input {...getInputProps()} />
            <div className={styles.cameraIcon} />
            <div className={styles.dropText}>{t('drop_here_or')}</div>
            <label onClick={chooseFile}>
              <div className={styles.fileUploadIcon} />
              {t('choose_file')}
            </label>
          </div>
        )}
      </div>
    </div>
  );
});

const TitleField = memo(function TitleField() {
  const { t } = useTranslation();
  const title = usePublishPostStore((state) => state.title);
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);

  return (
    <div className={styles.box}>
      <span className={styles.boxTitleRequired}>{t('title')}</span>
      <div className={styles.boxContent}>
        <textarea
          className={`${styles.input} ${styles.inputTitle}`}
          value={title}
          onChange={(e) => {
            setPublishPostStore({ title: e.target.value });
          }}
        />
      </div>
    </div>
  );
});

const ContentField = memo(function ContentField() {
  const { t } = useTranslation();
  const [showPreview, setShowPreview] = useState(false);
  const [showFormattingHelp, setShowFormattingHelp] = useState(false);

  const content = usePublishPostStore((state) => state.content);
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);

  return (
    <div className={styles.box}>
      <span className={styles.boxTitleOptional}>{t('text')}</span>
      <span className={styles.optional}> ({t('optional')})</span>
      <div className={styles.boxContent}>
        {!showPreview ? (
          <textarea
            className={`${styles.input} ${styles.inputText}`}
            value={content || ''}
            onChange={(e) => {
              setPublishPostStore({ content: e.target.value });
            }}
          />
        ) : (
          <div className={styles.contentPreview}>
            <div className={styles.contentPreviewMarkdown}>
              <Markdown content={content || ''} />
            </div>
          </div>
        )}
        <div className={styles.contentActions}>
          {showFormattingHelp && (
            <button className={styles.previewButton} disabled={!content} onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? t('edit') : t('preview')}
            </button>
          )}
          <span
            className={styles.formattingHelpButton}
            onClick={() => {
              if (showFormattingHelp && showPreview) {
                setShowPreview(false);
              }
              setShowFormattingHelp(!showFormattingHelp);
            }}
          >
            {showFormattingHelp ? t('hide_help') : t('formatting_help')}
          </span>
        </div>
        {showFormattingHelp && <FormattingHelpTable />}
      </div>
    </div>
  );
});

const CommunityAddressField = memo(function CommunityAddressField() {
  const { t } = useTranslation();
  const { subscriptions } = useAccount() || {};
  const defaultCommunityAddresses = useDefaultSubscriptionAddresses();
  const inputAddress = usePublishPostStore((state) => state.communityAddress);
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);

  const filteredCommunityAddresses = defaultCommunityAddresses.filter((address) => address?.toLowerCase()?.includes(inputAddress?.toLowerCase() || '')).slice(0, 10);
  const [isInputAddressFocused, setIsInputAddressFocused] = useState(false);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number>(-1);

  // Generate random suggestions derived from defaults without an effect
  const randomCommunitySuggestions = useMemo(() => getRandomCommunities(defaultCommunityAddresses, 10), [defaultCommunityAddresses]);
  const listSource = subscriptions?.length > 5 ? subscriptions : randomCommunitySuggestions;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setActiveDropdownIndex((prevIndex) => (prevIndex < filteredCommunityAddresses.length - 1 ? prevIndex + 1 : prevIndex));
      } else if (e.key === 'ArrowUp') {
        setActiveDropdownIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : 0));
      } else if (e.key === 'Enter') {
        if (activeDropdownIndex !== -1) {
          const selectedAddress = filteredCommunityAddresses[activeDropdownIndex];
          setPublishPostStore({ communityAddress: selectedAddress } as any);
        }
        setActiveDropdownIndex(-1);
        setIsInputAddressFocused(false);
      }
    },
    [filteredCommunityAddresses, activeDropdownIndex, setPublishPostStore],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleCommunitySelect = (communityAddress: string) => {
    setPublishPostStore({ communityAddress } as any);
    setIsInputAddressFocused(false);
    setActiveDropdownIndex(-1);
  };

  function getRandomCommunities(addresses: string[], count: number) {
    // Non-mutating shuffle (copy first), avoids side effects
    const shuffled = [...addresses].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  const communitiesDropdown = (
    <ul className={styles.dropdown}>
      {filteredCommunityAddresses.map((communityAddress, index) => (
        <li
          key={communityAddress}
          className={`${styles.dropdownItem} ${index === activeDropdownIndex ? styles.activeDropdownItem : ''}`}
          onClick={() => handleCommunitySelect(communityAddress)}
          onMouseEnter={() => setActiveDropdownIndex(index)}
        >
          {getDisplayAddress(communityAddress)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={styles.box}>
      <span className={styles.boxTitleRequired}>{t('submit_choose')}</span>
      <div className={styles.boxContent}>
        <span className={styles.boxSubtitle}>{t('community_address')}:</span>
        <input
          className={`${styles.input} ${styles.inputCommunity}`}
          type='text'
          value={getDisplayAddress(inputAddress ?? '')}
          onChange={(e) => {
            setPublishPostStore({ communityAddress: e.target.value } as any);
          }}
          autoCorrect='off'
          autoComplete='off'
          spellCheck='false'
          onFocus={() => setIsInputAddressFocused(true)}
          onBlur={() => setTimeout(() => setIsInputAddressFocused(false), 100)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {inputAddress && isInputAddressFocused && filteredCommunityAddresses.length > 0 && communitiesDropdown}
        <div className={styles.subsDescription}>{subscriptions?.length > 5 ? t('submit_subscriptions') : t('submit_subscriptions_notice')}</div>
        <div className={styles.subs}>
          {listSource.map((subscription: string) => (
            <span
              key={subscription}
              className={styles.sub}
              onClick={() => {
                setPublishPostStore({ communityAddress: subscription } as any);
              }}
            >
              {getShortDisplayAddress(subscription)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

const RulesInfo = memo(function RulesInfo({ shortAddress, rules }: { shortAddress: string; rules: string[] }) {
  const { t } = useTranslation();

  return (
    <div className={styles.box}>
      <span className={`${styles.boxTitle} ${styles.rulesTitle}`}>
        {t('rules_for')} s/{shortAddress}
      </span>
      <div className={styles.boxContent}>
        <div className={styles.description}>
          <ol className={styles.rules}>
            {rules?.map((rule: string, index: number) => (
              <li key={index}>{rule}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
});

const SubmitOptions = memo(function SubmitOptions() {
  const { t } = useTranslation();
  const spoiler = usePublishPostStore((state) => state.spoiler);
  const nsfw = usePublishPostStore((state) => state.nsfw);
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);

  return (
    <div className={styles.box}>
      <div className={styles.boxTitle}>{t('options')}</div>
      <div className={styles.boxContent}>
        <div className={styles.options}>
          <div className={styles.option}>
            <label>
              <input type='checkbox' checked={!!spoiler} onChange={(e) => setPublishPostStore({ spoiler: e.target.checked })} />
              {t('spoiler')}
            </label>
          </div>
          <div className={styles.option}>
            <label>
              <input type='checkbox' checked={!!nsfw} onChange={(e) => setPublishPostStore({ nsfw: e.target.checked })} />
              {t('nsfw')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
});

const CrosspostField = memo(function CrosspostField() {
  const { t } = useTranslation();
  const crosspost = usePublishPostStore((state) => state.crosspost);
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);

  if (!crosspost) return null;

  return (
    <div className={styles.box}>
      <span className={styles.boxTitle}>{t('crosspost')}</span>
      <div className={styles.boxContent}>
        <button
          type='button'
          className={styles.crosspostCancelButton}
          aria-label={t('cancel')}
          title={t('cancel')}
          onClick={() => setPublishPostStore({ crosspost: undefined })}
        >
          ×
        </button>
        <CrosspostPreview crosspost={crosspost} />
      </div>
    </div>
  );
});

const SubmitPage = () => {
  const { t } = useTranslation();
  const crosspost = usePublishPostStore((state) => state.crosspost);
  const link = usePublishPostStore((state) => state.link);
  const isUploadingMedia = usePublishPostStore((state) => state.isUploadingMedia);
  const { communityAddress, community, shortAddress, isOffline, offlineTitle, submitPost } = useSubmitPost();
  const { rules, title: communityTitle } = community;

  const documentTitle = t('submit_to_string', {
    string: communityTitle || shortAddress || 'Seedit',
    interpolation: { escapeValue: false },
  });

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div className={styles.content}>
      <h1>
        <Trans
          i18nKey='submit_to'
          shouldUnescape={true}
          values={{
            link: communityTitle || shortAddress || 'seedit',
          }}
          components={{
            1:
              communityAddress && shortAddress ? (
                <Link key='submit_to_link' to={getCommunityPath(communityAddress)} className={styles.location} />
              ) : (
                <span key='submit_to_span' />
              ),
          }}
        />
      </h1>
      <div className={styles.form}>
        <div className={styles.formContent}>
          {isOffline && communityAddress && <div className={styles.infobar}>{offlineTitle}</div>}
          {crosspost ? (
            <CrosspostField />
          ) : (
            <>
              <UrlField />
              {!link && <UploadMediaForm />}
            </>
          )}
          <TitleField />
          <ContentField />
          <CommunityAddressField />
          {rules?.length > 0 && <RulesInfo shortAddress={shortAddress || ''} rules={rules} />}
          <SubmitOptions />
          <div className={`${styles.box} ${styles.notice}`}>{t('submit_notice')}</div>
          <div>*{t('required')}</div>
          <div className={styles.submit}>
            <button className={styles.submitButton} onClick={submitPost} disabled={isUploadingMedia}>
              {t('submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmitPage;
