import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAccount, usePublishComment, useSubplebbit } from '@plebbit/plebbit-react-hooks';
import Plebbit from '@plebbit/plebbit-js';
import { Capacitor } from '@capacitor/core';
import FileUploader from '../../plugins/file-uploader';
import { getLinkMediaInfo } from '../../lib/utils/media-utils';
import { isValidURL } from '../../lib/utils/url-utils';
import usePublishPostStore from '../../stores/use-publish-post-store';
import { useDefaultSubplebbitAddresses } from '../../hooks/use-default-subplebbits';
import useIsSubplebbitOffline from '../../hooks/use-is-subplebbit-offline';
import LoadingEllipsis from '../../components/loading-ellipsis';
import Markdown from '../../components/markdown';
import Embed from '../../components/post/embed';
import { FormattingHelpTable } from '../../components/reply-form/reply-form';
import styles from './submit-page.module.css';
import InfoTooltip from '../../components/info-tooltip';

const isAndroid = Capacitor.getPlatform() === 'android';
const isElectron = window.electronApi?.isElectron === true;

const UrlField = () => {
  const { t } = useTranslation();
  const { link: url, setPublishPostStore } = usePublishPostStore();
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
};

const UploadMediaForm = () => {
  const { t } = useTranslation();
  const { setPublishPostStore } = usePublishPostStore();

  // on android or electron, auto upload file to image hosting sites with open api
  const [isUploading, setIsUploading] = useState(false);
  const [isChoosingFile, setIsChoosingFile] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!(isAndroid || isElectron)) {
        if (window.confirm(t('upload_button_warning'))) {
          const link = document.createElement('a');
          link.href = 'https://github.com/bitsocialnet/seedit/releases/latest';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.click();
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        try {
          setIsChoosingFile(false);
          setIsUploading(true);

          // for Electron, we need to convert the File to a format that can be sent via IPC
          if (isElectron) {
            const file = acceptedFiles[0];
            const reader = new FileReader();

            const fileData = await new Promise((resolve, reject) => {
              reader.onload = () => {
                const base64data = reader.result?.toString().split(',')[1];
                resolve({
                  fileData: base64data,
                  fileName: file.name,
                });
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            const result = await FileUploader.uploadMedia(fileData as { fileData?: string; fileName: string });
            if (result.url) {
              setPublishPostStore({ link: result.url || undefined });
            }
          } else if (isAndroid) {
            // android can handle File objects directly
            const result = await FileUploader.uploadMedia(acceptedFiles[0]);
            if (result.url) {
              setPublishPostStore({ link: result.url || undefined });
            }
          }
        } catch (error) {
          console.error('Upload failed:', error);
          if (error instanceof Error && !error.message.includes('File selection cancelled')) {
            alert(`${t('upload_failed')}: ${error.message}`);
          }
        } finally {
          setIsUploading(false);
        }
      }
    },
    [setPublishPostStore, t],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    accept: {
      'image/*': [],
      'video/*': [],
      'audio/*': [],
      'application/pdf': [],
    },
  });

  const handleUpload = async () => {
    if (!(isAndroid || isElectron)) {
      if (window.confirm(t('upload_button_warning'))) {
        const link = document.createElement('a');
        link.href = 'https://github.com/bitsocialnet/seedit/releases/latest';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }
      return;
    }

    try {
      setIsChoosingFile(true);

      const pickedFile = await FileUploader.pickMedia(); // base64 data
      setIsChoosingFile(false);

      setIsUploading(true);

      const uploadResult = await FileUploader.uploadMedia({
        fileData: pickedFile.data,
        fileName: pickedFile.fileName,
      });

      if (uploadResult?.url) {
        setPublishPostStore({ link: uploadResult.url });
      } else {
        throw new Error('No URL returned from upload');
      }
    } catch (error) {
      console.error('Process failed:', error);
      if (error instanceof Error && !error.message.includes('File selection cancelled')) {
        alert(`${t('upload_failed')}: ${error.message}`);
      } else if (typeof error === 'string' && !error.includes('File selection cancelled')) {
        alert(`${t('upload_failed')}: ${error}`);
      }
    } finally {
      setIsChoosingFile(false);
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.box}>
      <span className={styles.boxTitleOptional}>image/video/audio/pdf</span>
      <div className={styles.boxContent}>
        {isUploading ? (
          <div className={styles.uploading}>
            <LoadingEllipsis string={t('uploading')} />
          </div>
        ) : (
          <div {...getRootProps()} className={`${styles.uploadBox} ${isDragActive ? styles.dragging : ''}`}>
            <input {...getInputProps()} />
            <div className={styles.cameraIcon} />
            <div className={styles.dropText}>{t('drop_here_or')}</div>
            <label onClick={() => (isUploading || isChoosingFile ? null : handleUpload())}>
              <div className={styles.fileUploadIcon} />
              {t('choose_file')}
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

const TitleField = () => {
  const { t } = useTranslation();
  const { title, setPublishPostStore } = usePublishPostStore();

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
};

const ContentField = () => {
  const { t } = useTranslation();
  const [showPreview, setShowPreview] = useState(false);
  const [showFormattingHelp, setShowFormattingHelp] = useState(false);

  const { content, setPublishPostStore } = usePublishPostStore();

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
};

const SubplebbitAddressField = () => {
  const { t } = useTranslation();
  const { subscriptions } = useAccount() || {};
  const defaultSubplebbitAddresses = useDefaultSubplebbitAddresses();
  const { subplebbitAddress: inputAddress, setPublishPostStore } = usePublishPostStore();

  const filteredSubplebbitAddresses = defaultSubplebbitAddresses.filter((address) => address?.toLowerCase()?.includes(inputAddress?.toLowerCase() || '')).slice(0, 10);
  const [isInputAddressFocused, setIsInputAddressFocused] = useState(false);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number>(-1);

  // Generate random suggestions derived from defaults without an effect
  const randomSubplebbitSuggestions = useMemo(() => getRandomSubplebbits(defaultSubplebbitAddresses, 10), [defaultSubplebbitAddresses]);
  const listSource = subscriptions?.length > 5 ? subscriptions : randomSubplebbitSuggestions;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setActiveDropdownIndex((prevIndex) => (prevIndex < filteredSubplebbitAddresses.length - 1 ? prevIndex + 1 : prevIndex));
      } else if (e.key === 'ArrowUp') {
        setActiveDropdownIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : 0));
      } else if (e.key === 'Enter') {
        if (activeDropdownIndex !== -1) {
          const selectedAddress = filteredSubplebbitAddresses[activeDropdownIndex];
          setPublishPostStore({ subplebbitAddress: selectedAddress });
        }
        setActiveDropdownIndex(-1);
        setIsInputAddressFocused(false);
      }
    },
    [filteredSubplebbitAddresses, activeDropdownIndex, setPublishPostStore],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleSubplebbitSelect = (subplebbitAddress: string) => {
    setPublishPostStore({ subplebbitAddress: subplebbitAddress });
    setIsInputAddressFocused(false);
    setActiveDropdownIndex(-1);
  };

  function getRandomSubplebbits(addresses: string[], count: number) {
    // Non-mutating shuffle (copy first), avoids side effects
    const shuffled = [...addresses].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  const defaultSubplebbitsDropdown = (
    <ul className={styles.dropdown}>
      {filteredSubplebbitAddresses.map((subplebbitAddress, index) => (
        <li
          key={subplebbitAddress}
          className={`${styles.dropdownItem} ${index === activeDropdownIndex ? styles.activeDropdownItem : ''}`}
          onClick={() => handleSubplebbitSelect(subplebbitAddress)}
          onMouseEnter={() => setActiveDropdownIndex(index)}
        >
          {subplebbitAddress}
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
          value={inputAddress ?? ''}
          onChange={(e) => {
            setPublishPostStore({ subplebbitAddress: e.target.value });
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
        {inputAddress && isInputAddressFocused && filteredSubplebbitAddresses.length > 0 && defaultSubplebbitsDropdown}
        <div className={styles.subsDescription}>{subscriptions?.length > 5 ? t('submit_subscriptions') : t('submit_subscriptions_notice')}</div>
        <div className={styles.subs}>
          {listSource.map((subscription: string) => (
            <span
              key={subscription}
              className={styles.sub}
              onClick={() => {
                setPublishPostStore({ subplebbitAddress: subscription });
              }}
            >
              {Plebbit.getShortAddress({ address: subscription })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const RulesInfo = ({ shortAddress, rules }: { shortAddress: string; rules: string[] }) => {
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
};

const SubmitOptions = () => {
  const { t } = useTranslation();
  const { setPublishPostStore } = usePublishPostStore();

  return (
    <div className={styles.box}>
      <div className={styles.boxTitle}>{t('options')}</div>
      <div className={styles.boxContent}>
        <div className={styles.options}>
          <div className={styles.option}>
            <label>
              <input type='checkbox' onChange={(e) => setPublishPostStore({ spoiler: e.target.checked })} />
              {t('spoiler')}
            </label>
          </div>
          <div className={styles.option}>
            <label>
              <input type='checkbox' onChange={(e) => setPublishPostStore({ nsfw: e.target.checked })} />
              {t('nsfw')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

const SubmitPage = () => {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();

  const { link, title, subplebbitAddress, publishCommentOptions, setPublishPostStore, resetPublishPostStore } = usePublishPostStore();

  useEffect(() => {
    setPublishPostStore({ subplebbitAddress: params.subplebbitAddress || '' });
  }, [params.subplebbitAddress, setPublishPostStore]);

  const selectedSubplebbitData = useSubplebbit({ subplebbitAddress });
  const { rules, title: subplebbitTitle } = selectedSubplebbitData;
  const shortAddress = subplebbitAddress && Plebbit.getShortAddress({ address: subplebbitAddress });
  const { isOffline, offlineTitle } = useIsSubplebbitOffline(selectedSubplebbitData);

  const { index, publishComment } = usePublishComment(publishCommentOptions);

  const onPublish = () => {
    if (!title) {
      alert(`Missing title`);
      return;
    }
    if (link && !isValidURL(link)) {
      alert(`Invalid URL`);
      return;
    }
    if (!subplebbitAddress) {
      alert(`Missing community address`);
      return;
    }

    publishComment();
  };

  // redirect to pending page when pending comment is created
  useEffect(() => {
    if (typeof index === 'number') {
      resetPublishPostStore();
      navigate(`/profile/${index}`);
    }
  }, [index, resetPublishPostStore, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const documentTitle = t('submit_to_string', {
    string: subplebbitTitle || shortAddress || 'Seedit',
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
            link: subplebbitTitle || shortAddress || 'seedit',
          }}
          components={{
            1: shortAddress ? <Link key='submit_to_link' to={`/s/${subplebbitAddress}`} className={styles.location} /> : <span key='submit_to_span' />,
          }}
        />
      </h1>
      <div className={styles.form}>
        <div className={styles.formContent}>
          {isOffline && subplebbitAddress && <div className={styles.infobar}>{offlineTitle}</div>}
          <UrlField />
          {!link && <UploadMediaForm />}
          <TitleField />
          <ContentField />
          <SubplebbitAddressField />
          {rules?.length > 0 && <RulesInfo shortAddress={shortAddress || ''} rules={rules} />}
          <SubmitOptions />
          <div className={`${styles.box} ${styles.notice}`}>{t('submit_notice')}</div>
          <div>*{t('required')}</div>
          <div className={styles.submit}>
            <button className={styles.submitButton} onClick={onPublish}>
              {t('submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmitPage;
