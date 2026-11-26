import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Comment, useAccount, useCommunity } from '@bitsocial/bitsocial-react-hooks';
import { getCommunityIdentifier } from '../../hooks/use-community-identifier';
import { useDefaultSubscriptionAddresses } from '../../hooks/use-default-subscriptions';
import usePostMediaDropzone from '../../hooks/use-post-media-dropzone';
import useSubmitPost from '../../hooks/use-submit-post';
import { getDisplayAddress, getShortDisplayAddress } from '../../lib/utils/address-utils';
import { isResolvableCommunityAddress } from '../../lib/utils/community-route-utils';
import { getLinkMediaInfo } from '../../lib/utils/media-utils';
import { isValidURL } from '../../lib/utils/url-utils';
import usePublishPostStore from '../../stores/use-publish-post-store';
import CrosspostPreview from '../../components/crosspost-preview';
import Markdown from '../../components/markdown';
import ModernCommunityAbout from '../../components/modern-community-about';
import ModernCommunityAvatar from '../../components/modern-community-avatar';
import { CloseIcon } from '../../components/modern-icons';
import { ModernColumns, modernStyles } from '../../components/modern-layout';
import { PostMedia } from '../../components/modern-post-card';
import styles from './modern-submit.module.css';

const MAX_SUGGESTIONS = 10;

const RequiredMark = () => (
  <span className={styles.required} aria-hidden='true'>
    *
  </span>
);

const SuggestedCommunity = ({ address, selected, onSelect }: { address: string; selected: boolean; onSelect: (address: string) => void }) => {
  // Only what is already cached: the suggestions must not start a network load for every community.
  const community = useCommunity({ community: getCommunityIdentifier(address), onlyIfCached: true });
  return (
    <button type='button' className={`${styles.chip} ${selected ? styles.chipSelected : ''}`} aria-pressed={selected} title={address} onClick={() => onSelect(address)}>
      <ModernCommunityAvatar address={address} avatarUrl={community?.suggested?.avatarUrl} />
      <span className={styles.chipLabel}>s/{getShortDisplayAddress(address)}</span>
    </button>
  );
};

const CommunityField = () => {
  const { t } = useTranslation();
  const subscriptions: string[] | undefined = useAccount()?.subscriptions;
  const hasSubscriptions = Boolean(subscriptions?.length);
  const defaultAddresses = useDefaultSubscriptionAddresses();
  const communityAddress = usePublishPostStore((state) => state.communityAddress);
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);
  const select = (address: string) => setPublishPostStore({ communityAddress: address } as Comment);

  // Without subscriptions, a sample of the default communities stands in.
  const suggestions = useMemo(
    () => (subscriptions?.length ? subscriptions : [...defaultAddresses].sort(() => 0.5 - Math.random())).slice(0, MAX_SUGGESTIONS),
    [subscriptions, defaultAddresses],
  );

  return (
    <div className={styles.field}>
      <label htmlFor='modern-submit-community' className={styles.label}>
        <span className={modernStyles.sentenceCase}>{t('submit_choose')}</span>
        <RequiredMark />
      </label>
      <div className={styles.inputWithIcon}>
        {isResolvableCommunityAddress(communityAddress) && <ModernCommunityAvatar address={communityAddress} />}
        <input
          id='modern-submit-community'
          className={styles.input}
          list='modern-submit-community-options'
          value={getDisplayAddress(communityAddress ?? '')}
          placeholder={t('community_address')}
          required
          autoCapitalize='off'
          autoCorrect='off'
          autoComplete='off'
          spellCheck={false}
          onChange={(event) => select(event.target.value.trim())}
        />
      </div>
      <datalist id='modern-submit-community-options'>
        {defaultAddresses.map((address) => (
          <option key={address} value={address} />
        ))}
      </datalist>
      {suggestions.length > 0 && (
        <div className={styles.suggestions}>
          <span className={`${styles.hint} ${modernStyles.sentenceCase}`}>{hasSubscriptions ? t('submit_subscriptions') : t('submit_subscriptions_notice')}</span>
          <div className={styles.chips}>
            {suggestions.map((address) => (
              <SuggestedCommunity key={address} address={address} selected={address === communityAddress} onSelect={select} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TitleField = () => {
  const { t } = useTranslation();
  const title = usePublishPostStore((state) => state.title);
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);
  return (
    <div className={styles.field}>
      <label htmlFor='modern-submit-title' className={styles.label}>
        <span className={modernStyles.sentenceCase}>{t('title')}</span>
        <RequiredMark />
      </label>
      <textarea
        id='modern-submit-title'
        className={`${styles.input} ${styles.titleInput}`}
        value={title ?? ''}
        rows={1}
        required
        onChange={(event) => setPublishPostStore({ title: event.target.value })}
      />
    </div>
  );
};

const BodyField = () => {
  const { t } = useTranslation();
  const content = usePublishPostStore((state) => state.content);
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const showPreview = isPreviewing && Boolean(content);

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor='modern-submit-body' className={styles.label}>
          <span className={modernStyles.sentenceCase}>{t('text')}</span> <span className={styles.optional}>({t('optional')})</span>
        </label>
        <button type='button' className={styles.textButton} disabled={!content} aria-pressed={showPreview} onClick={() => setIsPreviewing(!isPreviewing)}>
          <span className={modernStyles.sentenceCase}>{t('preview')}</span>
        </button>
      </div>
      {showPreview ? (
        <div className={styles.preview}>
          <Markdown content={content || ''} />
        </div>
      ) : (
        <textarea
          id='modern-submit-body'
          className={`${styles.input} ${styles.bodyInput}`}
          value={content ?? ''}
          rows={6}
          onChange={(event) => setPublishPostStore({ content: event.target.value })}
        />
      )}
    </div>
  );
};

const UploadBox = () => {
  const { t } = useTranslation();
  const { fileKinds, uploadPhase, getRootProps, getInputProps, isDragActive, chooseFile } = usePostMediaDropzone();
  // Uploads are turned off in the preferences.
  if (fileKinds.length === 0) return null;

  if (uploadPhase) {
    return (
      <div className={styles.dropzone} role='status'>
        <span className={styles.spinner} aria-hidden='true' />
        <span>{uploadPhase === 'checking' ? t('running_automated_checks') : t('uploading')}…</span>
      </div>
    );
  }

  return (
    <div {...getRootProps({ className: `${styles.dropzone} ${isDragActive ? styles.dragging : ''}` })}>
      <input {...getInputProps()} />
      <span>{t('drop_here_or')}</span>
      <button type='button' className={`${modernStyles.secondaryButton} ${styles.smallButton}`} onClick={() => void chooseFile()}>
        {t('choose_file')}
      </button>
      <span className={styles.hint}>{fileKinds.join(', ')}</span>
    </div>
  );
};

const MediaField = () => {
  const { t } = useTranslation();
  const link = usePublishPostStore((state) => state.link);
  const crosspost = usePublishPostStore((state) => state.crosspost);
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);
  const isInvalidLink = Boolean(link && !isValidURL(link));

  if (crosspost) {
    return (
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span className={`${styles.label} ${modernStyles.sentenceCase}`}>{t('crosspost')}</span>
          <button type='button' className={styles.iconButton} aria-label={t('cancel')} onClick={() => setPublishPostStore({ crosspost: undefined })}>
            <CloseIcon size={16} />
          </button>
        </div>
        <div className={styles.crosspost}>
          <CrosspostPreview crosspost={crosspost} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label htmlFor='modern-submit-link' className={styles.label}>
        <span className={modernStyles.sentenceCase}>{t('media_url')}</span> <span className={styles.optional}>({t('optional')})</span>
      </label>
      <div className={styles.inputWithIcon}>
        <input
          id='modern-submit-link'
          className={styles.input}
          type='url'
          inputMode='url'
          value={link ?? ''}
          placeholder='https://'
          aria-invalid={isInvalidLink}
          aria-describedby='modern-submit-link-hint'
          autoCapitalize='off'
          autoCorrect='off'
          autoComplete='off'
          spellCheck={false}
          onChange={(event) => setPublishPostStore({ link: event.target.value })}
        />
        {link && (
          <button type='button' className={styles.iconButton} aria-label={t('remove')} onClick={() => setPublishPostStore({ link: '' })}>
            <CloseIcon size={16} />
          </button>
        )}
      </div>
      <p id='modern-submit-link-hint' className={`${styles.hint} ${isInvalidLink ? styles.error : ''}`}>
        {isInvalidLink ? t('invalid_url_alert') : <span className={modernStyles.sentenceCase}>{t('submit_url_description')}</span>}
      </p>
      {link && !isInvalidLink ? (
        <div className={styles.mediaPreview}>
          <PostMedia key={link} mediaInfo={getLinkMediaInfo(link)} link={link} onReveal={() => {}} />
        </div>
      ) : (
        !link && <UploadBox />
      )}
    </div>
  );
};

const OptionsField = () => {
  const { t } = useTranslation();
  const spoiler = usePublishPostStore((state) => state.spoiler);
  const nsfw = usePublishPostStore((state) => state.nsfw);
  const setPublishPostStore = usePublishPostStore((state) => state.setPublishPostStore);
  return (
    <div className={styles.toggles} role='group' aria-label={t('options')}>
      <button
        type='button'
        className={`${styles.chip} ${spoiler ? styles.chipSelected : ''}`}
        aria-pressed={Boolean(spoiler)}
        onClick={() => setPublishPostStore({ spoiler: !spoiler })}
      >
        <span className={modernStyles.sentenceCase}>{t('spoiler')}</span>
      </button>
      <button
        type='button'
        className={`${styles.chip} ${nsfw ? styles.chipSelected : ''}`}
        aria-pressed={Boolean(nsfw)}
        onClick={() => setPublishPostStore({ nsfw: !nsfw })}
      >
        {t('nsfw')}
      </button>
    </div>
  );
};

const ModernSubmit = () => {
  const { t } = useTranslation();
  const { communityAddress, community, shortAddress, isOffline, offlineTitle, submitPost } = useSubmitPost();
  const title = usePublishPostStore((state) => state.title);
  const link = usePublishPostStore((state) => state.link);
  // the post waits for a media upload to finish and fill in its link
  const isUploadingMedia = usePublishPostStore((state) => state.isUploadingMedia);
  const canSubmit = Boolean(title?.trim() && communityAddress && !(link && !isValidURL(link)) && !isUploadingMedia);

  const documentTitle = t('submit_to_string', { string: community?.title || shortAddress || 'Seedit', interpolation: { escapeValue: false } });
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) submitPost();
  };

  return (
    <ModernColumns
      rail={isResolvableCommunityAddress(communityAddress) && <ModernCommunityAbout community={community} communityAddress={communityAddress} showIdentity />}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1 className={`${styles.heading} ${modernStyles.sentenceCase}`}>{t('submit_post')}</h1>
        <CommunityField />
        {isOffline && communityAddress && offlineTitle && <p className={styles.notice}>{offlineTitle}</p>}
        <TitleField />
        <BodyField />
        <MediaField />
        <OptionsField />
        <p className={`${styles.hint} ${modernStyles.sentenceCase}`}>{t('submit_notice')}</p>
        <div className={styles.footer}>
          <button type='submit' className={modernStyles.primaryButton} disabled={!canSubmit}>
            <span className={modernStyles.sentenceCase}>{t('post')}</span>
          </button>
        </div>
      </form>
    </ModernColumns>
  );
};

export default ModernSubmit;
